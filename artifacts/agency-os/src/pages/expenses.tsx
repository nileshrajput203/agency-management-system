import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Receipt, CheckCircle2, XCircle, DollarSign, Wallet, FileText, Trash2, Calendar, Building, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { authHeaders } from "@/components/invoices/invoice-helpers";

const CATEGORY_MAP: Record<string, { label: string; icon: string }> = {
  TRAVEL:               { label: "Traveling & Conveyance", icon: "✈️" },
  FOOD_MEALS:           { label: "Food & Meals",           icon: "🍽️" },
  SHOOT_LOGISTICS:      { label: "Shoot Logistics & Props", icon: "🎬" },
  EQUIPMENT_RENTAL:     { label: "Equipment Rental",       icon: "📷" },
  SOFTWARE_LICENSES:    { label: "Software & SaaS",        icon: "💻" },
  OFFICE_SUPPLIES:      { label: "Office & Stationary",    icon: "📦" },
  CLIENT_ENTERTAINMENT: { label: "Client Entertainment",   icon: "🤝" },
  MARKETING_ADS:        { label: "Marketing & Ads",        icon: "📢" },
  OTHER:                { label: "Other Expense",          icon: "📄" },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  SUBMITTED:  { label: "Pending Approval", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400" },
  APPROVED:   { label: "Approved",         className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400" },
  REIMBURSED: { label: "Reimbursed",       className: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400" },
  REJECTED:   { label: "Rejected",         className: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400" },
};

export default function ExpensesPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Form state
  const [category, setCategory] = useState("TRAVEL");
  const [description, setDescription] = useState("");
  const [spendDate, setSpendDate] = useState(new Date().toISOString().split("T")[0]);
  const [amount, setAmount] = useState("");
  const [taxPercent, setTaxPercent] = useState("18");
  const [vendorName, setVendorName] = useState("");
  const [vendorGstin, setVendorGstin] = useState("");
  const [itcEligible, setItcEligible] = useState(true);
  const [reimbursable, setReimbursable] = useState(true);
  const [receiptReference, setReceiptReference] = useState("");
  const [notes, setNotes] = useState("");

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", statusFilter, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (categoryFilter !== "ALL") params.append("category", categoryFilter);
      const res = await fetch(`/api/expenses?${params.toString()}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load expenses");
      return res.json();
    },
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["expenses-summary"],
    queryFn: async () => {
      const res = await fetch("/api/expenses/summary", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json();
    },
  });

  const resetForm = () => {
    setCategory("TRAVEL");
    setDescription("");
    setSpendDate(new Date().toISOString().split("T")[0]);
    setAmount("");
    setTaxPercent("18");
    setVendorName("");
    setVendorGstin("");
    setItcEligible(true);
    setReimbursable(true);
    setReceiptReference("");
    setNotes("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount) {
      toast.error("Please fill in description and amount");
      return;
    }

    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          category,
          description,
          spendDate,
          amount: Number(amount),
          taxPercent: Number(taxPercent),
          vendorName,
          vendorGstin,
          itcEligible,
          reimbursable,
          receiptReference,
          notes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to log expense");
      }

      toast.success("Expense logged successfully!");
      setDialogOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-summary"] });
      qc.invalidateQueries({ queryKey: ["gst-ledger-summary"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit expense");
    }
  };

  const approveExpense = async (id: string) => {
    try {
      const res = await fetch(`/api/expenses/${id}/approve`, { method: "PATCH", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to approve");
      toast.success("Expense approved for accounting & ITC claim");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-summary"] });
      qc.invalidateQueries({ queryKey: ["gst-ledger-summary"] });
    } catch {
      toast.error("Approval failed");
    }
  };

  const reimburseExpense = async (id: string) => {
    try {
      const res = await fetch(`/api/expenses/${id}/reimburse`, { method: "PATCH", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to reimburse");
      toast.success("Expense marked as reimbursed to employee");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-summary"] });
      qc.invalidateQueries({ queryKey: ["gst-ledger-summary"] });
    } catch {
      toast.error("Reimbursement update failed");
    }
  };

  const rejectExpense = async () => {
    if (!rejectId) return;
    try {
      const res = await fetch(`/api/expenses/${rejectId}/reject`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ rejectionReason }),
      });
      if (!res.ok) throw new Error("Failed to reject");
      toast.success("Expense marked as rejected");
      setRejectId(null);
      setRejectionReason("");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-summary"] });
      qc.invalidateQueries({ queryKey: ["gst-ledger-summary"] });
    } catch {
      toast.error("Rejection update failed");
    }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense record?")) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Expense deleted");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-summary"] });
      qc.invalidateQueries({ queryKey: ["gst-ledger-summary"] });
    } catch {
      toast.error("Delete failed");
    }
  };

  // Tax breakdown preview
  const numAmt = Number(amount) || 0;
  const numPct = Number(taxPercent) || 0;
  const estTax = numPct > 0 ? Number(((numAmt * numPct) / (100 + numPct)).toFixed(2)) : 0;
  const estBase = Number((numAmt - estTax).toFixed(2));

  return (
    <div className="p-6 space-y-6 animated-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <Wallet className="h-6 w-6 text-primary" /> Employee Expense & Travel Tracker
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Log all agency spends: travel, shoot logistics, food, equipment, with GST Input Credit (ITC) tracking.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" /> Log Expense
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Expenses</p>
                <p className="text-xl font-bold font-mono mt-1">₹{(summary?.totalExpenses ?? 0).toLocaleString("en-IN")}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{summary?.count ?? 0} total claims</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Approved Spends</p>
                <p className="text-xl font-bold font-mono mt-1 text-emerald-600">₹{(summary?.approvedExpenses ?? 0).toLocaleString("en-IN")}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Ready for payroll / audit</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending Approval</p>
                <p className="text-xl font-bold font-mono mt-1 text-amber-600">₹{(summary?.pendingExpenses ?? 0).toLocaleString("en-IN")}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Awaiting manager review</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-primary">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Eligible GST ITC</p>
                <p className="text-xl font-bold font-mono mt-1 text-primary">₹{(summary?.totalItcClaimable ?? 0).toLocaleString("en-IN")}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Input Tax Credit claimable</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="SUBMITTED">Pending Approval</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REIMBURSED">Reimbursed</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Category Filter" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            {Object.entries(CATEGORY_MAP).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.icon} {val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : !expenses || expenses.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-muted/20 border border-dashed rounded-xl p-8">
          <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30 text-primary" />
          <p className="font-medium text-foreground">No expenses recorded yet</p>
          <p className="text-sm mt-1">Log travel tickets, meals, shoot equipment rentals, or client entertainment to keep accountant books clean.</p>
          <Button onClick={() => setDialogOpen(true)} className="mt-4 gap-2" size="sm">
            <Plus className="h-4 w-4" /> Log First Expense
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card shadow-xs">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Employee</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Description / Vendor</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Total Amount</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">GST (ITC)</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {expenses.map((exp: any) => {
                const cat = CATEGORY_MAP[exp.category] || { label: exp.category, icon: "📄" };
                const st = STATUS_CONFIG[exp.status] || STATUS_CONFIG.SUBMITTED;
                return (
                  <tr key={exp.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {exp.spendDate ? format(new Date(exp.spendDate), "dd MMM yy") : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {exp.employeeName || "Employee"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs bg-muted px-2 py-1 rounded-md font-medium">
                        {cat.icon} {cat.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium text-foreground line-clamp-1">{exp.description}</p>
                      {exp.vendorName && (
                        <p className="text-xs text-muted-foreground truncate">
                          Vendor: {exp.vendorName} {exp.vendorGstin ? `(${exp.vendorGstin})` : ""}
                        </p>
                      )}
                      {exp.receiptReference && (
                        <p className="text-[11px] text-primary truncate mt-0.5">
                          Receipt: {exp.receiptReference}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-foreground whitespace-nowrap">
                      ₹{Number(exp.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs whitespace-nowrap">
                      <span className={cn(exp.itcEligible ? "text-emerald-600 font-semibold" : "text-muted-foreground")}>
                        ₹{Number(exp.taxAmount).toFixed(2)}
                      </span>
                      {exp.itcEligible && <span className="block text-[10px] text-emerald-600">ITC Claimable</span>}
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <Badge variant="outline" className={cn("text-xs border-0 font-medium", st.className)}>
                        {st.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {exp.status === "SUBMITTED" && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1"
                              onClick={() => approveExpense(exp.id)}>
                              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1"
                              onClick={() => { setRejectId(exp.id); setRejectionReason(""); }}>
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </Button>
                          </>
                        )}
                        {exp.status === "APPROVED" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs text-blue-600 hover:text-blue-700 gap-1"
                            onClick={() => reimburseExpense(exp.id)}>
                            <Wallet className="h-3.5 w-3.5" /> Mark Reimbursed
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteExpense(exp.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Log Expense Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> Log Agency / Employee Expense
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_MAP).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Spend Date *</Label>
                <Input type="date" value={spendDate} onChange={e => setSpendDate(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description *</Label>
              <Input
                placeholder="e.g. Flight tickets to Mumbai for client shoot, Uber conveyance, lunch with client"
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Total Amount (₹ incl. GST) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="e.g. 4500"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>GST Rate (%)</Label>
                <Select value={taxPercent} onValueChange={setTaxPercent}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0% (Nil / Exempt)</SelectItem>
                    <SelectItem value="5">5% (Transport / Food)</SelectItem>
                    <SelectItem value="12">12% (Hotel & Services)</SelectItem>
                    <SelectItem value="18">18% (Standard GST / Shoot Equipment / Tech)</SelectItem>
                    <SelectItem value="28">28% (Luxury / Vehicles)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {numAmt > 0 && numPct > 0 && (
              <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1 border border-border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Base / Taxable Amount:</span>
                  <span className="font-mono font-medium">₹{estBase.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated GST Input Tax Credit (ITC):</span>
                  <span className="font-mono font-bold text-emerald-600">₹{estTax.toFixed(2)}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Vendor Name</Label>
                <Input placeholder="e.g. IndiGo Airlines, Taj Catering, Camera Rentals" value={vendorName} onChange={e => setVendorName(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Vendor GSTIN</Label>
                <Input placeholder="e.g. 27AAAAA0000A1Z5" value={vendorGstin} onChange={e => setVendorGstin(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Receipt Ref / Invoice Number / Bill URL</Label>
              <Input placeholder="e.g. REC-9843 or Google Drive Link" value={receiptReference} onChange={e => setReceiptReference(e.target.value)} />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={itcEligible} onCheckedChange={(c) => setItcEligible(Boolean(c))} />
                <span>Eligible for GST Input Tax Credit (ITC)</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={reimbursable} onCheckedChange={(c) => setReimbursable(Boolean(c))} />
                <span>Reimbursable to employee (paid out of pocket)</span>
              </label>
            </div>

            <div className="space-y-1.5">
              <Label>Internal Notes</Label>
              <Textarea rows={2} placeholder="Any additional context for accountant..." value={notes} onChange={e => setNotes(e.target.value)} />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Submit Expense</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={Boolean(rejectId)} onOpenChange={(open) => { if (!open) setRejectId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Expense Claim</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Label>Reason for rejection *</Label>
            <Input
              placeholder="e.g. Missing valid GST receipt, exceeds budget limit"
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
            />
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={rejectExpense}>Confirm Rejection</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
