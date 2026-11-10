import { Router } from "express";
import { db } from "@workspace/db";
import {
  invoicesTable,
  invoiceItemsTable,
  clientsTable,
  paymentsTable,
  employeeExpensesTable,
  agencySettings,
} from "@workspace/db/schema";
import { eq, desc, sql, and, isNull } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { syncParentInsert, syncParentUpdate } from "../lib/dbSync";
import { sanitizeAndValidate, validateLineItems, isValidUUID } from "../lib/validation";
import { requirePermission } from "../middleware/auth";
import { generateInvoiceMasterExcel } from "../lib/invoiceMasterExcel";
import { generateInvoiceMasterPdf } from "../lib/invoiceMasterPdf";

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

// GET /api/invoices/next-number â€” auto-increment sequential invoice number
router.get("/next-number", requirePermission("invoices.view"), asyncHandler(async (req, res) => {
  const type = (req.query.type as string) || "TAX_INVOICE";
  const isProforma = type === "PROFORMA";

  const rows = await db
    .select({ number: invoicesTable.number, invoiceType: invoicesTable.invoiceType })
    .from(invoicesTable)
    .where(isNull(invoicesTable.deletedAt));

  const nums = rows
    .filter((r) => (isProforma ? r.invoiceType === "PROFORMA" : r.invoiceType !== "PROFORMA"))
    .map((r) => r.number)
    .filter((n): n is string => !!n)
    .map((n) => {
      const match = n.match(/\d+/);
      return match ? parseInt(match[0], 10) : NaN;
    })
    .filter((n) => !isNaN(n) && n < 1000); // Filter out anomalies

  const maxNum = nums.length > 0 ? Math.max(...nums) : 3;
  const nextVal = Math.max(maxNum + 1, 4);
  const nextNumber = isProforma ? `PI-${String(nextVal).padStart(4, "0")}` : String(nextVal).padStart(4, "0");

  return res.json({ nextNumber });
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
      clientGstin: sql<string>`COALESCE(${invoicesTable.clientGstin}, ${clientsTable.gstin})`,
      billingAddress: sql<string>`COALESCE(${invoicesTable.billingAddress}, ${clientsTable.billingAddress})`,
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
      clientPhone: sql<string>`COALESCE(${invoicesTable.clientPhone}, ${clientsTable.phone})`,
      clientEmail: sql<string>`COALESCE(${invoicesTable.clientEmail}, ${clientsTable.email})`,
      clientPan: sql<string>`COALESCE(${invoicesTable.clientPan}, ${clientsTable.panNumber})`,
      clientCity: sql<string>`COALESCE(${invoicesTable.clientCity}, ${clientsTable.city})`,
      clientPostalCode: sql<string>`COALESCE(${invoicesTable.clientPostalCode}, ${clientsTable.postalCode})`,
      clientState: sql<string>`COALESCE(${invoicesTable.clientState}, ${clientsTable.state})`,
      gstType: invoicesTable.gstType,
      signatureUrl: invoicesTable.signatureUrl,
      discountType: invoicesTable.discountType,
    })
    .from(invoicesTable)
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .orderBy(desc(invoicesTable.createdAt));
  return res.json(rows);
}));

const BLINK_BEYOND_DEFAULTS = {
  businessName: "BLINK BEYOND",
  businessPhone: "+91 95455 56009",
  businessEmail: "support@blinkbeyond.co.in",
  businessAddress: "Ground Floor, Shop No. 07, Ali Chamber Apt., Manor Road, Near Kotak Mahindra Bank, Palghar West",
  businessCity: "Palghar",
  businessState: "Maharashtra",
  businessPostalCode: "401404",
  companyGstin: "27ABGFB9280J1Z0",
  businessPan: "ABGFB9280J",
  bankDetails: "HDFC BANK LIMITED\nA/C No: 50200121903920\nIFSC: HDFC0000663\nBranch: Palghar",
};

