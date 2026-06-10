// @ts-nocheck
import { useState } from "react";
import {
  useListQuotations, useCreateQuotation, useUpdateQuotation, useDeleteQuotation,
  useConvertQuotationToInvoice, useListClients, getListQuotationsQueryKey,
} from "@workspace/api-client-react";
import type { QuotationInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { Plus, Trash2, FileText, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-slate-100 text-slate-600" },
  SENT: { label: "Sent", className: "bg-blue-100 text-blue-700" },
  APPROVED: { label: "Approved", className: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Rejected", className: "bg-rose-100 text-rose-700" },
  EXPIRED: { label: "Expired", className: "bg-orange-100 text-orange-700" },
};

interface LineItem { description: string; qty: number; unitPrice: number; taxPercent: number; }
type QuotationFormData = Omit<QuotationInput, "lineItems"> & { lineItems: LineItem[] };

export default function QuotationsPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data: quotations, isLoading } = useListQuotations();
  const { data: clients } = useListClients();

  const createMutation = useCreateQuotation({
    mutation: {
      onSuccess: () => {
        toast.success("Quotation created");
        qc.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
        setDialogOpen(false);
      },
      onError: () => toast.error("Failed to create quotation"),
    },
  });

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

  const { register, handleSubmit, control, watch, reset } = useForm<QuotationFormData>({
    defaultValues: {
      clientId: "",
      // @ts-ignore
      status: "DRAFT",
      lineItems: [{ description: "", qty: 1, unitPrice: 0, taxPercent: 18 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });
  const lineItems = watch("lineItems");

  const subtotal = lineItems.reduce((sum, item) => sum + (Number(item.qty) * Number(item.unitPrice)), 0);
  const totalTax = lineItems.reduce((sum, item) => sum + (Number(item.qty) * Number(item.unitPrice) * Number(item.taxPercent) / 100), 0);
  const total = subtotal + totalTax;

  const onSubmit = (data: QuotationFormData) => {
    // @ts-ignore
    createMutation.mutate({ data: { ...data, subtotal, taxAmount: totalTax, total } as QuotationInput });
  };

  const filtered = (quotations ?? []).filter((q) => {
    if (statusFilter !== "ALL" && q.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="p-6 animated-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Quotations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{quotations?.length ?? 0} quotations</p>
        </div>
        <Button
          onClick={() => {
            // @ts-ignore
            reset({ clientId: "", status: "DRAFT", lineItems: [{ description: "", qty: 1, unitPrice: 0, taxPercent: 18 }] });
            setDialogOpen(true);
          }}
          className="gap-2 btn-micro-anim" data-testid="add-quotation-btn"
        >
          <Plus className="h-4 w-4" /> New Quotation
        </Button>
      </div>

      // @ts-ignore
      <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as string)}>
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
          <p className="font-medium">No quotations found</p>
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
                const sc = STATUS_CONFIG[q.status ?? "DRAFT"];
                return (
                  <tr key={q.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium font-mono text-xs">{q.number}</td>
                    <td className="px-4 py-3">{q.clientName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      // @ts-ignore
                      {q.quotationDate ? format(new Date(q.quotationDate), "dd MMM yy") : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {q.validUntil ? format(new Date(q.validUntil), "dd MMM yy") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={q.status ?? "DRAFT"}
                        // @ts-ignore
                        onValueChange={(v) => updateMutation.mutate({ id: q.id, data: { status: v } })}
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
                    <td className="px-4 py-3 text-right font-semibold">₹{(q.total ?? 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Quotation</DialogTitle></DialogHeader>
          // @ts-ignore
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Controller control={control} name="clientId" render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {(clients ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                // @ts-ignore
                <Controller control={control} name="status" render={({ field }) => (
                  // @ts-ignore
                  <Select value={field.value ?? "DRAFT"} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quotation Date</Label>
                // @ts-ignore
                <Input {...register("quotationDate")} type="date" />
              </div>
              <div className="space-y-1.5">
                <Label>Valid Until</Label>
                <Input {...register("validUntil")} type="date" />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Line Items</Label>
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div key={field.id} className="grid grid-cols-[1fr_60px_80px_60px_24px] gap-2 items-start">
                    <Input {...register(`lineItems.${idx}.description`)} placeholder="Description" className="text-sm" />
                    <Input {...register(`lineItems.${idx}.qty`)} type="number" placeholder="Qty" className="text-sm" />
                    <Input {...register(`lineItems.${idx}.unitPrice`)} type="number" placeholder="Price" className="text-sm" />
                    <Input {...register(`lineItems.${idx}.taxPercent`)} type="number" placeholder="Tax%" className="text-sm" />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-6 text-destructive" onClick={() => remove(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" className="mt-2 gap-1 text-xs" onClick={() => append({ description: "", qty: 1, unitPrice: 0, taxPercent: 18 })}>
                <Plus className="h-3 w-3" /> Add Line Item
              </Button>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>₹{totalTax.toLocaleString("en-IN")}</span></div>
              <div className="flex justify-between font-bold border-t border-border pt-1"><span>Total</span><span>₹{total.toLocaleString("en-IN")}</span></div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register("notes")} rows={2} placeholder="Terms and conditions..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="save-quotation-btn">Create Quotation</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
