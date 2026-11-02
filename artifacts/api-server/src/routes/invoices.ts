import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, invoiceItemsTable, clientsTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { syncParentInsert, syncParentUpdate } from "../lib/dbSync";
import { sanitizeAndValidate, validateLineItems, isValidUUID } from "../lib/validation";
import { requirePermission } from "../middleware/auth";

const router = Router();

function sanitizeInvoice(body: any, isUpdate = false) {
  validateLineItems(body, "Invoices");
  return sanitizeAndValidate(body, {
    uuids: ["clientId"],
    textDates: ["invoiceDate", "dueDate"],
    numbers: ["subtotal", "taxAmount", "discount", "total", "cgstAmount", "sgstAmount", "igstAmount", "delayedDays"],
    enums: {
      status: ["DRAFT", "SENT", "VIEWED", "PAID", "OVERDUE", "CANCELLED"],
      paymentStatus: ["PAID", "PARTIALLY_PAID", "PENDING", "DELAYED_PAYMENT", "OVERDUE"],
      invoiceType: ["TAX_INVOICE", "PROFORMA"],
      discountType: ["FIXED", "PERCENT"],
      gstType: ["CGST_SGST", "IGST", "UTGST", "NONE"],
    }
  });
}

const invoiceSyncConfig = {
  parentTable: invoicesTable,
  childTable: invoiceItemsTable,
  foreignKeyField: "invoiceId",
  payloadKeys: ["lineItems", "items"],
  mapItem: (item: any, parentId: string) => ({
    invoiceId: parentId,
    description: item.description || "",
    hsnSac: item.hsnSac || null,
    qty: item.qty !== undefined ? Number(item.qty) : 1,
    unitPrice: item.unitPrice !== undefined ? Number(item.unitPrice) : 0,
    taxPercent: item.taxPercent !== undefined ? Number(item.taxPercent) : 18,
    createdBy: item.createdBy || null,
    updatedBy: item.updatedBy || null,
  }),
};

router.get("/financial-summary", requirePermission("invoices.view"), asyncHandler(async (req, res) => {
  const allInvoices = await db
    .select({
      status: invoicesTable.status,
      total: invoicesTable.total,
    })
    .from(invoicesTable);

  let totalRevenue = 0;
  let paidCount = 0;
  let outstanding = 0;
  let overdue = 0;
  const invoiceCount = allInvoices.length;

  for (const inv of allInvoices) {
    const val = Number(inv.total) || 0;
    if (inv.status === "PAID") {
      totalRevenue += val;
      paidCount += 1;
    } else if (inv.status === "SENT" || inv.status === "VIEWED") {
      outstanding += val;
    } else if (inv.status === "OVERDUE") {
      overdue += val;
    }
  }

  return res.json({ totalRevenue, outstanding, overdue, paidCount, invoiceCount });
}));

router.get("/", requirePermission("invoices.view"), asyncHandler(async (req, res) => {
  const rows = await db
    .select({
      id: invoicesTable.id,
      number: invoicesTable.number,
      invoiceType: invoicesTable.invoiceType,
      originalProformaNumber: invoicesTable.originalProformaNumber,
      proformaConvertedAt: invoicesTable.proformaConvertedAt,
      clientId: invoicesTable.clientId,
      clientName: clientsTable.companyName,
      status: invoicesTable.status,
      paymentStatus: invoicesTable.paymentStatus,
      delayedDays: invoicesTable.delayedDays,
      paymentNotes: invoicesTable.paymentNotes,
      invoiceDate: invoicesTable.invoiceDate,
      dueDate: invoicesTable.dueDate,
      currency: invoicesTable.currency,
      subtotal: invoicesTable.subtotal,
      taxAmount: invoicesTable.taxAmount,
      cgstAmount: invoicesTable.cgstAmount,
      sgstAmount: invoicesTable.sgstAmount,
      igstAmount: invoicesTable.igstAmount,
      discount: invoicesTable.discount,
      total: invoicesTable.total,
      lineItems: invoicesTable.lineItems,
      notes: invoicesTable.notes,
      termsAndConditions: invoicesTable.termsAndConditions,
      companyGstin: invoicesTable.companyGstin,
      clientGstin: invoicesTable.clientGstin,
      billingAddress: invoicesTable.billingAddress,
      shippingAddress: invoicesTable.shippingAddress,
      bankDetails: invoicesTable.bankDetails,
      logoUrl: invoicesTable.logoUrl,
      businessName: invoicesTable.businessName,
      businessPhone: invoicesTable.businessPhone,
      businessEmail: invoicesTable.businessEmail,
      businessPan: invoicesTable.businessPan,
      businessAddress: invoicesTable.businessAddress,
      businessCity: invoicesTable.businessCity,
      businessPostalCode: invoicesTable.businessPostalCode,
      businessState: invoicesTable.businessState,
      clientPhone: invoicesTable.clientPhone,
      clientEmail: invoicesTable.clientEmail,
      clientPan: invoicesTable.clientPan,
      clientCity: invoicesTable.clientCity,
      clientPostalCode: invoicesTable.clientPostalCode,
      clientState: invoicesTable.clientState,
      gstType: invoicesTable.gstType,
      signatureUrl: invoicesTable.signatureUrl,
      discountType: invoicesTable.discountType,
    })
    .from(invoicesTable)
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .orderBy(desc(invoicesTable.createdAt));
  return res.json(rows);
}));