router.post("/", requirePermission("invoices.create"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeInvoice(body, false);
  const isProforma = sanitized.invoiceType === "PROFORMA";

  // Enforce Blink Beyond business details defaults
  for (const [k, v] of Object.entries(BLINK_BEYOND_DEFAULTS)) {
    if (!sanitized[k]) {
      sanitized[k] = v;
    }
  }

  // If number is missing or already taken, auto-calculate next sequential number
  const existingRows = await db
    .select({ number: invoicesTable.number, invoiceType: invoicesTable.invoiceType })
    .from(invoicesTable)
    .where(isNull(invoicesTable.deletedAt));

  const isTaken = sanitized.number && existingRows.some((r) => r.number === sanitized.number);

  if (!sanitized.number || isTaken) {
    const nums = existingRows
      .filter((r) => (isProforma ? r.invoiceType === "PROFORMA" : r.invoiceType !== "PROFORMA"))
      .map((r) => r.number)
      .filter((n): n is string => !!n)
      .map((n) => {
        const match = n.match(/\d+/);
        return match ? parseInt(match[0], 10) : NaN;
      })
      .filter((n) => !isNaN(n) && n < 1000);
    const maxNum = nums.length > 0 ? Math.max(...nums) : 3;
    const nextVal = Math.max(maxNum + 1, 4);
    sanitized.number = isProforma ? `PI-${String(nextVal).padStart(4, "0")}` : String(nextVal).padStart(4, "0");
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

  // Automatically persist client billing info back to clients table
  if (sanitized.clientId) {
    const clientUpdates: Record<string, any> = { updatedAt: new Date() };
    if (body.billingAddress) clientUpdates.billingAddress = body.billingAddress;
    if (body.clientAddress && !body.billingAddress) clientUpdates.billingAddress = body.clientAddress;
    if (body.clientCity) clientUpdates.city = body.clientCity;
    if (body.clientPostalCode) clientUpdates.postalCode = body.clientPostalCode;
    if (body.clientState) clientUpdates.state = body.clientState;
    if (body.placeOfSupply && !body.clientState) clientUpdates.state = body.placeOfSupply;
    if (body.clientGstin) clientUpdates.gstin = body.clientGstin;
    if (body.clientPan) clientUpdates.panNumber = body.clientPan;
    if (body.clientPhone) clientUpdates.phone = body.clientPhone;
    if (body.clientEmail) clientUpdates.email = body.clientEmail;
    if (body.shippingAddress) clientUpdates.shippingAddress = body.shippingAddress;

    if (Object.keys(clientUpdates).length > 1) {
      await db.update(clientsTable).set(clientUpdates).where(eq(clientsTable.id, sanitized.clientId));
    }
  }

  const row = await syncParentInsert(invoiceSyncConfig, sanitized, req.body);
  return res.status(201).json(row);
}));

