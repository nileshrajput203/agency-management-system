import { Router } from "express";
import { db } from "@workspace/db";
import { employeeExpensesTable, usersTable, clientsTable, projectsTable } from "@workspace/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate, isValidUUID } from "../lib/validation";
import { requirePermission } from "../middleware/auth";

const router = Router();

const EXPENSE_CATEGORIES = [
  "TRAVEL",
  "FOOD_MEALS",
  "SHOOT_LOGISTICS",
  "EQUIPMENT_RENTAL",
  "SOFTWARE_LICENSES",
  "OFFICE_SUPPLIES",
  "CLIENT_ENTERTAINMENT",
  "MARKETING_ADS",
  "OTHER",
];

const EXPENSE_STATUSES = ["SUBMITTED", "APPROVED", "REJECTED", "REIMBURSED"];

function sanitizeExpense(body: any) {
  return sanitizeAndValidate(body, {
    uuids: ["clientId", "projectId", "vendorId"],
    textDates: ["spendDate"],
    numbers: ["amount", "taxableAmount", "taxPercent", "taxAmount"],
    enums: {
      category: EXPENSE_CATEGORIES,
      status: EXPENSE_STATUSES,
      gstType: ["CGST_SGST", "IGST", "UTGST", "NONE"],
    },
  });
}

// Summary for accounting & dashboard
router.get("/summary", requirePermission("invoices.view"), asyncHandler(async (_req, res) => {
  const expenses = await db.select().from(employeeExpensesTable);

  let totalExpenses = 0;
  let approvedExpenses = 0;
  let pendingExpenses = 0;
  let reimbursedExpenses = 0;
  let totalItcClaimable = 0;
  let totalTaxPaid = 0;

  for (const exp of expenses) {
    const amt = Number(exp.amount) || 0;
    const tax = Number(exp.taxAmount) || 0;
    totalExpenses += amt;
    totalTaxPaid += tax;

    if (exp.itcEligible && (exp.status === "APPROVED" || exp.status === "REIMBURSED")) {
      totalItcClaimable += tax;
    }

    if (exp.status === "APPROVED") approvedExpenses += amt;
    else if (exp.status === "SUBMITTED") pendingExpenses += amt;
    else if (exp.status === "REIMBURSED") reimbursedExpenses += amt;
  }

  return res.json({
    totalExpenses,
    approvedExpenses,
    pendingExpenses,
    reimbursedExpenses,
    totalItcClaimable,
    totalTaxPaid,
    count: expenses.length,
  });
}));

