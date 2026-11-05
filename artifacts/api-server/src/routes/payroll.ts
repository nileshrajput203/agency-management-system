import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, attendance, holidaysTable, leaveRequests, agencySettings } from "@workspace/db/schema";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { requirePermission, isManagerRole } from "../middleware/auth";

const router = Router();

// Helper to compute working days in a month (excluding Sundays & holidays)
async function getWorkingDaysInMonth(year: number, monthIndex: number): Promise<{ totalDays: number; workingDays: number; holidayDates: Set<string> }> {
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const holidays = await db.select().from(holidaysTable);
  const holidayDates = new Set(holidays.map(h => h.date));

  let workingDays = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dateObj = new Date(year, monthIndex, d);
    const dayOfWeek = dateObj.getDay();
    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    // Sunday (0) is weekend off; holidays are non-working
    if (dayOfWeek !== 0 && !holidayDates.has(dateStr)) {
      workingDays++;
    }
  }

  return { totalDays, workingDays: workingDays || 26, holidayDates };
}

// GET /api/payroll/summary?month=YYYY-MM — monthly payroll register
router.get("/summary", requirePermission("users.view"), asyncHandler(async (req, res) => {
  const targetMonth = (req.query.month as string) || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()).slice(0, 7);
  const [yearStr, monthStr] = targetMonth.split("-");
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1;

  if (isNaN(year) || isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw createError("Invalid month format. Expected YYYY-MM", 400);
  }

  const { totalDays, workingDays } = await getWorkingDaysInMonth(year, monthIndex);

  const requesterId = (req as any).userId;
  const requesterSystemRole = (req as any).userSystemRole;
  const requesterRole = (req as any).userRole;
  const isDelegatedAdmin = Boolean((req as any).userIsDelegatedAdmin);
  const isManager =
    isManagerRole(requesterSystemRole) ||
    isManagerRole(requesterRole) ||
    isDelegatedAdmin ||
    requesterSystemRole === "SUPER_ADMIN" ||
    ((req as any).userConfiguredModules || []).includes("finance");

  const employeeFilters = [eq(usersTable.isActive, true)];
  if (!isManager) {
    employeeFilters.push(eq(usersTable.id, requesterId));
  }

  const activeEmployees = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      systemRole: usersTable.systemRole,
      designation: usersTable.designation,
      monthlySalary: usersTable.monthlySalary,
      hourlyCostRate: usersTable.hourlyCostRate,
      bankAccountNo: usersTable.bankAccountNo,
      bankIfsc: usersTable.bankIfsc,
      panNumber: usersTable.panNumber,
    })
    .from(usersTable)
    .where(and(...employeeFilters));

  const startDateStr = `${targetMonth}-01`;
  const endDateStr = `${targetMonth}-${String(totalDays).padStart(2, "0")}`;

  const payrollSummary = [];

  for (const emp of activeEmployees) {
    const monthlySalary = Number(emp.monthlySalary) || 0;
    const dailyRate = workingDays > 0 ? monthlySalary / workingDays : 0;
    const hourlyRate = Number(emp.hourlyCostRate) || (dailyRate > 0 ? dailyRate / 8 : 100);

    // Fetch employee attendance for this month
    const records = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.userId, emp.id),
          gte(attendance.date, startDateStr),
          lte(attendance.date, endDateStr)
        )
      );

    let presentDays = 0;
    let halfDays = 0;
    let paidLeaveDays = 0;
    let unpaidAbsentDays = 0;
    let totalOvertimeMin = 0;

    for (const r of records) {
      if (r.status === "PRESENT") presentDays++;
      else if (r.status === "HALF_DAY") halfDays++;
      else if (r.status === "ON_LEAVE" || r.status === "LEAVE") paidLeaveDays++;
      else if (r.status === "ABSENT") unpaidAbsentDays++;

      if (r.overtimeMin) totalOvertimeMin += Number(r.overtimeMin);
    }

    const effectivePresentDays = presentDays + halfDays * 0.5 + paidLeaveDays;
    const overtimeHours = Number((totalOvertimeMin / 60).toFixed(1));
    const overtimePay = Math.round(overtimeHours * hourlyRate * 1.5);
    const lopDeduction = Math.round(unpaidAbsentDays * dailyRate);
    const basePayEarned = Math.round(effectivePresentDays * dailyRate);
    const netPayable = Math.max(0, monthlySalary - lopDeduction + overtimePay);

    payrollSummary.push({
      userId: emp.id,
      name: emp.name,
      userName: emp.name,
      employeeName: emp.name,
      email: emp.email,
      designation: emp.designation || emp.role || "Team Member",
      role: emp.role,
      monthlySalary,
      baseSalary: monthlySalary,
      workingDays,
      totalDays: workingDays,
      totalDaysInMonth: totalDays,
      presentDays,
      halfDays,
      paidLeaveDays,
      unpaidAbsentDays,
      unpaidLeaves: unpaidAbsentDays,
      effectiveDays: effectivePresentDays,
      paidDays: Number(effectivePresentDays.toFixed(1)),
      overtimeHours,
      overtimePay,
      lopDeduction,
      basePayEarned,
      netPayable,
      netSalary: netPayable,
      bankAccountNo: emp.bankAccountNo ? `••••${emp.bankAccountNo.slice(-4)}` : "Not provided",
      bankIfsc: emp.bankIfsc || "N/A",
      panNumber: emp.panNumber || "N/A",
    });
  }

  return res.json({
    month: targetMonth,
    workingDaysInMonth: workingDays,
    totalDaysInMonth: totalDays,
    employeeCount: payrollSummary.length,
    totalOutflow: payrollSummary.reduce((acc, p) => acc + p.netPayable, 0),
    totalGrossPayout: payrollSummary.reduce((acc, p) => acc + p.netPayable, 0),
    employees: payrollSummary,
  });
}));