// 1-Click Generate Monthly Retainer Invoices for all active clients
router.post("/generate-retainers", requirePermission("invoices.create"), asyncHandler(async (req, res) => {
  const activeClients = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.status, "ACTIVE"), sql`${clientsTable.monthlyRetainer} > 0`));

  if (activeClients.length === 0) {
    return res.json({ message: "No active clients with retainer amounts found", count: 0, invoices: [] });
  }

  const now = new Date();
  const currentMonthStr = now.toLocaleString("default", { month: "long", year: "numeric" });
  const invoiceDateStr = now.toISOString().split("T")[0];
  const dueDateStr = new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0];

  const existingInvoices = await db.select({ number: invoicesTable.number }).from(invoicesTable);
  const nums = existingInvoices
    .map((r) => r.number)
    .filter((n): n is string => !!n && n.startsWith("INV-"))
    .map((n) => parseInt(n.replace("INV-", ""), 10))
    .filter((n) => !isNaN(n));
  let nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1001;

  const generatedInvoices = [];

  for (const client of activeClients) {
    const retainerAmount = Number(client.monthlyRetainer) || 0;
    if (retainerAmount <= 0) continue;

    // Check for unbilled billable expenses
    const unbilledExpenses = await db
      .select()
      .from(employeeExpensesTable)
      .where(and(eq(employeeExpensesTable.clientId, client.id), eq(employeeExpensesTable.reimbursable, true), eq(employeeExpensesTable.status, "APPROVED")));

    const expenseSubtotal = unbilledExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const subtotal = retainerAmount + expenseSubtotal;

    // Check tax type based on GSTIN state codes
    const clientGstin = client.gstin || "";
    const isInterstate = clientGstin && clientGstin.length >= 2 && clientGstin.slice(0, 2) !== "27"; // Default agency state 27 (MH)
    const gstType = isInterstate ? "IGST" : "CGST_SGST";
    const taxRate = 18;
    const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
    const total = subtotal + taxAmount;

    const cgstAmount = isInterstate ? 0 : Number((taxAmount / 2).toFixed(2));
    const sgstAmount = isInterstate ? 0 : Number((taxAmount / 2).toFixed(2));
    const igstAmount = isInterstate ? taxAmount : 0;

    const invNum = `INV-${nextNum++}`;

    const [created] = await db
      .insert(invoicesTable)
      .values({
        number: invNum,
        clientId: client.id,
        invoiceType: "TAX_INVOICE",
        status: "DRAFT",
        paymentStatus: "PENDING",
        invoiceDate: invoiceDateStr,
        dueDate: dueDateStr,
        currency: "INR",
        gstType,
        clientGstin: client.gstin || null,
        clientPhone: client.phone || null,
        clientEmail: client.email || null,
        subtotal,
        taxAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        total,
        notes: `Monthly Retainer billing for ${currentMonthStr}.\nDeliverable Quotas: Active in AgencyOS Client Workspace.`,
      })
      .returning();

    // Insert line item for retainer
    await db.insert(invoiceItemsTable).values({
      invoiceId: created.id,
      description: `Monthly Digital Marketing & Creative Retainer (${currentMonthStr})`,
      qty: 1,
      unitPrice: retainerAmount,
      taxPercent: taxRate,
    });

    // Insert line items for unbilled expenses if any
    for (const exp of unbilledExpenses) {
      await db.insert(invoiceItemsTable).values({
        invoiceId: created.id,
        description: `Reimbursable Expense: ${exp.description || exp.category}`,
        qty: 1,
        unitPrice: Number(exp.amount),
        taxPercent: taxRate,
      });
      // Mark expense as billed/reimbursed
      await db.update(employeeExpensesTable).set({ status: "REIMBURSED", reimbursedAt: new Date() }).where(eq(employeeExpensesTable.id, exp.id));
    }

    generatedInvoices.push(created);
  }

  return res.status(201).json({
    message: `Generated ${generatedInvoices.length} monthly retainer invoices.`,
    count: generatedInvoices.length,
    invoices: generatedInvoices,
  });
}));

