import { useState } from "react";
import {
  useListQuotations, useDeleteQuotation, useUpdateQuotation,
  useConvertQuotationToInvoice, getListQuotationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileText, ArrowRight, Download } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { openPrintWindow, buildQuotationHtml, type QuotationData } from "@/lib/pdf-print";
import { QuotationEditor } from "@/components/quotations/quotation-editor";
import { STATUS_CONFIG, QuotationRow } from "@/components/quotations/quotation-helpers";

export default function QuotationsPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<"list" | "editor">("list");
  const [editingRowState, setEditingRow] = useState<QuotationRow | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data: quotations, isLoading } = useListQuotations();

  const editingRow = editingRowState ? (quotations ?? []).find(q => q.id === editingRowState.id) as any || editingRowState : undefined;

  const deleteMutation = useDeleteQuotation({
    mutation: {
      onSuccess: () => {
        toast.success("Quotation deleted");
        qc.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
      },
    },
  });

  const updateMutation = useUpdateQuotation({
    mutation: {
      onSuccess: () => {
        toast.success("Status updated");
        qc.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
      },
    },
  });

  const convertMutation = useConvertQuotationToInvoice({
    mutation: {
      onSuccess: () => {
        toast.success("Converted to invoice!");
        qc.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
      },
      onError: () => toast.error("Conversion failed"),
    },
  });

  if (view === "editor") {
    return (
      <QuotationEditor
        existing={editingRow}
        onBack={() => { setView("list"); setEditingRow(undefined); }}
        onSaved={() => { setView("list"); setEditingRow(undefined); }}
      />
    );
  }

  const filtered = (quotations ?? []).filter(
    (q) => statusFilter === "ALL" || q.status === statusFilter
  );

  return (
    <div className="p-6 space-y-5 animated-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Quotations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{quotations?.length ?? 0} quotations</p>
        </div>
        <Button
          onClick={() => { setEditingRow(undefined); setView("editor"); }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> New Quotation
        </Button>
      </div>

      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "ALL")}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Statuses</SelectItem>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No quotations yet</p>
          <p className="text-sm mt-1">Click "New Quotation" to create your first one</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Quotation #</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Valid Until</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((q) => {
                const sc = STATUS_CONFIG[q.status ?? "DRAFT"] ?? STATUS_CONFIG.DRAFT;
                const row = q as QuotationRow;
                return (
                  <tr
                    key={q.id}
                    className="hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => { setEditingRow(row); setView("editor"); }}
                  >
                    <td className="px-4 py-3 font-medium font-mono text-xs">{q.number ?? "—"}</td>
                    <td className="px-4 py-3">{q.clientName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {q.createdAt ? format(new Date(q.createdAt), "dd MMM yy") : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {q.validUntil ? format(new Date(q.validUntil), "dd MMM yy") : "—"}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={q.status ?? "DRAFT"}
                        onValueChange={(v) => {
                          if (v) updateMutation.mutate({ id: q.id, data: { status: v } as any });
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs w-32 border-0 bg-transparent p-0 shadow-none focus:ring-0">
                          <Badge variant="secondary" className={cn("text-xs cursor-pointer", sc.className)}>
                            {sc.label}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      ₹{(q.total ?? 0).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        {q.status === "APPROVED" && (
                          <Button
                            size="sm" variant="outline" className="h-7 text-xs gap-1"
                            onClick={() => convertMutation.mutate({ id: q.id })}
                            disabled={convertMutation.isPending}
                          >
                            <ArrowRight className="h-3 w-3" /> Invoice
                          </Button>
                        )}
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7"
                          title="Download PDF"
                          onClick={() => {
                            openPrintWindow(
                              buildQuotationHtml(row as unknown as QuotationData),
                              `Quotation-${q.number ?? "draft"}`
                            );
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate({ id: q.id })}
                        >
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
