import { useState } from "react";
import { useAuth } from "@/App";
import { canManageModule } from "@/lib/permissions";
import {
  useListPurchaseOrders, useCreatePurchaseOrder, useUpdatePurchaseOrder, useDeletePurchaseOrder,
  useListClients, getListPurchaseOrdersQueryKey,
} from "@workspace/api-client-react";
import type { PurchaseOrderInput, PurchaseOrder } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WriteWithAI } from "@/components/common/WriteWithAI";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { Plus, Trash2, ShoppingCart, Eye, Pencil, Download, Loader2, Receipt, FileCheck, Landmark } from "lucide-react";
import { authHeaders } from "@/components/invoices/invoice-helpers";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  openPrintWindow,
  buildPurchaseOrderHtml,
  getSavedBusinessDetails,
  type PurchaseOrderPdfData,
} from "@/lib/pdf-print";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT:              { label: "Draft",              className: "bg-slate-100 text-slate-600 dark:bg-slate-900/50 dark:text-slate-400" },
  SENT:               { label: "Sent",               className: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" },
  APPROVED:           { label: "Approved",           className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" },
  ORDERED:            { label: "Ordered",            className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400" },
  PARTIALLY_RECEIVED: { label: "Partially Received", className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  RECEIVED:           { label: "Received",           className: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400" },
  CANCELLED:          { label: "Cancelled",          className: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" },
};

const GST_RATES = [0, 5, 12, 18, 28];

type LineItem = { description: string; hsnSac?: string; qty: number; unitPrice: number; taxPercent: number };
type POFormData = Omit<PurchaseOrderInput, "lineItems"> & { lineItems: LineItem[]; number?: string };

function calcTotals(items: LineItem[]) {
  let subtotal = 0;
  let tax = 0;
  for (const item of items) {
    const amt = (item.qty || 0) * (item.unitPrice || 0);
    subtotal += amt;
    tax += amt * ((item.taxPercent || 0) / 100);
  }
  return { subtotal, taxAmount: tax, total: subtotal + tax };
}

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<"list" | "form" | "detail">("list");
  const [selectedState, setSelected] = useState<PurchaseOrder | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Receipt & GST Ledger State
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptTargetPo, setReceiptTargetPo] = useState<any>(null);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [vendorGstin, setVendorGstin] = useState("");
  const [paymentMode, setPaymentMode] = useState("BANK_TRANSFER");
  const [itcEligible, setItcEligible] = useState(true);

  const handleSaveReceipt = async () => {
    if (!receiptTargetPo) return;
    try {
      const res = await fetch(`/api/purchase-orders/${receiptTargetPo.id}/receipt`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({
          receiptNumber,
          receiptDate,
          receiptUrl,
          vendorGstin,
          paymentMode,
          itcEligible,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Vendor receipt & GST Input Credit (ITC) saved!");
      setReceiptDialogOpen(false);
      qc.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
      qc.invalidateQueries({ queryKey: ["gst-ledger-summary"] });
    } catch {
      toast.error("Failed to save receipt details");
    }
  };

  const { data: orders, isLoading } = useListPurchaseOrders();
  const { data: clients } = useListClients(undefined, {
    query: { enabled: canManageModule(user, "clients") } as any,
  });

  const selected = selectedState ? (orders ?? []).find(o => o.id === selectedState.id) as PurchaseOrder || selectedState : null;

  const handleDownloadPdf = async (poToDownload?: PurchaseOrder) => {
    const target = poToDownload ?? selected;
    if (!target || downloadingId === target.id) return;

    setDownloadingId(target.id);
    try {
      const biz = getSavedBusinessDetails();
      const vendorClient = clients?.find((c) => c.id === target.clientId);

      const pdfData: PurchaseOrderPdfData = {
        number: target.number,
        orderDate: target.orderDate ? format(new Date(target.orderDate), "dd MMM yyyy") : "—",
        deliveryDate: target.deliveryDate ? format(new Date(target.deliveryDate), "dd MMM yyyy") : undefined,
        status: target.status,
        currency: "INR",
        gstType: "CGST_SGST",

        businessName: biz.businessName || "BLINK BEYOND",
        businessPhone: biz.businessPhone,
        companyGstin: target.companyGstin || biz.businessGstin,
        businessAddress: biz.businessAddress,
        businessCity: biz.businessCity,
        businessPostalCode: biz.businessPostalCode,
        businessState: biz.businessState,
        businessEmail: biz.businessEmail,
        businessPan: biz.businessPan,

        vendorName: vendorClient?.companyName || (target as any).clientName || "—",
        contactPerson: vendorClient?.contactPerson || undefined,
        vendorPhone: vendorClient?.phone || undefined,
        vendorEmail: vendorClient?.email || undefined,
        vendorGstin: target.vendorGstin || (vendorClient as any)?.gstin,
        vendorAddress: target.billingAddress || undefined,

        lineItems: (target.lineItems as LineItem[]) ?? [],
        subtotal: target.subtotal ?? 0,
        taxAmount: target.taxAmount ?? 0,
        total: target.total ?? 0,

        notes: target.notes,
        termsAndConditions: target.termsAndConditions,
      };

      const html = buildPurchaseOrderHtml(pdfData);
      const filename = `PurchaseOrder-${target.number || "PO"}`;
      openPrintWindow(html, filename);
      toast.success(`Purchase Order ${target.number ?? ""} PDF ready for download`);
    } catch (error) {
      console.error("Failed to generate Purchase Order PDF:", error);
      toast.error("Failed to generate Purchase Order PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const createMutation = useCreatePurchaseOrder({
    mutation: {
      onSuccess: () => {
        toast.success("Purchase Order created");
        qc.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
        setView("list");
      },
      onError: () => toast.error("Failed to create PO"),
    },
  });

  const updateMutation = useUpdatePurchaseOrder({
    mutation: {
      onSuccess: (data) => {
        toast.success("Purchase Order updated");
        qc.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
        setSelected(data as PurchaseOrder);
        setEditMode(false);
        setView("detail");
      },
      onError: () => toast.error("Failed to update PO"),
    },
  });

  const updateStatusMutation = useUpdatePurchaseOrder({
    mutation: {
      onSuccess: (data) => {
        toast.success("Purchase Order status updated");
        qc.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
        setSelected((prev) => prev && prev.id === data.id ? (data as PurchaseOrder) : prev);
      },
      onError: () => toast.error("Failed to update status"),
    },
  });

  const deleteMutation = useDeletePurchaseOrder({
    mutation: {
      onSuccess: () => {
        toast.success("Purchase Order deleted");
        qc.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
        setView("list");
        setDeleteId(null);
      },
    },
  });

  const { register, handleSubmit, control, watch, reset, setValue } = useForm<POFormData>({
    defaultValues: {
      status: "DRAFT",
      lineItems: [{ description: "", hsnSac: "", qty: 1, unitPrice: 0, taxPercent: 18 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });
  const watchedItems = watch("lineItems") ?? [];
  const { subtotal, taxAmount, total } = calcTotals(watchedItems);

  const openNew = () => {
    setEditMode(false);
    setSelected(null);
    reset({
      status: "DRAFT",
      lineItems: [{ description: "", hsnSac: "", qty: 1, unitPrice: 0, taxPercent: 18 }],
    });
    setView("form");
  };

  const openEdit = (po: PurchaseOrder) => {
    setSelected(po);
    setEditMode(true);
    reset({
      number: po.number ?? "",
      status: po.status ?? "DRAFT",
      clientId: po.clientId ?? "",
      orderDate: po.orderDate ?? "",
      deliveryDate: po.deliveryDate ?? "",
      companyGstin: po.companyGstin ?? "",
      vendorGstin: po.vendorGstin ?? "",
      billingAddress: po.billingAddress ?? "",
      shippingAddress: po.shippingAddress ?? "",
      notes: po.notes ?? "",
      termsAndConditions: po.termsAndConditions ?? "",
      lineItems: (po.lineItems as LineItem[]) ?? [{ description: "", qty: 1, unitPrice: 0, taxPercent: 18 }],
    });
    setView("form");
  };

  const onSubmit = (data: POFormData) => {
    const { subtotal: s, taxAmount: t, total: tot } = calcTotals(data.lineItems ?? []);
    const body = { ...data, subtotal: s, taxAmount: t, total: tot, clientId: data.clientId || null } as PurchaseOrderInput;
    if (editMode && selected) {
      updateMutation.mutate({ id: selected.id, data: body });
    } else {
      createMutation.mutate({ data: body });
    }
  };

  const filtered = (orders ?? []).filter((po) => statusFilter === "ALL" || po.status === statusFilter);

  // ─── Detail View ────────────────────────────────────────────────────────────
  if (view === "detail" && selected) {
    const sc = STATUS_CONFIG[selected.status ?? "DRAFT"] ?? STATUS_CONFIG.DRAFT;
    return (
      <div className="p-6 space-y-6 animated-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView("list")}>← Back</Button>
          <h1 className="text-xl font-bold font-heading">{selected.number ?? "Purchase Order"}</h1>
          <Select
            value={selected.status ?? "DRAFT"}
            onValueChange={(v) => {
              if (v) {
                updateStatusMutation.mutate({ id: selected.id, data: { status: v } });
              }
            }}
          >
            <SelectTrigger className="h-7 text-xs w-40 border-0 bg-transparent p-0 shadow-none focus:ring-0">
              <Badge className={cn("text-xs border cursor-pointer", sc.className)}>
                {sc.label}
              </Badge>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={downloadingId === selected.id}
              onClick={() => handleDownloadPdf(selected)}
            >
              {downloadingId === selected.id ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" />
              )}
              Download PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => openEdit(selected)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteId(selected.id)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card><CardContent className="p-5 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Order Details</p>
            {selected.orderDate && <p className="text-sm"><span className="font-medium">Order Date:</span> {format(new Date(selected.orderDate), "dd MMM yyyy")}</p>}
            {selected.deliveryDate && <p className="text-sm"><span className="font-medium">Delivery Date:</span> {format(new Date(selected.deliveryDate), "dd MMM yyyy")}</p>}
            {selected.companyGstin && <p className="text-sm"><span className="font-medium">Company GSTIN:</span> {selected.companyGstin}</p>}
            {selected.vendorGstin && <p className="text-sm"><span className="font-medium">Vendor GSTIN:</span> {selected.vendorGstin}</p>}
          </CardContent></Card>
          <Card><CardContent className="p-5 space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Vendor / Client</p>
            <p className="text-sm font-medium">{(selected as any).clientName ?? "—"}</p>
            {selected.billingAddress && <p className="text-sm text-muted-foreground">{selected.billingAddress}</p>}
          </CardContent></Card>
        </div>

        {/* Line Items */}
        <Card><CardContent className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Description</TableHead>
                <TableHead>HSN/SAC</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Tax %</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(selected.lineItems as LineItem[] ?? []).map((item, i) => {
                const amt = (item.qty || 0) * (item.unitPrice || 0);
                const taxAmt = amt * ((item.taxPercent || 0) / 100);
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{item.description}</TableCell>
                    <TableCell className="text-muted-foreground">{item.hsnSac ?? "—"}</TableCell>
                    <TableCell className="text-right">{item.qty}</TableCell>
                    <TableCell className="text-right">₹{item.unitPrice.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right">{item.taxPercent}%</TableCell>
                    <TableCell className="text-right font-medium">₹{(amt + taxAmt).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="p-5 border-t space-y-1.5 text-sm text-right">
            <p>Subtotal: <span className="font-medium ml-2">₹{(selected.subtotal ?? 0).toLocaleString("en-IN")}</span></p>
            <p>Tax: <span className="font-medium ml-2">₹{(selected.taxAmount ?? 0).toLocaleString("en-IN")}</span></p>
            <p className="text-lg font-bold text-foreground">Total: ₹{(selected.total ?? 0).toLocaleString("en-IN")}</p>
          </div>
        </CardContent></Card>

        {selected.notes && (
          <Card><CardContent className="p-5">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Notes</p>
            <p className="text-sm text-muted-foreground">{selected.notes}</p>
          </CardContent></Card>
        )}

        {/* Delete confirm dialog */}
        <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Delete Purchase Order?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Form View ──────────────────────────────────────────────────────────────
  if (view === "form") {
    return (
      <div className="p-6 animated-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => setView("list")}>← Back</Button>
          <h1 className="text-xl font-bold font-heading">{editMode ? "Edit" : "New"} Purchase Order</h1>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl mx-auto">
          <WriteWithAI
            context="purchase-order"
            onFill={(fields) => {
              if (fields.notes) setValue("notes", fields.notes, { shouldDirty: true });
              if (fields.termsAndConditions) setValue("termsAndConditions", fields.termsAndConditions, { shouldDirty: true });
              if (Array.isArray(fields.lineItems) && fields.lineItems.length > 0) {
                setValue("lineItems", fields.lineItems, { shouldDirty: true });
              }
            }}
          />
          {/* Meta */}
          <Card><CardContent className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>PO Number</Label>
              <Input {...register("number")} placeholder="Auto-generated" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Controller control={control} name="status" render={({ field }) => (
                <Select value={field.value ?? "DRAFT"} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div className="space-y-1.5">
              <Label>Order Date</Label>
              <Input {...register("orderDate")} type="date" />
            </div>
            <div className="space-y-1.5">
              <Label>Delivery Date</Label>
              <Input {...register("deliveryDate")} type="date" />
            </div>
          </CardContent></Card>

          {/* Vendor */}
          <Card><CardContent className="p-5 space-y-4">
            <p className="text-sm font-semibold text-foreground">Vendor / Client</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Client / Vendor</Label>
                <Controller control={control} name="clientId" render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select client or vendor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No client</SelectItem>
                      {(clients ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label>Company GSTIN</Label>
                <Input {...register("companyGstin")} placeholder="Your GSTIN" />
              </div>
              <div className="space-y-1.5">
                <Label>Vendor GSTIN</Label>
                <Input {...register("vendorGstin")} placeholder="Vendor GSTIN" />
              </div>
              <div className="space-y-1.5">
                <Label>Billing Address</Label>
                <Input {...register("billingAddress")} placeholder="Billing address" />
              </div>
            </div>
          </CardContent></Card>

          {/* Line Items */}
          <Card><CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Line Items</p>
              <Button type="button" variant="outline" size="sm" onClick={() =>
                append({ description: "", hsnSac: "", qty: 1, unitPrice: 0, taxPercent: 18 })
              }>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Item
              </Button>
            </div>
            <div className="space-y-3">
              {fields.map((field, idx) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="col-span-4">
                    <Input {...register(`lineItems.${idx}.description`)} placeholder="Description" className="h-8 text-sm" required />
                  </div>
                  <div className="col-span-2">
                    <Input {...register(`lineItems.${idx}.hsnSac`)} placeholder="HSN/SAC" className="h-8 text-sm" />
                  </div>
                  <div className="col-span-1">
                    <Input {...register(`lineItems.${idx}.qty`, { valueAsNumber: true })} type="number" min={1} placeholder="Qty" className="h-8 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Input {...register(`lineItems.${idx}.unitPrice`, { valueAsNumber: true })} type="number" min={0} step="0.01" placeholder="Rate" className="h-8 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Controller control={control} name={`lineItems.${idx}.taxPercent`} render={({ field }) => (
                      <Select value={String(field.value ?? 18)} onValueChange={(v) => field.onChange(Number(v))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {GST_RATES.map((r) => <SelectItem key={r} value={String(r)}>{r}% GST</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )} />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-right text-sm space-y-1 pt-3 border-t border-border">
              <p>Subtotal: <span className="font-medium ml-2">₹{subtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></p>
              <p>Tax: <span className="font-medium ml-2">₹{taxAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></p>
              <p className="text-base font-bold">Total: ₹{total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
            </div>
          </CardContent></Card>

          {/* Notes */}
          <Card><CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea {...register("notes")} rows={3} placeholder="Additional notes..." />
            </div>
            <div className="space-y-1.5">
              <Label>Terms & Conditions</Label>
              <Textarea {...register("termsAndConditions")} rows={3} placeholder="Terms and conditions..." />
            </div>
          </CardContent></Card>

          <div className="flex gap-3 justify-end pb-6">
            <Button type="button" variant="outline" onClick={() => setView("list")}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {editMode ? "Save Changes" : "Create Purchase Order"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // ─── List View ───────────────────────────────────────────────────────────────
  const totalPurchases = (orders ?? []).reduce((acc, o) => acc + (Number(o.total) || 0), 0);
  const totalTaxPaid = (orders ?? []).reduce((acc, o) => acc + (Number(o.taxAmount) || 0), 0);
  const eligibleItcTotal = (orders ?? []).filter((o: any) => o.itcEligible !== "false" && o.itcEligible !== false).reduce((acc, o) => acc + (Number(o.taxAmount) || 0), 0);
  const receiptsLoggedCount = (orders ?? []).filter((o: any) => Boolean(o.receiptNumber)).length;

  return (
    <div className="p-6 space-y-5 animated-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" />
            Purchase Orders & GST Receipts Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Log vendor purchases, incoming bills, and claim GST Input Tax Credit (ITC).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "ALL")}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openNew} className="gap-2 btn-micro-anim">
            <Plus className="h-4 w-4" /> New PO
          </Button>
        </div>
      </div>

      {/* Accountant GST & Receipts Overview Card */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total PO Purchases</p>
            <p className="text-xl font-bold font-mono mt-1">₹{totalPurchases.toLocaleString("en-IN")}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{(orders ?? []).length} total purchase orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Input GST Paid</p>
            <p className="text-xl font-bold font-mono mt-1 text-slate-700 dark:text-slate-300">₹{totalTaxPaid.toLocaleString("en-IN")}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Total GST paid to vendors</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Eligible ITC Claim</p>
            <p className="text-xl font-bold font-mono mt-1 text-emerald-600">₹{eligibleItcTotal.toLocaleString("en-IN")}</p>
            <p className="text-[11px] text-emerald-600 mt-0.5">Input Tax Credit against output GST</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Receipts Logged</p>
            <p className="text-xl font-bold font-mono mt-1 text-primary">{receiptsLoggedCount} / {(orders ?? []).length}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Official bills on record</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-muted/20 border border-dashed rounded-xl p-8">
          <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-foreground">No purchase orders yet</p>
          <p className="text-sm mt-1">Create your first purchase order or log incoming vendor receipts.</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Vendor / Client</TableHead>
                <TableHead>Receipt & Bill</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead className="text-right">Total (₹)</TableHead>
                <TableHead className="text-right">GST (ITC)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((po: any) => {
                const sc = STATUS_CONFIG[po.status ?? "DRAFT"] ?? STATUS_CONFIG.DRAFT;
                const hasReceipt = Boolean(po.receiptNumber);
                const itcClaim = po.itcEligible !== "false" && po.itcEligible !== false;

                return (
                  <TableRow key={po.id} className="cursor-pointer hover:bg-muted/30" onClick={() => { setSelected(po); setView("detail"); }}>
                    <TableCell className="font-semibold text-primary">{po.number}</TableCell>
                    <TableCell>
                      <p className="font-medium">{po.clientName ?? po.vendorNameSnapshot ?? "—"}</p>
                      {po.vendorGstin && <p className="text-[11px] text-muted-foreground">GSTIN: {po.vendorGstin}</p>}
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      {hasReceipt ? (
                        <div>
                          <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200">
                            {po.receiptNumber}
                          </Badge>
                          {po.receiptDate && <span className="block text-[10px] text-muted-foreground">{po.receiptDate}</span>}
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[11px] text-amber-600 hover:text-amber-700 p-0"
                          onClick={() => {
                            setReceiptTargetPo(po);
                            setReceiptNumber(po.receiptNumber || "");
                            setReceiptDate(po.receiptDate || new Date().toISOString().split("T")[0]);
                            setReceiptUrl(po.receiptUrl || "");
                            setVendorGstin(po.vendorGstin || "");
                            setPaymentMode(po.paymentMode || "BANK_TRANSFER");
                            setItcEligible(po.itcEligible !== "false" && po.itcEligible !== false);
                            setReceiptDialogOpen(true);
                          }}
                        >
                          + Log Receipt
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{po.orderDate ? format(new Date(po.orderDate), "dd MMM yyyy") : "—"}</TableCell>
                    <TableCell className="text-right font-medium font-mono">₹{(po.total ?? 0).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      <span className={cn(itcClaim ? "text-emerald-600 font-semibold" : "text-muted-foreground")}>
                        ₹{Number(po.taxAmount ?? 0).toFixed(0)}
                      </span>
                      {itcClaim && <span className="block text-[10px] text-emerald-600">ITC Claimable</span>}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={po.status ?? "DRAFT"}
                        onValueChange={(v) => {
                          if (v) {
                            updateStatusMutation.mutate({ id: po.id, data: { status: v } });
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs w-32 border-0 bg-transparent p-0 shadow-none focus:ring-0">
                          <Badge className={cn("text-xs border cursor-pointer", sc.className)}>
                            {sc.label}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-slate-600 hover:text-foreground"
                          title="Log Vendor Bill & Receipt"
                          onClick={() => {
                            setReceiptTargetPo(po);
                            setReceiptNumber(po.receiptNumber || "");
                            setReceiptDate(po.receiptDate || new Date().toISOString().split("T")[0]);
                            setReceiptUrl(po.receiptUrl || "");
                            setVendorGstin(po.vendorGstin || "");
                            setPaymentMode(po.paymentMode || "BANK_TRANSFER");
                            setItcEligible(po.itcEligible !== "false" && po.itcEligible !== false);
                            setReceiptDialogOpen(true);
                          }}
                        >
                          <Receipt className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Download PDF"
                          disabled={downloadingId === po.id}
                          onClick={() => handleDownloadPdf(po)}
                        >
                          {downloadingId === po.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="View Details" onClick={() => { setSelected(po); setView("detail"); }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Log Receipt & GST Dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> Log Vendor Bill & Receipt: {receiptTargetPo?.number}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="p-3 bg-muted rounded-lg text-xs space-y-1">
              <p><span className="text-muted-foreground">PO Total:</span> <span className="font-mono font-bold">₹{Number(receiptTargetPo?.total || 0).toLocaleString("en-IN")}</span></p>
              <p><span className="text-muted-foreground">PO GST Paid:</span> <span className="font-mono font-bold text-emerald-600">₹{Number(receiptTargetPo?.taxAmount || 0).toLocaleString("en-IN")}</span></p>
            </div>

            <div className="space-y-1.5">
              <Label>Vendor Receipt / Invoice Number *</Label>
              <Input
                placeholder="e.g. BILL-9824 or REC-2026-01"
                value={receiptNumber}
                onChange={e => setReceiptNumber(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Receipt Date</Label>
                <Input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Payment Mode</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer / NEFT</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Vendor GSTIN</Label>
              <Input placeholder="e.g. 27AAAAA0000A1Z5" value={vendorGstin} onChange={e => setVendorGstin(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Receipt Document / Bill URL</Label>
              <Input placeholder="e.g. https://drive.google.com/... or file attachment" value={receiptUrl} onChange={e => setReceiptUrl(e.target.value)} />
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={itcEligible} onCheckedChange={(c) => setItcEligible(Boolean(c))} />
                <span>Eligible for GST Input Tax Credit (ITC)</span>
              </label>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setReceiptDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveReceipt}>Save Receipt & Claim ITC</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