// Convert Proforma Invoice to Tax Invoice
router.post("/:id/convert-to-tax-invoice", requirePermission("invoices.edit"), asyncHandler(async (req, res) => {
  if (!isValidUUID(req.params.id as string)) {
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
  if (!isValidUUID(req.params.id as string)) {
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
  if (!isValidUUID(req.params.id as string)) {
    throw createError("Invalid invoice ID format", 400);
  }
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeInvoice(body, true);

  if (sanitized.clientId) {
    const clientUpdates: Record<string, any> = { updatedAt: new Date() };
    if (body.billingAddress) clientUpdates.billingAddress = body.billingAddress;
    if (body.clientAddress && !body.billingAddress) clientUpdates.billingAddress = body.clientAddress;
    if (body.clientCity) clientUpdates.city = body.clientCity;
    if (body.clientPostalCode) clientUpdates.postalCode = body.clientPostalCode;
    if (body.clientState) clientUpdates.state = body.clientState;
    if (body.placeOfSupply && !body.clientState) clientUpdates.state = body.placeOfSupply;
    if (body.clientGstin) clientUpdates.gstin = body.clientGstin;
    if (body.clientPan) clientUpdates.panNumber = body.clientPan;
    if (body.clientPhone) clientUpdates.phone = body.clientPhone;
    if (body.clientEmail) clientUpdates.email = body.clientEmail;
    if (body.shippingAddress) clientUpdates.shippingAddress = body.shippingAddress;

    if (Object.keys(clientUpdates).length > 1) {
      await db.update(clientsTable).set(clientUpdates).where(eq(clientsTable.id, sanitized.clientId));
    }
  }

  const row = await syncParentUpdate(invoiceSyncConfig, req.params.id as string, sanitized, req.body);
  if (!row) throw createError("Not found", 404);
  return res.json(row);
}));

router.delete("/:id", requirePermission("invoices.delete"), asyncHandler(async (req, res) => {
  if (!isValidUUID(req.params.id as string)) {
    throw createError("Invalid invoice ID format", 400);
  }
  await db.delete(invoicesTable).where(eq(invoicesTable.id, (req.params.id as string)));
  return res.status(204).send();
}));

// GET /api/invoices/:id/payments — list all recorded payments & TDS
router.get("/:id/payments", requirePermission("invoices.view"), asyncHandler(async (req, res) => {
  const invoiceId = req.params.id as string;
  if (!isValidUUID(invoiceId)) throw createError("Invalid invoice ID format", 400);

  const rows = await db
    .select()
    .from(paymentsTable)
    .where(and(eq(paymentsTable.invoiceId, invoiceId), isNull(paymentsTable.deletedAt)))
    .orderBy(desc(paymentsTable.paymentDate));

  const [inv] = await db.select({ total: invoicesTable.total }).from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  const totalPaid = rows.reduce((acc, p) => acc + (Number(p.amount) || 0) + (Number(p.tdsAmount) || 0), 0);
  const remaining = Math.max(0, (Number(inv?.total) || 0) - totalPaid);

  return res.json({
    payments: rows,
    totalPaid,
    remaining,
    invoiceTotal: Number(inv?.total) || 0,
  });
}));

// POST /api/invoices/:id/payments — record payment with optional TDS and auto-update invoice status
router.post("/:id/payments", requirePermission("invoices.edit"), asyncHandler(async (req, res) => {
  const invoiceId = req.params.id as string;
  if (!isValidUUID(invoiceId)) throw createError("Invalid invoice ID format", 400);

  const { amount, tdsAmount = 0, paymentMethod = "BANK_TRANSFER", referenceNumber, paymentDate, notes } = req.body || {};

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw createError("Payment amount must be greater than zero", 400);
  }

  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId));
  if (!inv) throw createError("Invoice not found", 404);

  const numTds = Number(tdsAmount) || 0;

  const [payment] = await db
    .insert(paymentsTable)
    .values({
      invoiceId,
      amount: numAmount,
      tdsAmount: numTds,
      paymentMethod,
      referenceNumber: referenceNumber || null,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      status: "SUCCESS",
      notes: notes || null,
      createdBy: (req as any).userId,
    })
    .returning();

  // Sum up all payments for this invoice
  const allPayments = await db
    .select({ amount: paymentsTable.amount, tdsAmount: paymentsTable.tdsAmount })
    .from(paymentsTable)
    .where(and(eq(paymentsTable.invoiceId, invoiceId), isNull(paymentsTable.deletedAt)));

  const totalCollected = allPayments.reduce((sum, p) => sum + (Number(p.amount) || 0) + (Number(p.tdsAmount) || 0), 0);
  const invoiceTotal = Number(inv.total) || 0;

  let newPaymentStatus = "PENDING";
  let newStatus = inv.status;

  if (totalCollected >= invoiceTotal) {
    newPaymentStatus = "PAID";
    newStatus = "PAID";
  } else if (totalCollected > 0) {
    newPaymentStatus = "PARTIALLY_PAID";
  }

  await db
    .update(invoicesTable)
    .set({
      status: newStatus,
      paymentStatus: newPaymentStatus,
      updatedAt: new Date(),
    })
    .where(eq(invoicesTable.id, invoiceId));

  return res.status(201).json({
    payment,
    totalCollected,
    remaining: Math.max(0, invoiceTotal - totalCollected),
    status: newStatus,
    paymentStatus: newPaymentStatus,
  });
}));

// POST /api/invoices/export-excel
router.post("/export-excel", requirePermission("invoices.view"), asyncHandler(async (req, res) => {
  const inv = req.body;
  if (!inv) throw createError("Missing invoice data", 400);

  const excelBuffer = generateInvoiceMasterExcel(inv);
  const invNumber = inv.number || inv.invoiceNumber || "INV";
  const clientName = (inv.clientName || "Client").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `Invoice_${invNumber}_${clientName}.xlsx`;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", excelBuffer.length);
  return res.send(excelBuffer);
}));

