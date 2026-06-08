import { useState } from "react";
import {
  useListInvoices, useCreateInvoice, useUpdateInvoice, useDeleteInvoice,
  useGetFinancialSummary, useListClients, getListInvoicesQueryKey, getGetFinancialSummaryQueryKey,
} from "@workspace/api-client-react";
import type { InvoiceInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Trash2, IndianRupee, Receipt, Plus as PlusIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  DRAFT: { label: "Draft", variant: "secondary", className: "" },
  SENT: { label: "Sent", variant: "outline", className: "border-blue-300 text-blue-700" },
  VIEWED: { label: "Viewed", variant: "outline", className: "border-indigo-300 text-indigo-700" },
  PAID: { label: "Paid", variant: "default", className: "bg-emerald-600 border-emerald-600" },
  OVERDUE: { label: "Overdue", variant: "destructive", className: "" },
  CANCELLED: { label: "Cancelled", variant: "secondary", className: "line-through opacity-60" },
};

interface LineItem { description: string; qty: number; unitPrice: number; taxPercent: number; }

type InvoiceFormData = Omit<InvoiceInput, "lineItems"> & { lineItems: LineItem[] };

export default function InvoicesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data: invoices, isLoading } = useListInvoices();
  const { data: summary, isLoading: summaryLoading } = useGetFinancialSummary();
  const { data: clients } = useListClients();

  const createMutation = useCreateInvoice({
    mutation: {
      onSuccess: () => {
        toast.success("Invoice created");
        qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetFinancialSummaryQueryKey() });
        setDialogOpen(false);
      },
      onError: () => toast.error("Failed to create invoice"),
    },
  });

  const updateMutation = useUpdateInvoice({
    mutation: {
      onSuccess: () => {
        toast.success("Invoice updated");
        qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetFinancialSummaryQueryKey() });
      },
      onError: () => toast.error("Failed to update"),
    },
  });

  const deleteMutation = useDeleteInvoice({
    mutation: {
      onSuccess: () => {
        toast.success("Invoice deleted");
        qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetFinancialSummaryQueryKey() });
      },
    },
  });

  const { register, handleSubmit, control, watch, reset } = useForm<InvoiceFormData>({
    defaultValues: {
      clientId: "",
      status: "DRAFT",
      lineItems: [{ description: "", qty: 1, unitPrice: 0, taxPercent: 18 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });
  const lineItems = watch("lineItems");

  const subtotal = lineItems.reduce((sum, item) => sum + (Number(item.qty) * Number(item.unitPrice)), 0);
  const totalTax = lineItems.reduce((sum, item) => sum + (Number(item.qty) * Number(item.unitPrice) * Number(item.taxPercent) / 100), 0);
  const total = subtotal + totalTax;

  const onSubmit = (data: InvoiceFormData) => {
    createMutation.mutate({ data: { ...data, subtotal, taxAmount: totalTax, total } as InvoiceInput });
  };

  const filtered = (invoices ?? []).filter((inv) => {
    if (statusFilter !== "ALL" && inv.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="p-6 animated-fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{invoices?.length ?? 0} total invoices</p>
        </div>
        <Button onClick={() => { reset({ clientId: "", status: "DRAFT", lineItems: [{ description: "", qty: 1, unitPrice: 0, taxPercent: 18 }] }); setDialogOpen(true); }} className="gap-2 btn-micro-anim" data-testid="add-invoice-btn">
          <Plus className="h-4 w-4" /> New Invoice
        </Button>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : (
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

      {/* Filter */}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Statuses</SelectItem>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No invoices found</p>
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
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((inv) => {
                const sc = STATUS_CONFIG[inv.status ?? "DRAFT"];
                return (
                  <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium font-mono text-xs">{inv.number}</td>
                    <td className="px-4 py-3">{inv.clientName ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {inv.invoiceDate ? format(new Date(inv.invoiceDate), "dd MMM yy") : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {inv.dueDate ? format(new Date(inv.dueDate), "dd MMM yy") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={inv.status ?? "DRAFT"}
                        onValueChange={(v) => updateMutation.mutate({ id: inv.id, data: { status: v } })}
                      >
                        <SelectTrigger className="h-7 text-xs w-32 border-0 bg-transparent p-0 shadow-none focus:ring-0">
                          <Badge
                            variant={sc.variant}
                            className={cn("text-xs cursor-pointer", sc.className)}
                          >
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
                    <td className="px-4 py-3 text-right font-semibold">₹{(inv.total ?? 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3">
                      <Button
                        size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate({ id: inv.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Invoice</DialogTitle>
          </DialogHeader>
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
                <Controller control={control} name="status" render={({ field }) => (
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
                <Label>Invoice Date</Label>
                <Input {...register("invoiceDate")} type="date" />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input {...register("dueDate")} type="date" />
              </div>
            </div>

            {/* Line Items */}
            <div>
              <Label className="mb-2 block">Line Items</Label>
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div key={field.id} className="grid grid-cols-[1fr_60px_80px_60px_24px] gap-2 items-start">
                    <Input {...register(`lineItems.${idx}.description`)} placeholder="Description" className="text-sm" />
                    <Input {...register(`lineItems.${idx}.qty`)} type="number" placeholder="Qty" className="text-sm" />
                    <Input {...register(`lineItems.${idx}.unitPrice`)} type="number" placeholder="Price" className="text-sm" />
                    <Input {...register(`lineItems.${idx}.taxPercent`)} type="number" placeholder="Tax%" className="text-sm" />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-6 text-destructive hover:text-destructive" onClick={() => remove(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 gap-1 text-xs"
                onClick={() => append({ description: "", qty: 1, unitPrice: 0, taxPercent: 18 })}
              >
                <PlusIcon className="h-3 w-3" /> Add Line Item
              </Button>
            </div>

            {/* Totals */}
            <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>₹{totalTax.toLocaleString("en-IN")}</span></div>
              <div className="flex justify-between font-bold border-t border-border pt-1"><span>Total</span><span>₹{total.toLocaleString("en-IN")}</span></div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register("notes")} rows={2} placeholder="Payment instructions, notes..." />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="save-invoice-btn">
                Create Invoice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
