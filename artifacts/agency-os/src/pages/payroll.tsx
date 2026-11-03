import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Wallet, IndianRupee, Download, Calendar, UserCheck, AlertCircle,
  FileText, Building2, Printer
} from "lucide-react";
import { format } from "date-fns";

export default function PayrollPage() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ["payroll-summary", selectedMonth],
    queryFn: async () => {
      const token = localStorage.getItem("agency_token") || localStorage.getItem("token") || "";
      const res = await fetch(`/api/payroll/summary?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load payroll register");
      }
      return res.json();
    },
  });

  const employees = summary?.employees || [];
  const totalOutflow = summary?.totalOutflow || 0;
  const totalDaysInMonth = summary?.totalDaysInMonth || 30;

  return (
    <div className="p-6 animated-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" />
            Payroll, Salaries & Compensation
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automated salary calculations with attendance-based LOP deductions and printable salary slips.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-lg border border-border">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-sm font-semibold focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Summary Scorecard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-primary/[0.04] border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Total Salary Outflow</p>
              <p className="text-2xl font-bold font-heading mt-1 flex items-center gap-1 text-primary">
                <IndianRupee className="h-5 w-5" />
                {totalOutflow.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Wallet className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/[0.04] border-emerald-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Team On Payroll</p>
              <p className="text-2xl font-bold font-heading mt-1 text-emerald-600 dark:text-emerald-400">
                {employees.length} Members
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <UserCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/[0.04] border-blue-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">Pay Period</p>
              <p className="text-lg font-bold font-heading mt-1 text-blue-600 dark:text-blue-400">
                {format(new Date(`${selectedMonth}-01`), "MMMM yyyy")} ({totalDaysInMonth} Days)
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
              <Calendar className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Salary Register Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <h2 className="font-bold text-sm">Monthly Salary Register</h2>
          <span className="text-xs text-muted-foreground">Form 16 / Indian Labor Law Compliant</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Loading payroll summary...</div>
        ) : error ? (
          <div className="p-8 text-center text-destructive text-sm flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4" /> {(error as any).message}
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            No active employees found for this pay cycle.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Role / Designation</th>
                  <th className="py-3 px-4 text-right">Base CTC (₹)</th>
                  <th className="py-3 px-4 text-center">Paid / Total Days</th>
                  <th className="py-3 px-4 text-right">LOP Deduction (₹)</th>
                  <th className="py-3 px-4 text-right">Net Payable (₹)</th>
                  <th className="py-3 px-4">Bank & PAN</th>
                  <th className="py-3 px-4 text-center">Payslip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {employees.map((emp: any) => (
                  <tr key={emp.userId} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {emp.userName}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {emp.designation || emp.role}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      ₹{(emp.baseSalary || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {emp.paidDays}
                      </span>{" "}
                      / {emp.totalDaysInMonth}
                      {emp.unpaidLeaves > 0 && (
                        <span className="ml-1 text-[10px] text-red-500 font-bold">
                          ({emp.unpaidLeaves} LOP)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-red-600 font-medium">
                      {emp.lopDeduction > 0 ? `-₹${emp.lopDeduction.toLocaleString("en-IN")}` : "₹0"}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-primary">
                      ₹{(emp.netSalary || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-[11px]">
                      {emp.bankAccountNo ? (
                        <div>
                          <span>A/C: {emp.bankAccountNo}</span>
                          <span className="block text-[10px] opacity-75">IFSC: {emp.bankIfsc || "—"}</span>
                        </div>
                      ) : (
                        <span className="italic opacity-60">Not configured</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                        onClick={() => {
                          window.open(`/api/payroll/${emp.userId}/payslip-pdf?month=${selectedMonth}`, "_blank");
                        }}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Payslip
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
