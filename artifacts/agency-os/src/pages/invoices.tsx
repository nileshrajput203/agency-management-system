import { useState } from "react";
import {
  useListInvoices, useGetFinancialSummary,
  getListInvoicesQueryKey, getGetFinancialSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Receipt, Download, RefreshCw, Clock, CheckCircle, AlertTriangle, ArrowRight, FileCheck, Landmark, Sheet } from "lucide-react";
import { format } from "date-fns";
import { openPrintWindow, buildInvoiceHtml, type InvoiceData } from "@/lib/pdf-print";
import { exportInvoiceToExcel, exportInvoiceToCsv, exportInvoiceToPdf } from "@/lib/invoice-excel-export";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";
import { STATUS_CONFIG, sym, authHeaders } from "@/components/invoices/invoice-helpers";

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editInvoiceState, setEditInvoice] = useState<Record<string, unknown> | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "TAX_INVOICE" | "PROFORMA" | "DELAYED">("ALL");

  // Payment Recording State
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentTargetInvoice, setPaymentTargetInvoice] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState("PAID");
  const [delayedDays, setDelayedDays] = useState(0);
  const [paymentNotes, setPaymentNotes] = useState("");

  // Convert Proforma State
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const { data: invoices, isLoading } = useListInvoices();
  const { data: summary, isLoading: summaryLoading } = useGetFinancialSummary();

  const { data: gstSummary, isLoading: gstLoading } = useQuery({
    queryKey: ["gst-ledger-summary"],
    queryFn: async () => {
      const res = await fetch("/api/gst/ledger-summary", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load GST ledger");
      return res.json();
    },
  });

  const editInvoice = editInvoiceState ? (invoices ?? []).find(inv => inv.id === editInvoiceState.id) as any || editInvoiceState : null;

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/invoices/${id}`, { method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ status }) });
      qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetFinancialSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: ["gst-ledger-summary"] });
      toast.success("Status updated");
    } catch { toast.error("Failed to update"); }
  };

  const convertToTaxInvoice = async (invoice: any) => {
    if (!confirm(`Convert Proforma Invoice ${invoice.number} into official Tax Invoice? This will assign the next Tax Invoice number (INV-...) and update status.`)) return;
    setConvertingId(invoice.id);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/convert-to-tax-invoice`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      toast.success(`Converted to Tax Invoice ${updated.number}!`);
      qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetFinancialSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: ["gst-ledger-summary"] });
    } catch {
      toast.error("Failed to convert proforma invoice");
    } finally {
      setConvertingId(null);
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentTargetInvoice) return;
    try {
      const res = await fetch(`/api/invoices/${paymentTargetInvoice.id}/payment`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({
          paymentStatus,
          delayedDays: Number(delayedDays) || 0,
          paymentNotes,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Payment status updated!");
      setPaymentDialogOpen(false);
      setPaymentTargetInvoice(null);
      qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetFinancialSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: ["gst-ledger-summary"] });
    } catch {
      toast.error("Failed to record payment");
    }
  };

  const deleteInvoice = async (id: string) => {
    if (!confirm("Are you sure you want to delete this invoice?")) return;
    try {
      await fetch(`/api/invoices/${id}`, { method: "DELETE", headers: authHeaders() });
      toast.success("Invoice deleted");
      qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetFinancialSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: ["gst-ledger-summary"] });
    } catch { toast.error("Failed to delete"); }
  };

  if (builderOpen) {
    return <InvoiceBuilder
      onBack={() => { setBuilderOpen(false); setEditInvoice(null); }}
      editData={editInvoice}
    />;
  }

  const filtered = (invoices ?? [])
    .filter(inv => {
      if (statusFilter !== "ALL" && inv.status !== statusFilter) return false;
      const invType = (inv as any).invoiceType || "TAX_INVOICE";
      const isDelayed = (inv as any).paymentStatus === "DELAYED_PAYMENT" || inv.status === "OVERDUE" || (Number((inv as any).delayedDays) > 0);
      if (typeFilter === "TAX_INVOICE" && invType !== "TAX_INVOICE") return false;
      if (typeFilter === "PROFORMA" && invType !== "PROFORMA") return false;
      if (typeFilter === "DELAYED" && !isDelayed) return false;
      return true;
    })
    .slice()
    .sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      if (aDue !== bDue) return aDue - bDue;
      const aDate = a.invoiceDate ? new Date(a.invoiceDate).getTime() : Number.POSITIVE_INFINITY;
      const bDate = b.invoiceDate ? new Date(b.invoiceDate).getTime() : Number.POSITIVE_INFINITY;
      return aDate - bDate;
    });

  const proformaCount = (invoices ?? []).filter((i: any) => i.invoiceType === "PROFORMA").length;
  const delayedCount = (invoices ?? []).filter((i: any) => i.paymentStatus === "DELAYED_PAYMENT" || i.status === "OVERDUE" || Number(i.delayedDays) > 0).length;

  return (
    <div className="p-6 animated-fade-in space-y-5">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" /> Invoices & GST Accounting
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage Tax Invoices, Proforma Invoices (PI), GST Collections, and Client Payment Delays.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-50"
            onClick={async () => {
              try {
                toast.info("Generating monthly retainers & pulling unbilled expenses...");
                const res = await fetch("/api/invoices/generate-retainers", {
                  method: "POST",
                  headers: authHeaders(true),
                  body: JSON.stringify({}),
                });
                if (!res.ok) throw new Error("Failed to generate retainers");
                const data = await res.json();
                toast.success(`🎉 Generated ${data.count} monthly retainer invoices!`);
                qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
                qc.invalidateQueries({ queryKey: getGetFinancialSummaryQueryKey() });
              } catch (err: any) {
                toast.error(err.message || "Failed to generate retainers");
              }
            }}
          >
            <RefreshCw className="h-4 w-4" /> Generate Monthly Retainers
          </Button>
          <Button onClick={() => { setEditInvoice(null); setBuilderOpen(true); }} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" /> New Invoice / Proforma
          </Button>
        </div>
      </div>

      {/* Accountant GST & Net Liability Banner */}
      <Card className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white border-0 shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-indigo-400" />
              <span className="font-semibold text-sm tracking-wide uppercase text-indigo-200">
                Agency GST Accounting & ITC Ledger (Accountant View)
              </span>
            </div>
            <span className="text-xs text-indigo-300 bg-white/10 px-2.5 py-1 rounded-full">
              Automated GSTR-1 & GSTR-3B Computation
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-indigo-200 uppercase tracking-wide">Output GST Collected</p>
              <p className="text-xl font-bold font-mono mt-1 text-white">
                ₹{(gstSummary?.outputGst?.totalOutputTax ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-indigo-300 mt-0.5">
                CGST: ₹{(gstSummary?.outputGst?.cgst ?? 0).toFixed(0)} | SGST: ₹{(gstSummary?.outputGst?.sgst ?? 0).toFixed(0)} | IGST: ₹{(gstSummary?.outputGst?.igst ?? 0).toFixed(0)}
              </p>
            </div>

            <div>
              <p className="text-xs text-indigo-200 uppercase tracking-wide">Input Tax Credit (ITC)</p>
              <p className="text-xl font-bold font-mono mt-1 text-emerald-400">
                ₹{(gstSummary?.inputGst?.totalItcClaimable ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-emerald-300 mt-0.5">
                From Vendor Bills & Employee Expenses
              </p>
            </div>

            <div>
              <p className="text-xs text-indigo-200 uppercase tracking-wide">Net GST Payable</p>
              <p className="text-xl font-bold font-mono mt-1 text-amber-300">
                ₹{(gstSummary?.netGstLiability?.netPayableToGovernment ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-indigo-300 mt-0.5">
                {Number(gstSummary?.netGstLiability?.excessCreditCarryForward) > 0
                  ? `Excess Credit: ₹${gstSummary.netGstLiability.excessCreditCarryForward}`
                  : "Net Liability to Govt"}
              </p>
            </div>

            <div>
              <p className="text-xs text-indigo-200 uppercase tracking-wide">Delayed Payments</p>
              <p className="text-xl font-bold font-mono mt-1 text-rose-400">
                {gstSummary?.delayedPayments?.delayedCount ?? 0} Invoices
              </p>
              <p className="text-[11px] text-rose-300 mt-0.5">
                ₹{(gstSummary?.delayedPayments?.delayedAmount ?? 0).toLocaleString("en-IN")} | Avg delay: {gstSummary?.delayedPayments?.averageDelayDays ?? 0}d
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />) : (
          <>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Billed Revenue</p>
              <p className="text-xl font-bold mt-1">₹{((summary?.totalRevenue ?? 0) / 100000).toFixed(1)}L</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Outstanding Balance</p>
              <p className="text-xl font-bold mt-1 text-amber-600">₹{((summary?.outstanding ?? 0) / 100000).toFixed(1)}L</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Overdue Payments</p>
              <p className="text-xl font-bold mt-1 text-destructive">₹{((summary?.overdue ?? 0) / 100000).toFixed(1)}L</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Paid Invoices</p>
              <p className="text-xl font-bold mt-1">{summary?.paidCount ?? 0} / {summary?.invoiceCount ?? 0}</p>
            </CardContent></Card>
          </>
        )}
      </div>

      {/* Filter Tabs & Status Select */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border">
          <Button
            size="sm"
            variant={typeFilter === "ALL" ? "default" : "ghost"}
            onClick={() => setTypeFilter("ALL")}
            className="text-xs h-7 rounded-lg"
          >
            All Invoices ({invoices?.length ?? 0})
          </Button>
          <Button
            size="sm"
            variant={typeFilter === "TAX_INVOICE" ? "default" : "ghost"}
            onClick={() => setTypeFilter("TAX_INVOICE")}
            className="text-xs h-7 rounded-lg"
          >
            Tax Invoices
          </Button>
          <Button
            size="sm"
            variant={typeFilter === "PROFORMA" ? "default" : "ghost"}
            onClick={() => setTypeFilter("PROFORMA")}
            className="text-xs h-7 rounded-lg"
          >
            Proforma (PI) ({proformaCount})
          </Button>
          <Button
            size="sm"
            variant={typeFilter === "DELAYED" ? "default" : "ghost"}
            onClick={() => setTypeFilter("DELAYED")}
            className={cn("text-xs h-7 rounded-lg", delayedCount > 0 && "text-rose-600 font-semibold")}
          >
            Delayed Payments ({delayedCount})
          </Button>
        </div>

        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? "ALL")}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-muted/20 border border-dashed rounded-xl p-8">
          <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30 text-primary" />
          <p className="font-medium text-foreground">No invoices match your filter</p>
          <p className="text-sm mt-1">Create a Tax Invoice or Proforma Invoice to get started.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card shadow-xs">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Invoice #</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Due Date</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Status / Delay</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Total (₹)</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((inv: any) => {
                const sc = STATUS_CONFIG[inv.status ?? "DRAFT"] ?? STATUS_CONFIG.DRAFT;
                const currSym = sym(inv.currency ?? "INR");
                const isProforma = inv.invoiceType === "PROFORMA";
                const isDelayed = inv.paymentStatus === "DELAYED_PAYMENT" || inv.status === "OVERDUE" || Number(inv.delayedDays) > 0;

                return (
                  <tr key={inv.id} className="hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => { setEditInvoice(inv as unknown as Record<string, unknown>); setBuilderOpen(true); }}>
                    <td className="px-4 py-3 font-medium font-mono text-xs whitespace-nowrap">
                      {inv.number}
                      {inv.originalProformaNumber && (
                        <span className="block text-[10px] text-muted-foreground">From {inv.originalProformaNumber}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isProforma ? (
                        <Badge variant="outline" className="text-[11px] bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300">
                          Proforma (PI)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
                          Tax Invoice
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{inv.clientName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {inv.invoiceDate ? format(new Date(inv.invoiceDate), "dd MMM yy") : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {inv.dueDate ? format(new Date(inv.dueDate), "dd MMM yy") : "—"}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex flex-col gap-1 items-start">
                        <Select value={inv.status ?? "DRAFT"} onValueChange={v => { if (v) updateStatus(inv.id, v); }}>
                          <SelectTrigger className="h-7 text-xs w-28 border-0 bg-transparent p-0 shadow-none focus:ring-0">
                            <Badge variant={sc.variant} className={cn("text-xs cursor-pointer", sc.className)}>{sc.label}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>)}
                          </SelectContent>
                        </Select>

                        {isDelayed && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                            <Clock className="h-3 w-3" />
                            {inv.delayedDays ? `Delayed ${inv.delayedDays}d` : "Payment Overdue"}
                          </span>
                        )}
                        {inv.paymentStatus === "PAID" && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                            <CheckCircle className="h-3 w-3" /> Paid
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold font-mono text-sm whitespace-nowrap">
                      {currSym}{(inv.total ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      <span className="block text-[10px] text-muted-foreground font-normal">
                        GST: ₹{Number(inv.taxAmount || 0).toFixed(0)}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        {isProforma && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 border-purple-300 text-purple-700 hover:bg-purple-50"
                            title="Convert to official Tax Invoice"
                            disabled={convertingId === inv.id}
                            onClick={() => convertToTaxInvoice(inv)}
                          >
                            <ArrowRight className="h-3 w-3" /> Tax Invoice
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-slate-600 hover:text-foreground"
                          title="Record Payment & Delay Details"
                          onClick={() => {
                            setPaymentTargetInvoice(inv);
                            setPaymentStatus(inv.paymentStatus || "PAID");
                            setDelayedDays(Number(inv.delayedDays) || 0);
                            setPaymentNotes(inv.paymentNotes || "");
                            setPaymentDialogOpen(true);
                          }}
                        >
                          Payment
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          title="Export to Excel (.xlsx)"
                          onClick={() => {
                            exportInvoiceToExcel(inv as any);
                            toast.success("Excel Invoice downloaded!");
                          }}
                        >
                          <Sheet className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                          title="Download Master PDF (.pdf)"
                          onClick={async () => {
                            try {
                              toast.info("Generating PDF Invoice...");
                              await exportInvoiceToPdf(inv as any);
                              toast.success("PDF Invoice downloaded!");
                            } catch (err: any) {
                              toast.error(err?.message || "Failed to download PDF invoice");
                            }
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteInvoice(inv.id)}>
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

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment: {paymentTargetInvoice?.number}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
              <p><span className="text-muted-foreground">Client:</span> <span className="font-semibold">{paymentTargetInvoice?.clientName}</span></p>
              <p><span className="text-muted-foreground">Total Due:</span> <span className="font-mono font-bold">₹{Number(paymentTargetInvoice?.total || 0).toLocaleString("en-IN")}</span></p>
              <p><span className="text-muted-foreground">Due Date:</span> <span>{paymentTargetInvoice?.dueDate || "Not set"}</span></p>
            </div>

            <div className="space-y-1.5">
              <Label>Payment Status *</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAID">Paid in Full</SelectItem>
                  <SelectItem value="DELAYED_PAYMENT">Delayed Payment Received</SelectItem>
                  <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                  <SelectItem value="OVERDUE">Payment Overdue</SelectItem>
                  <SelectItem value="PENDING">Pending Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Payment Delay (Days past Due Date)</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={delayedDays}
                onChange={e => setDelayedDays(parseInt(e.target.value, 10) || 0)}
              />
              <p className="text-[11px] text-muted-foreground">
                If the client delayed payment past due date, enter delay days to update their payment behavior flags automatically.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Payment Notes / Transaction ID</Label>
              <Textarea
                rows={2}
                placeholder="e.g. Received via NEFT ref #AX9824, promised remaining balance next Monday"
                value={paymentNotes}
                onChange={e => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment}>Save Payment Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