// GET /api/payroll/:userId/payslip-pdf?month=YYYY-MM — printable salary slip view
router.get("/:userId/payslip-pdf", requirePermission("users.view"), asyncHandler(async (req, res) => {
  const userId = req.params.userId as string;
  const requesterId = (req as any).userId;
  const requesterSystemRole = (req as any).userSystemRole;
  const requesterRole = (req as any).userRole;
  const isDelegatedAdmin = Boolean((req as any).userIsDelegatedAdmin);
  const isManager =
    isManagerRole(requesterSystemRole) ||
    isManagerRole(requesterRole) ||
    isDelegatedAdmin ||
    requesterSystemRole === "SUPER_ADMIN" ||
    ((req as any).userConfiguredModules || []).includes("finance");

  if (!isManager && userId !== requesterId) {
    throw createError("Forbidden: You can only view your own payslip", 403);
  }

  const targetMonth = (req.query.month as string) || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()).slice(0, 7);
  const [yearStr, monthStr] = targetMonth.split("-");
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1;

  const [emp] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!emp) throw createError("Employee not found", 404);

  const { totalDays, workingDays } = await getWorkingDaysInMonth(year, monthIndex);
  const monthlySalary = Number(emp.monthlySalary) || 0;
  const dailyRate = workingDays > 0 ? monthlySalary / workingDays : 0;
  const hourlyRate = Number(emp.hourlyCostRate) || (dailyRate > 0 ? dailyRate / 8 : 100);

  const startDateStr = `${targetMonth}-01`;
  const endDateStr = `${targetMonth}-${String(totalDays).padStart(2, "0")}`;

  const records = await db
    .select()
    .from(attendance)
    .where(
      and(
        eq(attendance.userId, emp.id),
        gte(attendance.date, startDateStr),
        lte(attendance.date, endDateStr)
      )
    );

  let presentDays = 0;
  let halfDays = 0;
  let paidLeaveDays = 0;
  let unpaidAbsentDays = 0;
  let totalOvertimeMin = 0;

  for (const r of records) {
    if (r.status === "PRESENT") presentDays++;
    else if (r.status === "HALF_DAY") halfDays++;
    else if (r.status === "ON_LEAVE" || r.status === "LEAVE") paidLeaveDays++;
    else if (r.status === "ABSENT") unpaidAbsentDays++;
    if (r.overtimeMin) totalOvertimeMin += Number(r.overtimeMin);
  }

  const effectivePresentDays = presentDays + halfDays * 0.5 + paidLeaveDays;
  const overtimeHours = Number((totalOvertimeMin / 60).toFixed(1));
  const overtimePay = Math.round(overtimeHours * hourlyRate * 1.5);
  const lopDeduction = Math.round(unpaidAbsentDays * dailyRate);
  const netPayable = Math.max(0, monthlySalary - lopDeduction + overtimePay);

  const monthName = new Date(year, monthIndex, 1).toLocaleString("default", { month: "long", year: "numeric" });

  function esc(s: any): string {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Payslip — ${esc(emp.name)} (${monthName})</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; margin: 0; padding: 40px; background: #fff; }
    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
    h1 { margin: 0 0 4px 0; font-size: 22px; color: #0f172a; }
    .subtitle { color: #64748b; font-size: 13px; font-weight: 500; }
    .employee-box { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 24px 0; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .field label { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 2px; }
    .field span { font-size: 13px; font-weight: 600; color: #1e293b; }
    .tables-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; background: #f1f5f9; padding: 8px 12px; border: 1px solid #e2e8f0; }
    td { font-size: 13px; padding: 8px 12px; border: 1px solid #e2e8f0; }
    .text-right { text-align: right; }
    .net-pay-banner { margin-top: 32px; background: #f5f3ff; border: 2px solid #ddd6fe; border-radius: 8px; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
    .net-pay-amount { font-size: 24px; font-weight: 800; color: #6d28d9; }
    .footer { margin-top: 48px; border-top: 1px dashed #cbd5e1; padding-top: 16px; font-size: 11px; color: #94a3b8; text-align: center; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: flex-end;">
    <button onclick="window.print()" style="background: #7c3aed; color: #fff; font-weight: 600; border: none; padding: 8px 18px; border-radius: 6px; cursor: pointer;">🖨️ Print Payslip</button>
  </div>

  <div class="header">
    <div>
      <div style="font-size: 12px; font-weight: 700; color: #7c3aed; letter-spacing: 0.1em; text-transform: uppercase;">Blink Beyond Media Pvt Ltd</div>
      <h1>Salary Slip &bull; ${esc(monthName)}</h1>
      <div class="subtitle">Confidential &bull; Generated via BlinkBeyond AgencyOS</div>
    </div>
    <div style="text-align: right;">
      <div style="font-weight: 700; font-size: 14px; color: #0f172a;">Pay Period: ${esc(targetMonth)}</div>
      <div class="subtitle">Working Days: ${workingDays}</div>
    </div>
  </div>

  <div class="employee-box">
    <div class="field"><label>Employee Name</label><span>${esc(emp.name)}</span></div>
    <div class="field"><label>Designation</label><span>${esc(emp.designation || emp.role || "Team Member")}</span></div>
    <div class="field"><label>Email</label><span>${esc(emp.email)}</span></div>
    <div class="field"><label>Bank Account</label><span>${emp.bankAccountNo ? esc(emp.bankAccountNo) : "N/A"}</span></div>
    <div class="field"><label>Bank IFSC</label><span>${emp.bankIfsc ? esc(emp.bankIfsc) : "N/A"}</span></div>
    <div class="field"><label>PAN Number</label><span>${emp.panNumber ? esc(emp.panNumber) : "N/A"}</span></div>
  </div>

  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
    <div><span style="font-size: 11px; color: #64748b;">Days Present:</span> <strong>${presentDays}</strong></div>
    <div><span style="font-size: 11px; color: #64748b;">Half Days:</span> <strong>${halfDays}</strong></div>
    <div><span style="font-size: 11px; color: #64748b;">Paid Leaves:</span> <strong>${paidLeaveDays}</strong></div>
    <div><span style="font-size: 11px; color: #64748b;">Loss of Pay (LOP):</span> <strong>${unpaidAbsentDays}</strong></div>
  </div>

  <div class="tables-grid">
    <div>
      <table>
        <thead><tr><th>Earnings</th><th class="text-right">Amount (₹)</th></tr></thead>
        <tbody>
          <tr><td>Basic Monthly Salary</td><td class="text-right">₹${monthlySalary.toLocaleString()}</td></tr>
          <tr><td>Overtime Pay (${overtimeHours}h)</td><td class="text-right">₹${overtimePay.toLocaleString()}</td></tr>
          <tr style="font-weight: 700; background: #f8fafc;"><td>Gross Earnings</td><td class="text-right">₹${(monthlySalary + overtimePay).toLocaleString()}</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <table>
        <thead><tr><th>Deductions</th><th class="text-right">Amount (₹)</th></tr></thead>
        <tbody>
          <tr><td>Loss of Pay (${unpaidAbsentDays} days)</td><td class="text-right">₹${lopDeduction.toLocaleString()}</td></tr>
          <tr><td>Professional Tax / TDS</td><td class="text-right">₹0</td></tr>
          <tr style="font-weight: 700; background: #f8fafc;"><td>Total Deductions</td><td class="text-right">₹${lopDeduction.toLocaleString()}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="net-pay-banner">
    <div>
      <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #6d28d9;">Net Take-Home Salary</div>
      <div style="font-size: 12px; color: #64748b;">Transferred to registered bank account</div>
    </div>
    <div class="net-pay-amount">₹${netPayable.toLocaleString()}</div>
  </div>

  <div class="footer">
    This is a system-generated document and does not require a physical signature. &bull; Blink Beyond Media Pvt Ltd
  </div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  return res.send(html);
}));

export default router;

