import { useState, useRef } from "react";
import { useAuth } from "@/App";
import { canManageModule } from "@/lib/permissions";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useListClients, getListInvoicesQueryKey, getGetFinancialSummaryQueryKey, getListClientsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WriteWithAI } from "@/components/common/WriteWithAI";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Trash2, Receipt, ArrowLeft, UploadCloud, ImageIcon, X as XIcon,
  IndianRupee, Building2, User, FileText, Banknote, Download, Sheet, Sparkles,
} from "lucide-react";
import { openPrintWindow, buildInvoiceHtml, type InvoiceData } from "@/lib/pdf-print";
import { exportInvoiceToExcel, exportInvoiceToCsv } from "@/lib/invoice-excel-export";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import {
  sym, amountToWords, authHeaders, LineItem, BuilderForm,
} from "./invoice-helpers";

const BKEY = "agencyos_biz_details";

function loadBiz(): Partial<BuilderForm> {
  try { return JSON.parse(localStorage.getItem(BKEY) ?? "{}"); } catch { return {}; }
}

function saveBiz(data: BuilderForm) {
  const keys: (keyof BuilderForm)[] = [
    "businessName", "businessPhone", "businessGstin", "businessAddress",
    "businessCity", "businessPostalCode", "businessState", "businessEmail", "businessPan",
    "bankName", "bankAccount", "bankIfsc", "bankAccountName",
  ];
  const save: Partial<BuilderForm> = {};
  keys.forEach(k => { (save as Record<string, unknown>)[k] = data[k]; });
  localStorage.setItem(BKEY, JSON.stringify(save));
}