// GET /api/invoices/:id/excel
router.get("/:id/excel", requirePermission("invoices.view"), asyncHandler(async (req, res) => {
  const invoiceId = req.params.id as string;
  if (!isValidUUID(invoiceId)) throw createError("Invalid invoice ID format", 400);

  const [row] = await db
    .select({
      id: invoicesTable.id,
      number: invoicesTable.number,
      invoiceType: invoicesTable.invoiceType,
      clientId: invoicesTable.clientId,
      clientName: clientsTable.companyName,
      status: invoicesTable.status,
      paymentStatus: invoicesTable.paymentStatus,
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
      clientGstin: sql<string>`COALESCE(${invoicesTable.clientGstin}, ${clientsTable.gstin})`,
      billingAddress: sql<string>`COALESCE(${invoicesTable.billingAddress}, ${clientsTable.billingAddress})`,
      shippingAddress: invoicesTable.shippingAddress,
      clientPhone: sql<string>`COALESCE(${invoicesTable.clientPhone}, ${clientsTable.phone})`,
      clientEmail: sql<string>`COALESCE(${invoicesTable.clientEmail}, ${clientsTable.email})`,
      clientPan: sql<string>`COALESCE(${invoicesTable.clientPan}, ${clientsTable.panNumber})`,
      clientCity: sql<string>`COALESCE(${invoicesTable.clientCity}, ${clientsTable.city})`,
      clientPostalCode: sql<string>`COALESCE(${invoicesTable.clientPostalCode}, ${clientsTable.postalCode})`,
      clientState: sql<string>`COALESCE(${invoicesTable.clientState}, ${clientsTable.state})`,
      gstType: invoicesTable.gstType,
    })
    .from(invoicesTable)
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .where(and(eq(invoicesTable.id, invoiceId), isNull(invoicesTable.deletedAt)));

  if (!row) throw createError("Invoice not found", 404);

  const excelBuffer = generateInvoiceMasterExcel(row);
  const invNumber = row.number || "INV";
  const clientName = (row.clientName || "Client").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `Invoice_${invNumber}_${clientName}.xlsx`;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", excelBuffer.length);
  return res.send(excelBuffer);
}));

// POST /api/invoices/export-pdf
router.post("/export-pdf", requirePermission("invoices.view"), asyncHandler(async (req, res) => {
  const inv = req.body;
  if (!inv) throw createError("Missing invoice data", 400);

  const pdfBuffer = await generateInvoiceMasterPdf(inv);
  const invNumber = inv.number || inv.invoiceNumber || "0003";
  const clientName = (inv.clientName || "Client").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `Invoice_${invNumber}_${clientName}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", pdfBuffer.length);
  return res.send(pdfBuffer);
}));

// GET /api/invoices/:id/pdf
router.get("/:id/pdf", requirePermission("invoices.view"), asyncHandler(async (req, res) => {
  const invoiceId = req.params.id as string;
  if (!isValidUUID(invoiceId)) throw createError("Invalid invoice ID format", 400);

  const [row] = await db
    .select({
      id: invoicesTable.id,
      number: invoicesTable.number,
      invoiceType: invoicesTable.invoiceType,
      clientId: invoicesTable.clientId,
      clientName: clientsTable.companyName,
      status: invoicesTable.status,
      paymentStatus: invoicesTable.paymentStatus,
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
      clientGstin: sql<string>`COALESCE(${invoicesTable.clientGstin}, ${clientsTable.gstin})`,
      billingAddress: sql<string>`COALESCE(${invoicesTable.billingAddress}, ${clientsTable.billingAddress})`,
      shippingAddress: invoicesTable.shippingAddress,
      clientPhone: sql<string>`COALESCE(${invoicesTable.clientPhone}, ${clientsTable.phone})`,
      clientEmail: sql<string>`COALESCE(${invoicesTable.clientEmail}, ${clientsTable.email})`,
      clientPan: sql<string>`COALESCE(${invoicesTable.clientPan}, ${clientsTable.panNumber})`,
      clientCity: sql<string>`COALESCE(${invoicesTable.clientCity}, ${clientsTable.city})`,
      clientPostalCode: sql<string>`COALESCE(${invoicesTable.clientPostalCode}, ${clientsTable.postalCode})`,
      clientState: sql<string>`COALESCE(${invoicesTable.clientState}, ${clientsTable.state})`,
      gstType: invoicesTable.gstType,
    })
    .from(invoicesTable)
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id))
    .where(and(eq(invoicesTable.id, invoiceId), isNull(invoicesTable.deletedAt)));

  if (!row) throw createError("Invoice not found", 404);

  const pdfBuffer = await generateInvoiceMasterPdf(row);
  const invNumber = row.number || "0003";
  const clientName = (row.clientName || "Client").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `Invoice_${invNumber}_${clientName}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", pdfBuffer.length);
  return res.send(pdfBuffer);
}));

export default router;
