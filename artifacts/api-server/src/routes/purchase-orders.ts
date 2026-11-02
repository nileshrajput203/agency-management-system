import { Router } from "express";
import { db } from "@workspace/db";
import { purchaseOrdersTable, purchaseOrderItemsTable, clientsTable } from "@workspace/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { syncParentInsert, syncParentUpdate } from "../lib/dbSync";
import { sanitizeAndValidate, validateLineItems, isValidUUID } from "../lib/validation";
import { requirePermission } from "../middleware/auth";

const router = Router();

function sanitizePurchaseOrder(body: any, isUpdate = false) {
  validateLineItems(body, "PurchaseOrders");
  return sanitizeAndValidate(body, {
    uuids: ["clientId", "vendorId"],
    textDates: ["orderDate", "deliveryDate", "receiptDate"],
    numbers: ["subtotal", "taxAmount", "total", "cgstAmount", "sgstAmount", "igstAmount"],
    enums: {
      status: ["DRAFT", "SENT", "APPROVED", "ORDERED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
      paymentMode: ["BANK_TRANSFER", "UPI", "CREDIT_CARD", "CASH", "CHEQUE", "OTHER"],
    }
  });
}

const poSyncConfig = {
  parentTable: purchaseOrdersTable,
  childTable: purchaseOrderItemsTable,
  foreignKeyField: "purchaseOrderId",
  payloadKeys: ["lineItems", "items"],
  mapItem: (item: any, parentId: string) => ({
    purchaseOrderId: parentId,
    description: item.description || "",
    hsnSac: item.hsnSac || null,
    qty: item.qty !== undefined ? Number(item.qty) : 1,
    unitPrice: item.unitPrice !== undefined ? Number(item.unitPrice) : 0,
    taxPercent: item.taxPercent !== undefined ? Number(item.taxPercent) : 18,
    createdBy: item.createdBy || null,
    updatedBy: item.updatedBy || null,
  }),
};

const PO_COLS = {
  id: purchaseOrdersTable.id,
  number: purchaseOrdersTable.number,
  clientId: purchaseOrdersTable.clientId,
  clientName: clientsTable.companyName,
  vendorId: purchaseOrdersTable.vendorId,
  status: purchaseOrdersTable.status,
  orderDate: purchaseOrdersTable.orderDate,
  deliveryDate: purchaseOrdersTable.deliveryDate,
  companyGstin: purchaseOrdersTable.companyGstin,
  vendorGstin: purchaseOrdersTable.vendorGstin,
  vendorNameSnapshot: purchaseOrdersTable.vendorNameSnapshot,
  billingAddress: purchaseOrdersTable.billingAddress,
  shippingAddress: purchaseOrdersTable.shippingAddress,
  subtotal: purchaseOrdersTable.subtotal,
  taxAmount: purchaseOrdersTable.taxAmount,
  cgstAmount: purchaseOrdersTable.cgstAmount,
  sgstAmount: purchaseOrdersTable.sgstAmount,
  igstAmount: purchaseOrdersTable.igstAmount,
  total: purchaseOrdersTable.total,
  receiptNumber: purchaseOrdersTable.receiptNumber,
  receiptUrl: purchaseOrdersTable.receiptUrl,
  receiptDate: purchaseOrdersTable.receiptDate,
  itcEligible: purchaseOrdersTable.itcEligible,
  paymentMode: purchaseOrdersTable.paymentMode,
  notes: purchaseOrdersTable.notes,
  termsAndConditions: purchaseOrdersTable.termsAndConditions,
  lineItems: purchaseOrdersTable.lineItems,
  createdAt: purchaseOrdersTable.createdAt,
};

async function nextNumber() {
  const rows = await db.select({ id: purchaseOrdersTable.id }).from(purchaseOrdersTable);
  return `PO-${1001 + rows.length}`;
}

router.get("/", requirePermission("purchase_orders.view"), asyncHandler(async (req, res) => {
  const rows = await db
    .select(PO_COLS)
    .from(purchaseOrdersTable)
    .leftJoin(clientsTable, eq(purchaseOrdersTable.clientId, clientsTable.id))
    .orderBy(desc(purchaseOrdersTable.createdAt));
  return res.json(rows);
}));

router.post("/", requirePermission("purchase_orders.create"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizePurchaseOrder(body, false);
  if (!sanitized.number) sanitized.number = await nextNumber();
  const row = await syncParentInsert(poSyncConfig, sanitized, req.body);
  return res.status(201).json(row);
}));

router.get("/:id", requirePermission("purchase_orders.view"), asyncHandler(async (req, res) => {
  if (!isValidUUID(req.params.id)) {
    throw createError("Invalid purchase order ID format", 400);
  }
  const [row] = await db
    .select(PO_COLS)
    .from(purchaseOrdersTable)
    .leftJoin(clientsTable, eq(purchaseOrdersTable.clientId, clientsTable.id))
    .where(eq(purchaseOrdersTable.id, (req.params.id as string)));
  if (!row) throw createError("Not found", 404);
  return res.json(row);
}));

router.patch("/:id", requirePermission("purchase_orders.edit"), asyncHandler(async (req, res) => {
  if (!isValidUUID(req.params.id)) {
    throw createError("Invalid purchase order ID format", 400);
  }
  const { id: _id, createdAt: _ts, ...body } = req.body || {};
  const sanitized = sanitizePurchaseOrder(body, true);
  const row = await syncParentUpdate(poSyncConfig, req.params.id as string, sanitized, req.body);
  if (!row) throw createError("Not found", 404);
  return res.json(row);
}));

router.patch("/:id/receipt", requirePermission("purchase_orders.edit"), asyncHandler(async (req, res) => {
  if (!isValidUUID(req.params.id)) {
    throw createError("Invalid purchase order ID format", 400);
  }
  const { receiptNumber, receiptUrl, receiptDate, itcEligible, paymentMode, vendorGstin, vendorNameSnapshot } = req.body;

  const [row] = await db
    .update(purchaseOrdersTable)
    .set({
      receiptNumber: receiptNumber || null,
      receiptUrl: receiptUrl || null,
      receiptDate: receiptDate || null,
      itcEligible: itcEligible !== undefined ? String(itcEligible) : "true",
      paymentMode: paymentMode || null,
      vendorGstin: vendorGstin || undefined,
      vendorNameSnapshot: vendorNameSnapshot || undefined,
      status: "RECEIVED",
      updatedAt: new Date(),
    })
    .where(eq(purchaseOrdersTable.id, req.params.id as string))
    .returning();

  if (!row) throw createError("Not found", 404);
  return res.json(row);
}));

router.delete("/:id", requirePermission("purchase_orders.delete"), asyncHandler(async (req, res) => {
  if (!isValidUUID(req.params.id)) {
    throw createError("Invalid purchase order ID format", 400);
  }
  await db.delete(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, (req.params.id as string)));
  return res.status(204).send();
}));

export default router;