export function InvoiceBuilder({ onBack, editData }: { onBack: () => void; editData?: Record<string, unknown> | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canViewClients = canManageModule(user, "clients");
  const { data: clients } = useListClients(undefined, {
    query: { enabled: canViewClients } as any,
  });
  const logoRef = useRef<HTMLInputElement>(null);
  const sigRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [sigUploading, setSigUploading] = useState(false);
  const [invoiceType, setInvoiceType] = useState<"TAX_INVOICE" | "PROFORMA">(
    ((editData?.invoiceType as string) === "PROFORMA" ? "PROFORMA" : "TAX_INVOICE")
  );

  const biz = loadBiz();
  const defaults: BuilderForm = {
    invoiceNumber: "", invoiceDate: new Date().toISOString().split("T")[0], dueDate: "",
    currency: "INR", gstType: "CGST_SGST",
    logoUrl: (editData?.logoUrl as string) ?? biz.logoUrl ?? "",
    businessName: (editData?.businessName as string) ?? biz.businessName ?? "BLINK BEYOND",
    businessPhone: (editData?.businessPhone as string) ?? biz.businessPhone ?? "+91 95455 56009",
    businessGstin: (editData?.companyGstin as string) ?? biz.businessGstin ?? "27ABGFB9280J1Z0",
    businessAddress: (editData?.businessAddress as string) ?? biz.businessAddress ?? "Ground Floor, Shop No. 07, Ali Chamber Apt., Manor Road, Near Kotak Mahindra Bank, Palghar West",
    businessCity: (editData?.businessCity as string) ?? biz.businessCity ?? "Palghar",
    businessPostalCode: (editData?.businessPostalCode as string) ?? biz.businessPostalCode ?? "401404",
    businessState: (editData?.businessState as string) ?? biz.businessState ?? "Maharashtra",
    businessEmail: (editData?.businessEmail as string) ?? biz.businessEmail ?? "billing@blinkbeyond.com",
    businessPan: (editData?.businessPan as string) ?? biz.businessPan ?? "",
    clientId: (editData?.clientId as string) ?? "",
    clientPhone: (editData?.clientPhone as string) ?? "",
    clientGstin: (editData?.clientGstin as string) ?? "",
    clientAddress: (editData?.billingAddress as string) ?? "",
    clientCity: (editData?.clientCity as string) ?? "",
    clientPostalCode: (editData?.clientPostalCode as string) ?? "",
    clientState: (editData?.clientState as string) ?? "",
    clientEmail: (editData?.clientEmail as string) ?? "",
    clientPan: (editData?.clientPan as string) ?? "",
    lineItems: (editData?.lineItems as LineItem[]) ?? [{ description: "", hsnSac: "", taxPercent: 18, qty: 1, unitPrice: 0 }],
    discount: (editData?.discount as number) ?? 0,
    discountType: (editData?.discountType as string) ?? "FIXED",
    termsAndConditions: (editData?.termsAndConditions as string) ?? "",
    notes: (editData?.notes as string) ?? "",
    bankName: (editData?.bankDetails as Record<string, string>)?.bankName ?? biz.bankName ?? "HDFC BANK LIMITED",
    bankAccount: (editData?.bankDetails as Record<string, string>)?.accountNumber ?? biz.bankAccount ?? "50200121903920",
    bankIfsc: (editData?.bankDetails as Record<string, string>)?.ifsc ?? biz.bankIfsc ?? "HDFC0000663",
    bankAccountName: (editData?.bankDetails as Record<string, string>)?.accountName ?? biz.bankAccountName ?? "BLINK BEYOND",
    signatureUrl: (editData?.signatureUrl as string) ?? "",
    ...(!editData && {
      invoiceNumber: "",
      currency: (editData as any)?.currency ?? "INR",
      gstType: (editData as any)?.gstType ?? "CGST_SGST",
    }),
  };
  if (editData) {
    defaults.invoiceNumber = (editData.number as string) ?? "";
    defaults.currency = (editData.currency as string) ?? "INR";
    defaults.gstType = (editData.gstType as string) ?? "CGST_SGST";
    defaults.invoiceDate = (editData.invoiceDate as string) ?? defaults.invoiceDate;
    defaults.dueDate = (editData.dueDate as string) ?? "";
  }

  const { register, control, watch, setValue, handleSubmit } = useForm<BuilderForm>({ defaultValues: defaults });
  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });
  const watched = watch();

  const lines = watched.lineItems ?? [];
  const subtotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
  const totalTax = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0) * (Number(l.taxPercent) || 0) / 100, 0);
  const discountAmt = watched.discountType === "PERCENT"
    ? subtotal * (Number(watched.discount) || 0) / 100
    : Number(watched.discount) || 0;
  const grandTotal = subtotal + totalTax - discountAmt;
  const isIGST = watched.gstType === "IGST";
  const s = sym(watched.currency ?? "INR");

  async function uploadFile(file: File, setUploading: (v: boolean) => void, field: "logoUrl" | "signatureUrl") {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", headers: authHeaders(), body: fd });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setValue(field, data.url);
      toast.success("Uploaded!");
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  }

  async function onSubmit(data: BuilderForm) {
    setSaving(true);
    saveBiz(data);
    const lineItems = data.lineItems.map(l => ({
      description: l.description, hsnSac: l.hsnSac || undefined,
      qty: Number(l.qty), unitPrice: Number(l.unitPrice), taxPercent: Number(l.taxPercent),
    }));
    const payload = {
      number: data.invoiceNumber || undefined,
      invoiceType,
      clientId: data.clientId || undefined,
      invoiceDate: data.invoiceDate, dueDate: data.dueDate || undefined,
      currency: data.currency, gstType: data.gstType,
      logoUrl: data.logoUrl || undefined,
      businessName: data.businessName || undefined,
      businessPhone: data.businessPhone || undefined, companyGstin: data.businessGstin || undefined,
      businessAddress: data.businessAddress || undefined, businessCity: data.businessCity || undefined,
      businessPostalCode: data.businessPostalCode || undefined, businessState: data.businessState || undefined,
      businessEmail: data.businessEmail || undefined, businessPan: data.businessPan || undefined,
      clientGstin: data.clientGstin || undefined, clientPhone: data.clientPhone || undefined,
      clientEmail: data.clientEmail || undefined, clientPan: data.clientPan || undefined,
      billingAddress: data.clientAddress || undefined, clientCity: data.clientCity || undefined,
      clientPostalCode: data.clientPostalCode || undefined, clientState: data.clientState || undefined,
      subtotal, taxAmount: totalTax, discount: discountAmt, discountType: data.discountType, total: grandTotal,
      lineItems,
      notes: data.notes || undefined, termsAndConditions: data.termsAndConditions || undefined,
      signatureUrl: data.signatureUrl || undefined,
      bankDetails: (data.bankName || data.bankAccount)
        ? { bankName: data.bankName, accountNumber: data.bankAccount, ifsc: data.bankIfsc, accountName: data.bankAccountName }
        : undefined,
    };
    try {
      const url = editData ? `/api/invoices/${(editData as Record<string, string>).id}` : "/api/invoices";
      const method = editData ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: authHeaders(true), body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      toast.success(editData ? "Invoice updated!" : "Invoice created & client profile updated!");
      qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetFinancialSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
      onBack();
    } catch { toast.error("Failed to save invoice"); }
    finally { setSaving(false); }
  }

  const SectionHead = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
      <span className="text-primary">{icon}</span>
      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">{title}</h3>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="sticky top-0 z-20 bg-background border-b border-border px-6 py-3 flex items-center justify-between shadow-xs">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </button>
        <h1 className="font-bold font-heading text-base">{editData ? "Edit Invoice" : "New Invoice"}</h1>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            onClick={() => {
              const activeClient = (clients ?? []).find(c => c.id === watched.clientId);
              exportInvoiceToExcel({
                ...watched,
                clientName: activeClient?.companyName || (watched as any).clientName,
                subtotal,
                taxAmount: totalTax,
                total: grandTotal,
              });
              toast.success("Downloaded Excel Invoice (.xlsx)!");
            }}
          >
            <Sheet className="h-3.5 w-3.5 text-emerald-600" /> Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs text-blue-700 dark:text-blue-400 border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-950/30"
            onClick={() => {
              const activeClient = (clients ?? []).find(c => c.id === watched.clientId);
              exportInvoiceToCsv({
                ...watched,
                clientName: activeClient?.companyName || (watched as any).clientName,
                subtotal,
                taxAmount: totalTax,
                total: grandTotal,
              });
              toast.success("Downloaded CSV Invoice (.csv)!");
            }}
          >
            <Download className="h-3.5 w-3.5 text-blue-600" /> CSV
          </Button>
          {editData && (
            <Button
              variant="outline" size="sm" className="gap-1.5"
              onClick={() => openPrintWindow(buildInvoiceHtml(editData as InvoiceData), `Invoice-${(editData as Record<string,string>).number ?? "draft"}`)}
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleSubmit(async (d) => { (d as any).status = "DRAFT"; await onSubmit(d as BuilderForm); })} disabled={saving}>
            Save Draft
          </Button>
          <Button size="sm" onClick={handleSubmit(onSubmit)} disabled={saving} className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> {saving ? "Saving…" : editData ? "Update Invoice" : "Create Invoice"}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-5">
        <WriteWithAI
          context="invoice"
          onFill={(fields) => {
            if (fields.currency) setValue("currency", fields.currency, { shouldDirty: true });
            if (fields.notes) setValue("notes", fields.notes, { shouldDirty: true });
            if (fields.termsAndConditions) setValue("termsAndConditions", fields.termsAndConditions, { shouldDirty: true });
            if (Array.isArray(fields.lineItems) && fields.lineItems.length > 0) {
              setValue("lineItems", fields.lineItems, { shouldDirty: true });
            }
          }}
        />

        {/* Invoice Info */}
        <Card>
          <CardContent className="p-5">
            <SectionHead icon={<Receipt className="h-4 w-4" />} title="Invoice Details" />
            
            <div className="mb-4 p-3 bg-muted/40 rounded-xl border border-border flex items-center justify-between gap-3 flex-wrap">
              <div>
                <Label className="text-xs font-semibold">Document Type *</Label>
                <p className="text-xs text-muted-foreground">Select whether this is an official Tax Invoice or an advance Proforma Invoice (PI)</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={invoiceType === "TAX_INVOICE" ? "default" : "outline"}
                  onClick={() => setInvoiceType("TAX_INVOICE")}
                  className="text-xs"
                >
                  Tax Invoice
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={invoiceType === "PROFORMA" ? "default" : "outline"}
                  onClick={() => setInvoiceType("PROFORMA")}
                  className="text-xs bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Proforma Invoice (PI)
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice No *</Label>
                <Input {...register("invoiceNumber")} placeholder="0003 (auto if blank)" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice Date *</Label>
                <Input {...register("invoiceDate")} type="date" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Due Date</Label>
                <Input {...register("dueDate")} type="date" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Currency</Label>
                <Controller control={control} name="currency" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR — ₹ Indian Rupee</SelectItem>
                      <SelectItem value="USD">USD — $ US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR — € Euro</SelectItem>
                      <SelectItem value="GBP">GBP — £ British Pound</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">GST Type</Label>
                <Controller control={control} name="gstType" render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CGST_SGST">CGST + SGST (Intra-State)</SelectItem>
                      <SelectItem value="IGST">IGST (Inter-State)</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fixed Issuer Details: BLINK BEYOND (Master Template Format) */}
        <Card className="border-primary/20 bg-linear-to-r from-primary/5 via-card to-background">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-lg shadow-xs">
                  BB
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-base tracking-tight text-foreground">BLINK BEYOND</h2>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Master Template • MSME Registered
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    WEBSITE | SOCIAL MEDIA | MARKETING • Digital Marketing Agency
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ground Floor, Shop No. 07, Ali Chamber Apt., Manor Road, Near Kotak Mahindra Bank, Palghar West, Maharashtra, 401404
                  </p>
                </div>
              </div>
              <div className="text-right text-xs space-y-1">
                <div className="font-mono font-semibold text-primary">GSTIN: 27ABGFB9280J1Z0</div>
                <div className="text-muted-foreground">support@blinkbeyond.co.in • +91 95455 56009</div>
                <div className="text-muted-foreground font-mono text-[11px]">HDFC Bank A/C: 50200121903920 • IFSC: HDFC0000663</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Client Details */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-primary"><User className="h-4 w-4" /></span>
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Client Selection & Billing Details</h3>
              </div>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/20">
                ✨ Saved client details auto-load & auto-persist
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                {canViewClients ? (
                  <>
                    <Label className="text-xs font-semibold">Select Client *</Label>
                    <Controller control={control} name="clientId" render={({ field }) => (
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(val) => {
                          field.onChange(val);
                          const selected = (clients ?? []).find(c => c.id === val);
                          if (selected) {
                            setValue("clientPhone", selected.phone || "");
                            setValue("clientEmail", selected.email || "");
                            setValue("clientGstin", (selected as any).gstin || "");
                            setValue("clientAddress", (selected as any).billingAddress || (selected as any).address || "");
                            setValue("clientCity", (selected as any).city || "");
                            setValue("clientState", (selected as any).state || "Maharashtra");
                            setValue("clientPostalCode", (selected as any).postalCode || "");
                            setValue("clientPan", (selected as any).panNumber || "");

                            const cState = ((selected as any).state || "").trim().toLowerCase();
                            const cGstin = ((selected as any).gstin || "").trim();
                            const isInterstate = (!cState.includes("maharashtra") && !cState.includes("mh") && !cGstin.startsWith("27") && cState.length > 0);
                            setValue("gstType", isInterstate ? "IGST" : "CGST_SGST");

                            if ((selected as any).monthlyRetainer) {
                              const ret = Number((selected as any).monthlyRetainer);
                              if (ret > 0) {
                                setValue("lineItems", [{
                                  description: `Digital Marketing & Social Media Retainer - ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
                                  hsnSac: "998361",
                                  taxPercent: 18,
                                  qty: 1,
                                  unitPrice: ret,
                                }]);
                                toast.success(`✨ Auto-filled ${selected.companyName} retainer (₹${ret.toLocaleString("en-IN")}) with SAC 998361!`);
                              }
                            } else {
                              toast.success(`✨ Auto-filled ${selected.companyName} billing details!`);
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="font-medium text-sm h-10"><SelectValue placeholder="Choose a client from directory…" /></SelectTrigger>
                        <SelectContent>
                          {(clients ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )} />
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Enable the Clients section to link an invoice to a saved client.
                  </p>
                )}
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Billing Address</Label>
                <Input {...register("clientAddress")} placeholder="Street address / Office premises" />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">City</Label>
                <Input {...register("clientCity")} placeholder="e.g. Mumbai, Palghar, Pune" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">State / Place of Supply</Label>
                <Input
                  {...register("clientState")}
                  placeholder="Maharashtra"
                  onChange={(e) => {
                    const st = e.target.value.trim().toLowerCase();
                    const gstin = (watched.clientGstin || "").trim();
                    const isInter = (!st.includes("maharashtra") && !st.includes("mh") && !gstin.startsWith("27") && st.length > 0);
                    setValue("gstType", isInter ? "IGST" : "CGST_SGST");
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Postal Code (PIN)</Label>
                <Input {...register("clientPostalCode")} placeholder="e.g. 400001" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Client GSTIN</Label>
                <Input
                  {...register("clientGstin")}
                  placeholder="27AHQPB7460C1ZE"
                  className="font-mono text-xs"
                  onChange={(e) => {
                    const gstin = e.target.value.trim();
                    const st = (watched.clientState || "").trim().toLowerCase();
                    const isInter = (!gstin.startsWith("27") && !st.includes("maharashtra") && !st.includes("mh") && gstin.length >= 2);
                    setValue("gstType", isInter ? "IGST" : "CGST_SGST");
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Client Phone</Label>
                <Input {...register("clientPhone")} placeholder="+91 Phone number" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Client Email</Label>
                <Input {...register("clientEmail")} type="email" placeholder="billing@client.com" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">PAN (Optional)</Label>
                <Input {...register("clientPan")} placeholder="Client PAN" className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5 flex flex-col justify-end">
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>Tax Mode:</span>
                  <span className="font-semibold text-foreground">
                    {watched.gstType === "IGST" ? "Inter-State (IGST 18%)" : "Intra-State (CGST 9% + SGST 9%)"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Line Items: Description, HSN/SAC & Amount (Automated Tax & Totals) */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-primary"><IndianRupee className="h-4 w-4" /></span>
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Line Items (Services)</h3>
              </div>
              <span className="text-xs text-muted-foreground">
                Default SAC: <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground font-semibold">998361</code> • GST: <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground font-semibold">18%</code> (Automated)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground font-semibold">
                    <th className="text-left py-2 pr-2 w-8">#</th>
                    <th className="text-left py-2 pr-2 min-w-[240px]">Description *</th>
                    <th className="text-left py-2 pr-2 w-32">HSN / SAC *</th>
                    <th className="text-right py-2 pr-2 w-36">Amount (₹) *</th>
                    {isIGST ? (
                      <th className="text-right py-2 pr-2 w-28">IGST (18%)</th>
                    ) : (
                      <>
                        <th className="text-right py-2 pr-2 w-24">CGST (9%)</th>
                        <th className="text-right py-2 pr-2 w-24">SGST (9%)</th>
                      </>
                    )}
                    <th className="text-right py-2 pr-2 w-32">Total (₹)</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {fields.map((field, idx) => {
                    const it = watched.lineItems?.[idx];
                    const amount = Number(it?.unitPrice ?? 0) * Number(it?.qty ?? 1);
                    const gstRate = Number(it?.taxPercent ?? 18);
                    const taxTotal = (amount * gstRate) / 100;
                    const halfTax = taxTotal / 2;
                    const lineTotal = amount + taxTotal;

                    return (
                      <tr key={field.id} className="align-middle">
                        <td className="py-2.5 pr-2 text-muted-foreground text-xs font-semibold">{idx + 1}</td>
                        <td className="py-2.5 pr-2">
                          <Input
                            {...register(`lineItems.${idx}.description`)}
                            placeholder="e.g. Digital Marketing & Social Media Management Services"
                            className="text-xs h-9 min-w-[220px]"
                          />
                        </td>
                        <td className="py-2.5 pr-2">
                          <Input
                            {...register(`lineItems.${idx}.hsnSac`)}
                            placeholder="998361"
                            defaultValue="998361"
                            className="text-xs h-9 font-mono"
                          />
                        </td>
                        <td className="py-2.5 pr-2">
                          <Input
                            type="number"
                            step="any"
                            placeholder="0.00"
                            value={it?.unitPrice != null ? it.unitPrice : ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setValue(`lineItems.${idx}.qty`, 1);
                              setValue(`lineItems.${idx}.unitPrice`, val);
                              setValue(`lineItems.${idx}.taxPercent`, 18);
                            }}
                            className="text-xs h-9 font-mono text-right font-medium"
                          />
                        </td>
                        {isIGST ? (
                          <td className="py-2.5 pr-2 text-right text-xs font-mono text-blue-600 font-medium">
                            {s}{taxTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        ) : (
                          <>
                            <td className="py-2.5 pr-2 text-right text-xs font-mono text-emerald-600 font-medium">
                              {s}{halfTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2.5 pr-2 text-right text-xs font-mono text-emerald-600 font-medium">
                              {s}{halfTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </>
                        )}
                        <td className="py-2.5 pr-2 text-right text-xs font-bold font-mono">
                          {s}{lineTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5">
                          {fields.length > 1 && (
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                              onClick={() => remove(idx)}
                              title="Remove item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-medium"
                onClick={() =>
                  append({
                    description: "",
                    hsnSac: "998361",
                    taxPercent: 18,
                    qty: 1,
                    unitPrice: 0,
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add Another Service Item
              </Button>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground shrink-0">Discount (Optional):</Label>
                <Input {...register("discount")} type="number" placeholder="0" className="w-24 text-xs h-8" />
                <Controller
                  control={control}
                  name="discountType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FIXED">Fixed ({s})</SelectItem>
                        <SelectItem value="PERCENT">Percent (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            {/* Financial Totals Breakdown matching 14_Invoice_Format.xlsx */}
            <div className="mt-6 pt-4 border-t border-border flex justify-end">
              <div className="w-full max-w-sm space-y-2 text-sm bg-muted/20 p-4 rounded-xl border border-border">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Taxable Amount (Subtotal)</span>
                  <span className="font-mono font-medium">{s}{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>

                {isIGST ? (
                  <div className="flex justify-between items-center text-xs text-blue-600">
                    <span>Integrated Tax (IGST 18%)</span>
                    <span className="font-mono font-medium">{s}{totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center text-xs text-emerald-600">
                      <span>Central Tax (CGST 9%)</span>
                      <span className="font-mono font-medium">{s}{(totalTax / 2).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-emerald-600">
                      <span>State Tax (SGST 9%)</span>
                      <span className="font-mono font-medium">{s}{(totalTax / 2).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}

                {discountAmt > 0 && (
                  <div className="flex justify-between items-center text-xs text-destructive">
                    <span>Discount</span>
                    <span className="font-mono">- {s}{discountAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}

                {(() => {
                  const gross = Math.round(grandTotal);
                  const roundOff = Number((gross - grandTotal).toFixed(2));
                  return (
                    <>
                      {roundOff !== 0 && (
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <span>Round Off</span>
                          <span className="font-mono">{roundOff > 0 ? `+${roundOff}` : roundOff}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center font-bold border-t border-border pt-2 text-base">
                        <span className="text-foreground">Gross Amount (INR)</span>
                        <span className="font-mono text-primary text-lg">{s}{gross.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      {gross > 0 && (
                        <div className="text-xs text-muted-foreground italic pt-2 border-t border-dashed border-border/70">
                          <span className="font-semibold text-foreground/80 not-italic">In Words: </span>
                          {amountToWords(gross, watched.currency)}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Signature */}
        <Card>
          <CardContent className="p-5">
            <SectionHead icon={<FileText className="h-4 w-4" />} title="Signature & Notes" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <Label className="text-xs mb-2 block">Signature</Label>
                {watched.signatureUrl ? (
                  <div className="relative h-24 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                    <img src={watched.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                    <button type="button" className="absolute top-1 right-1 p-0.5 bg-background/80 rounded-full text-muted-foreground hover:text-destructive"
                      onClick={() => setValue("signatureUrl", "")}><XIcon className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <div className="h-24 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                    onClick={() => sigRef.current?.click()}>
                    {sigUploading
                      ? <UploadCloud className="h-5 w-5 text-primary animate-bounce" />
                      : <><UploadCloud className="h-5 w-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Upload Signature</span></>}
                  </div>
                )}
                <input ref={sigRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, setSigUploading, "signatureUrl"); }} />
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Terms & Conditions</Label>
                  <Textarea {...register("termsAndConditions")} placeholder="Payment due within 30 days…" className="text-xs resize-none h-20" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Textarea {...register("notes")} placeholder="Thank you for your business!" className="text-xs resize-none h-16" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pb-6">
          <Button variant="outline" onClick={onBack}>Cancel</Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={saving} className="gap-1.5 min-w-32">
            <FileText className="h-4 w-4" /> {saving ? "Saving…" : editData ? "Update Invoice" : "Create Invoice"}
          </Button>
        </div>
      </div>
    </div>
  );
}