// List expenses with employee and project info
router.get("/", requirePermission("invoices.view"), asyncHandler(async (req, res) => {
  const { category, status, userId } = req.query as Record<string, string>;
  const conditions = [];

  if (category) conditions.push(eq(employeeExpensesTable.category, category));
  if (status) conditions.push(eq(employeeExpensesTable.status, status));
  if (userId) conditions.push(eq(employeeExpensesTable.userId, userId));

  const rows = await db
    .select({
      id: employeeExpensesTable.id,
      userId: employeeExpensesTable.userId,
      employeeName: usersTable.name,
      employeeEmail: usersTable.email,
      clientId: employeeExpensesTable.clientId,
      clientName: clientsTable.companyName,
      projectId: employeeExpensesTable.projectId,
      projectName: projectsTable.name,
      category: employeeExpensesTable.category,
      description: employeeExpensesTable.description,
      spendDate: employeeExpensesTable.spendDate,
      vendorName: employeeExpensesTable.vendorName,
      vendorGstin: employeeExpensesTable.vendorGstin,
      amount: employeeExpensesTable.amount,
      taxableAmount: employeeExpensesTable.taxableAmount,
      taxPercent: employeeExpensesTable.taxPercent,
      taxAmount: employeeExpensesTable.taxAmount,
      gstType: employeeExpensesTable.gstType,
      itcEligible: employeeExpensesTable.itcEligible,
      reimbursable: employeeExpensesTable.reimbursable,
      receiptReference: employeeExpensesTable.receiptReference,
      status: employeeExpensesTable.status,
      rejectionReason: employeeExpensesTable.rejectionReason,
      notes: employeeExpensesTable.notes,
      approvedAt: employeeExpensesTable.approvedAt,
      reimbursedAt: employeeExpensesTable.reimbursedAt,
      submittedAt: employeeExpensesTable.submittedAt,
      createdAt: employeeExpensesTable.createdAt,
    })
    .from(employeeExpensesTable)
    .leftJoin(usersTable, eq(employeeExpensesTable.userId, usersTable.id))
    .leftJoin(clientsTable, eq(employeeExpensesTable.clientId, clientsTable.id))
    .leftJoin(projectsTable, eq(employeeExpensesTable.projectId, projectsTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(employeeExpensesTable.spendDate), desc(employeeExpensesTable.createdAt));

  return res.json(rows);
}));

// Create expense
router.post("/", asyncHandler(async (req, res) => {
  const currentUserId = (req as any).userId;
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeExpense(body);

  if (!sanitized.description) {
    throw createError("Description is required", 400);
  }
  if (!sanitized.amount || Number(sanitized.amount) <= 0) {
    throw createError("Valid amount is required", 400);
  }

  const amt = Number(sanitized.amount);
  const taxPct = Number(sanitized.taxPercent) || 0;
  let taxAmt = Number(sanitized.taxAmount) || 0;
  let taxable = Number(sanitized.taxableAmount) || 0;

  if (taxPct > 0 && taxAmt === 0) {
    taxAmt = Number(((amt * taxPct) / (100 + taxPct)).toFixed(2));
    taxable = Number((amt - taxAmt).toFixed(2));
  } else if (taxable === 0) {
    taxable = amt;
  }

  const [row] = await db
    .insert(employeeExpensesTable)
    .values({
      userId: body.userId || currentUserId,
      clientId: sanitized.clientId || null,
      projectId: sanitized.projectId || null,
      vendorId: sanitized.vendorId || null,
      category: sanitized.category || "OTHER",
      description: sanitized.description,
      spendDate: sanitized.spendDate || new Date().toISOString().split("T")[0],
      vendorName: sanitized.vendorName || null,
      vendorGstin: sanitized.vendorGstin || null,
      amount: String(amt),
      taxableAmount: String(taxable),
      taxPercent: String(taxPct),
      taxAmount: String(taxAmt),
      gstType: sanitized.gstType || "CGST_SGST",
      itcEligible: Boolean(body.itcEligible),
      reimbursable: body.reimbursable !== undefined ? Boolean(body.reimbursable) : true,
      receiptReference: sanitized.receiptReference || null,
      status: "SUBMITTED",
      notes: sanitized.notes || null,
    })
    .returning();

  return res.status(201).json(row);
}));

// Approve expense
router.patch("/:id/approve", requirePermission("invoices.edit"), asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  if (!isValidUUID(id)) throw createError("Invalid expense ID", 400);
  const currentUserId = (req as any).userId;

  const [row] = await db
    .update(employeeExpensesTable)
    .set({
      status: "APPROVED",
      approvedBy: currentUserId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(employeeExpensesTable.id, id))
    .returning();

  if (!row) throw createError("Expense not found", 404);
  return res.json(row);
}));

// Reject expense
router.patch("/:id/reject", requirePermission("invoices.edit"), asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  if (!isValidUUID(id)) throw createError("Invalid expense ID", 400);

  const { rejectionReason } = req.body;
  const [row] = await db
    .update(employeeExpensesTable)
    .set({
      status: "REJECTED",
      rejectionReason: rejectionReason || "Rejected by manager/accountant",
      updatedAt: new Date(),
    })
    .where(eq(employeeExpensesTable.id, id))
    .returning();

  if (!row) throw createError("Expense not found", 404);
  return res.json(row);
}));

// Mark reimbursed
router.patch("/:id/reimburse", requirePermission("invoices.edit"), asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  if (!isValidUUID(id)) throw createError("Invalid expense ID", 400);

  const [row] = await db
    .update(employeeExpensesTable)
    .set({
      status: "REIMBURSED",
      reimbursedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(employeeExpensesTable.id, id))
    .returning();

  if (!row) throw createError("Expense not found", 404);
  return res.json(row);
}));

// Delete expense
router.delete("/:id", requirePermission("invoices.delete"), asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  if (!isValidUUID(id)) throw createError("Invalid expense ID", 400);

  await db.delete(employeeExpensesTable).where(eq(employeeExpensesTable.id, id));
  return res.status(204).send();
}));

export default router;