router.post("/", requirePermission("invoices.create"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeInvoice(body, false);
  const isProforma = sanitized.invoiceType === "PROFORMA";

  if (!sanitized.number) {
    const existing = await db.select({ number: invoicesTable.number }).from(invoicesTable);
    const prefix = isProforma ? "PI-" : "INV-";
    const nums = existing
      .map((r) => r.number)
      .filter((n): n is string => !!n && n.startsWith(prefix))
      .map((n) => parseInt(n.replace(prefix, ""), 10))
      .filter((n) => !isNaN(n));
    sanitized.number = `${prefix}${nums.length > 0 ? Math.max(...nums) + 1 : 1001}`;
  }

  // Calculate default CGST / SGST / IGST if not explicitly provided
  const tax = Number(sanitized.taxAmount) || 0;
  if (tax > 0) {
    if (sanitized.gstType === "IGST") {
      if (sanitized.igstAmount === undefined) sanitized.igstAmount = tax;
    } else {
      if (sanitized.cgstAmount === undefined) sanitized.cgstAmount = Number((tax / 2).toFixed(2));
      if (sanitized.sgstAmount === undefined) sanitized.sgstAmount = Number((tax / 2).toFixed(2));
    }
  }

  const row = await syncParentInsert(invoiceSyncConfig, sanitized, req.body);
  return res.status(201).json(row);
}));

// Convert Proforma Invoice to Tax Invoice
router.post("/:id/convert-to-tax-invoice", requirePermission("invoices.edit"), asyncHandler(async (req, res) => {
  if (!isValidUUID(req.params.id)) {
    throw createError("Invalid invoice ID format", 400);
  }

  const [existingInv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, req.params.id as string));
  if (!existingInv) throw createError("Invoice not found", 404);

  const existingInvoices = await db.select({ number: invoicesTable.number }).from(invoicesTable);
  const nums = existingInvoices
    .map((r) => r.number)
    .filter((n): n is string => !!n && n.startsWith("INV-"))
    .map((n) => parseInt(n.replace("INV-", ""), 10))
    .filter((n) => !isNaN(n));
  const newNumber = `INV-${nums.length > 0 ? Math.max(...nums) + 1 : 1001}`;

  const [updated] = await db
    .update(invoicesTable)
    .set({
      invoiceType: "TAX_INVOICE",
      originalProformaNumber: existingInv.number,
      number: newNumber,
      proformaConvertedAt: new Date(),
      status: "SENT",
      updatedAt: new Date(),
    })
    .where(eq(invoicesTable.id, req.params.id as string))
    .returning();

  return res.json(updated);
}));

// Record payment & track delayed payment behaviour
router.patch("/:id/payment", requirePermission("invoices.edit"), asyncHandler(async (req, res) => {
  if (!isValidUUID(req.params.id)) {
    throw createError("Invalid invoice ID format", 400);
  }

  const { paymentStatus, delayedDays, paymentNotes } = req.body;
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, req.params.id as string));
  if (!inv) throw createError("Invoice not found", 404);

  const isDelayed = paymentStatus === "DELAYED_PAYMENT" || Number(delayedDays) > 0;
  const finalStatus = paymentStatus === "PAID" ? "PAID" : isDelayed ? "SENT" : inv.status;

  const [updated] = await db
    .update(invoicesTable)
    .set({
      paymentStatus: paymentStatus || inv.paymentStatus,
      status: finalStatus,
      delayedDays: delayedDays !== undefined ? Number(delayedDays) : inv.delayedDays,
      paymentNotes: paymentNotes !== undefined ? paymentNotes : inv.paymentNotes,
      updatedAt: new Date(),
    })
    .where(eq(invoicesTable.id, req.params.id as string))
    .returning();

  // If this invoice had delayed payment and is linked to a client, update client's payment behavior
  if (inv.clientId && isDelayed) {
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, inv.clientId));
    if (client) {
      const currentDelayCount = parseInt(client.delayCount || "0", 10) + 1;
      const newBehavior = currentDelayCount > 1 ? "FREQUENT_DELAYED" : "ONE_TIME_DELAYED";
      await db
        .update(clientsTable)
        .set({
          delayCount: String(currentDelayCount),
          paymentBehavior: newBehavior,
          updatedAt: new Date(),
        })
        .where(eq(clientsTable.id, inv.clientId));
    }
  }

  return res.json(updated);
}));

router.patch("/:id", requirePermission("invoices.edit"), asyncHandler(async (req, res) => {
  if (!isValidUUID(req.params.id)) {
    throw createError("Invalid invoice ID format", 400);
  }
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeInvoice(body, true);
  const row = await syncParentUpdate(invoiceSyncConfig, req.params.id as string, sanitized, req.body);
  if (!row) throw createError("Not found", 404);
  return res.json(row);
}));

router.delete("/:id", requirePermission("invoices.delete"), asyncHandler(async (req, res) => {
  if (!isValidUUID(req.params.id)) {
    throw createError("Invalid invoice ID format", 400);
  }
  await db.delete(invoicesTable).where(eq(invoicesTable.id, (req.params.id as string)));
  return res.status(204).send();
}));

export default router;
