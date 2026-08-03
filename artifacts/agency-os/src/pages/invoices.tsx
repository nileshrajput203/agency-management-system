import { useState } from "react";
import {
  useListInvoices, useGetFinancialSummary,
  getListInvoicesQueryKey, getGetFinancialSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Receipt, Download } from "lucide-react";
import { format } from "date-fns";
import { openPrintWindow, buildInvoiceHtml, type InvoiceData } from "@/lib/pdf-print";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";
import { STATUS_CONFIG, sym, authHeaders } from "@/components/invoices/invoice-helpers";

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editInvoiceState, setEditInvoice] = useState<Record<string, unknown> | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data: invoices, isLoading } = useListInvoices();
  const { data: summary, isLoading: summaryLoading } = useGetFinancialSummary();

  const editInvoice = editInvoiceState ? (invoices ?? []).find(inv => inv.id === editInvoiceState.id) as any || editInvoiceState : null;

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/invoices/${id}`, { method: "PATCH", headers: authHeaders(true), body: JSON.stringify({ status }) });
      qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetFinancialSummaryQueryKey() });
    } catch { toast.error("Failed to update"); }
  };

  const deleteInvoice = async (id: string) => {
    try {
      await fetch(`/api/invoices/${id}`, { method: "DELETE", headers: authHeaders() });
      toast.success("Invoice deleted");
      qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetFinancialSummaryQueryKey() });
    } catch { toast.error("Failed to delete"); }
  };

  if (builderOpen) {
    return <InvoiceBuilder
      onBack={() => { setBuilderOpen(false); setEditInvoice(null); }}
      editData={editInvoice}
    />;
  }

  const filtered = (invoices ?? []).filter(inv => statusFilter === "ALL" || inv.status === statusFilter);

  return (
    <div className="p-6 animated-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{invoices?.length ?? 0} total invoices</p>
        </div>
        <Button onClick={() => { setEditInvoice(null); setBuilderOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> New Invoice
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />) : (
          <>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Revenue</p>
              <p className="text-xl font-bold mt-1">₹{((summary?.totalRevenue ?? 0) / 100000).toFixed(1)}L</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Outstanding</p>
              <p className="text-xl font-bold mt-1 text-amber-600">₹{((summary?.outstanding ?? 0) / 100000).toFixed(1)}L</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Overdue</p>
              <p className="text-xl font-bold mt-1 text-destructive">₹{((summary?.overdue ?? 0) / 100000).toFixed(1)}L</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Paid / Total</p>
              <p className="text-xl font-bold mt-1">{summary?.paidCount ?? 0} / {summary?.invoiceCount ?? 0}</p>
            </CardContent></Card>
          </>
        )}
      </div>

      <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? "ALL")}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Statuses</SelectItem>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No invoices found</p>
          <p className="text-sm mt-1">Click "New Invoice" to create your first GST invoice</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Invoice #</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Due</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(inv => {
                const sc = STATUS_CONFIG[inv.status ?? "DRAFT"] ?? STATUS_CONFIG.DRAFT;
                const currSym = sym(inv.currency ?? "INR");
                return (
                  <tr key={inv.id} className="hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => { setEditInvoice(inv as unknown as Record<string, unknown>); setBuilderOpen(true); }}>
                    <td className="px-4 py-3 font-medium font-mono text-xs">{inv.number}</td>
                    <td className="px-4 py-3">{inv.clientName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {inv.invoiceDate ? format(new Date(inv.invoiceDate), "dd MMM yy") : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {inv.dueDate ? format(new Date(inv.dueDate), "dd MMM yy") : "—"}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <Select value={inv.status ?? "DRAFT"} onValueChange={v => { if (v) updateStatus(inv.id, v); }}>
                        <SelectTrigger className="h-7 text-xs w-32 border-0 bg-transparent p-0 shadow-none focus:ring-0">
                          <Badge variant={sc.variant} className={cn("text-xs cursor-pointer", sc.className)}>{sc.label}</Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold font-mono text-sm">
                      {currSym}{(inv.total ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7"
                          title="Download PDF"
                          onClick={() => {
                            openPrintWindow(
                              buildInvoiceHtml(inv as unknown as InvoiceData),
                              `Invoice-${inv.number ?? "draft"}`
                            );
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
    </div>
  );
}
