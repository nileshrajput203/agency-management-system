import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, purchaseOrdersTable, employeeExpensesTable, clientsTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { requirePermission } from "../middleware/auth";

const router = Router();

router.get("/ledger-summary", requirePermission("invoices.view"), asyncHandler(async (_req, res) => {
  // 1. Fetch Invoices
  const invoices = await db
    .select({
      id: invoicesTable.id,
      number: invoicesTable.number,
      invoiceType: invoicesTable.invoiceType,
      clientId: invoicesTable.clientId,
      clientName: clientsTable.companyName,
      status: invoicesTable.status,
      paymentStatus: invoicesTable.paymentStatus,
      delayedDays: invoicesTable.delayedDays,
      invoiceDate: invoicesTable.invoiceDate,
      dueDate: invoicesTable.dueDate,
      subtotal: invoicesTable.subtotal,
      taxAmount: invoicesTable.taxAmount,
      cgstAmount: invoicesTable.cgstAmount,
      sgstAmount: invoicesTable.sgstAmount,
      igstAmount: invoicesTable.igstAmount,
      total: invoicesTable.total,
      companyGstin: invoicesTable.companyGstin,
      clientGstin: invoicesTable.clientGstin,
      gstType: invoicesTable.gstType,
    })
    .from(invoicesTable)
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id));

  // 2. Fetch Purchase Orders (Receipts Ledger)
  const purchaseOrders = await db
    .select()
    .from(purchaseOrdersTable);

  // 3. Fetch Employee Expenses
  const expenses = await db
    .select()
    .from(employeeExpensesTable);

  // --- Output GST (from client Tax Invoices only, excluding proforma) ---
  let outputTaxable = 0;
  let outputCgst = 0;
  let outputSgst = 0;
  let outputIgst = 0;
  let outputTotalTax = 0;
  let totalBilledRevenue = 0;

  // Delayed payment analytics
  let delayedInvoicesCount = 0;
  let delayedInvoicesAmount = 0;
  let totalOverdueDays = 0;
  const delayedClientsMap: Record<string, { clientName: string; count: number; totalAmount: number; maxDelay: number }> = {};

  for (const inv of invoices) {
    const isProforma = inv.invoiceType === "PROFORMA";
    const sub = Number(inv.subtotal) || 0;
    const tax = Number(inv.taxAmount) || 0;
    const tot = Number(inv.total) || 0;

    if (!isProforma) {
      outputTaxable += sub;
      outputTotalTax += tax;
      totalBilledRevenue += tot;

      const cgst = Number(inv.cgstAmount) || (inv.gstType === "CGST_SGST" ? tax / 2 : 0);
      const sgst = Number(inv.sgstAmount) || (inv.gstType === "CGST_SGST" ? tax / 2 : 0);
      const igst = Number(inv.igstAmount) || (inv.gstType === "IGST" ? tax : 0);

      outputCgst += cgst;
      outputSgst += sgst;
      outputIgst += igst;
    }

    // Check payment delays
    const isDelayed = inv.paymentStatus === "DELAYED_PAYMENT" || inv.status === "OVERDUE" || (Number(inv.delayedDays) > 0);
    if (isDelayed) {
      delayedInvoicesCount += 1;
      delayedInvoicesAmount += tot;
      const days = Number(inv.delayedDays) || 0;
      totalOverdueDays += days;

      const cId = inv.clientId || "unknown";
      const cName = inv.clientName || "Unnamed Client";
      if (!delayedClientsMap[cId]) {
        delayedClientsMap[cId] = { clientName: cName, count: 0, totalAmount: 0, maxDelay: 0 };
      }
      delayedClientsMap[cId].count += 1;
      delayedClientsMap[cId].totalAmount += tot;
      if (days > delayedClientsMap[cId].maxDelay) delayedClientsMap[cId].maxDelay = days;
    }
  }

  // --- Input GST from Vendor Purchase Orders / Receipts ---
  let inputTaxablePo = 0;
  let inputTaxPo = 0;
  let inputItcPo = 0;

  for (const po of purchaseOrders) {
    const sub = Number(po.subtotal) || 0;
    const tax = Number(po.taxAmount) || 0;
    inputTaxablePo += sub;
    inputTaxPo += tax;

    const itcEligible = po.itcEligible !== "false" && po.itcEligible !== false;
    if (itcEligible) {
      inputItcPo += tax;
    }
  }

  // --- Input GST from Employee Expenses ---
  let inputTaxableExp = 0;
  let inputTaxExp = 0;
  let inputItcExp = 0;

  for (const exp of expenses) {
    if (exp.status === "APPROVED" || exp.status === "REIMBURSED") {
      const taxable = Number(exp.taxableAmount) || 0;
      const tax = Number(exp.taxAmount) || 0;
      inputTaxableExp += taxable;
      inputTaxExp += tax;

      if (exp.itcEligible) {
        inputItcExp += tax;
      }
    }
  }

  const totalInputTaxCredit = Number((inputItcPo + inputItcExp).toFixed(2));
  const netGstPayable = Number(Math.max(0, outputTotalTax - totalInputTaxCredit).toFixed(2));
  const excessItc = Number(Math.max(0, totalInputTaxCredit - outputTotalTax).toFixed(2));

  return res.json({
    outputGst: {
      totalRevenue: Number(totalBilledRevenue.toFixed(2)),
      taxableAmount: Number(outputTaxable.toFixed(2)),
      cgst: Number(outputCgst.toFixed(2)),
      sgst: Number(outputSgst.toFixed(2)),
      igst: Number(outputIgst.toFixed(2)),
      totalOutputTax: Number(outputTotalTax.toFixed(2)),
    },
    inputGst: {
      fromPurchaseOrders: {
        taxable: Number(inputTaxablePo.toFixed(2)),
        taxPaid: Number(inputTaxPo.toFixed(2)),
        itcEligible: Number(inputItcPo.toFixed(2)),
      },
      fromEmployeeExpenses: {
        taxable: Number(inputTaxableExp.toFixed(2)),
        taxPaid: Number(inputTaxExp.toFixed(2)),
        itcEligible: Number(inputItcExp.toFixed(2)),
      },
      totalItcClaimable: totalInputTaxCredit,
    },
    netGstLiability: {
      outputGstCollected: Number(outputTotalTax.toFixed(2)),
      eligibleInputTaxCredit: totalInputTaxCredit,
      netPayableToGovernment: netGstPayable,
      excessCreditCarryForward: excessItc,
    },
    delayedPayments: {
      delayedCount: delayedInvoicesCount,
      delayedAmount: Number(delayedInvoicesAmount.toFixed(2)),
      averageDelayDays: delayedInvoicesCount > 0 ? Math.round(totalOverdueDays / delayedInvoicesCount) : 0,
      delayedClients: Object.values(delayedClientsMap),
    },
  });
}));

export default router;
