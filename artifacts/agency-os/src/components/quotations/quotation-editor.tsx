import { useForm, useFieldArray, Controller } from "react-hook-form";
import {
  useCreateQuotation, useUpdateQuotation,
  useListClients, getListQuotationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WriteWithAI } from "@/components/common/WriteWithAI";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Trash2, ChevronLeft, Save,
  Building2, User, Package, Calculator, StickyNote, PenLine,
} from "lucide-react";
import {
  STATUS_CONFIG, GST_RATES, CURRENCY_SYMBOLS, numberToWords,
  QuotationFormValues, QuotationRow,
} from "./quotation-helpers";

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b border-border pb-3">
        <span className="text-primary">{icon}</span>
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function QuotationEditor({
  existing,
  onBack,
  onSaved,
}: {
  existing?: Record<string, unknown>;
  onBack: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const { data: clients } = useListClients();

  const createMutation = useCreateQuotation({
    mutation: {
      onSuccess: () => {
        toast.success("Quotation created");
        qc.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
        onSaved();
      },
      onError: () => toast.error("Failed to create quotation"),
    },
  });

  const updateMutation = useUpdateQuotation({
    mutation: {
      onSuccess: () => {
        toast.success("Quotation updated");
        qc.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
        onSaved();
      },
      onError: () => toast.error("Failed to update quotation"),
    },
  });

  const defaults: QuotationFormValues = {
    number: (existing?.number as string) ?? "",
    title: (existing?.title as string) ?? "",
    currency: (existing?.currency as string) ?? "INR",
    clientId: (existing?.clientId as string) ?? "",
    clientPhone: (existing?.clientPhone as string) ?? "",
    clientEmail: (existing?.clientEmail as string) ?? "",
    clientGstin: (existing?.clientGstin as string) ?? "",
    clientAddress: (existing?.clientAddress as string) ?? "",
    clientCity: (existing?.clientCity as string) ?? "",
    clientState: (existing?.clientState as string) ?? "",
    clientPostalCode: (existing?.clientPostalCode as string) ?? "",
    businessName: (existing?.businessName as string) ?? "Blink Beyond",
    businessPhone: (existing?.businessPhone as string) ?? "",
    businessEmail: (existing?.businessEmail as string) ?? "",
    businessGstin: (existing?.businessGstin as string) ?? "",
    businessAddress: (existing?.businessAddress as string) ?? "",
    businessCity: (existing?.businessCity as string) ?? "",
    businessState: (existing?.businessState as string) ?? "",
    businessPostalCode: (existing?.businessPostalCode as string) ?? "",
    lineItems: (existing?.lineItems as any[]) ?? [
      { itemName: "", description: "", hsnSac: "", taxPercent: 18, qty: 1, unitPrice: 0 },
    ],
    discount: Number(existing?.discount ?? 0),
    discountType: (existing?.discountType as "AMOUNT" | "PERCENT") ?? "AMOUNT",
    validUntil: (existing?.validUntil as string) ?? "",
    notes: (existing?.notes as string) ?? "",
    termsAndConditions: (existing?.termsAndConditions as string) ?? "",
    signatureText: (existing?.signatureText as string) ?? "",
  };

  const { register, control, handleSubmit, watch, setValue } = useForm<QuotationFormValues>({
    defaultValues: defaults,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lineItems",
  });

  const watchedItems = watch("lineItems");
  const watchedDiscount = watch("discount") || 0;
  const watchedDiscountType = watch("discountType");
  const watchedCurrency = watch("currency") || "INR";
  const symbol = CURRENCY_SYMBOLS[watchedCurrency] ?? "₹";

  let subtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;

  const itemTotals = (watchedItems ?? []).map((item) => {
    const qty = Number(item?.qty) || 0;
    const price = Number(item?.unitPrice) || 0;
    const tax = Number(item?.taxPercent) || 0;
    const amount = qty * price;
    const cgst = (amount * (tax / 2)) / 100;
    const sgst = (amount * (tax / 2)) / 100;
    const total = amount + cgst + sgst;
    subtotal += amount;
    totalCgst += cgst;
    totalSgst += sgst;
    return { amount, cgst, sgst, total };
  });

  const totalBeforeDiscount = subtotal + totalCgst + totalSgst;
  const discountAmt =
    watchedDiscountType === "PERCENT"
      ? (totalBeforeDiscount * watchedDiscount) / 100
      : watchedDiscount;
  const grandTotal = Math.max(0, totalBeforeDiscount - discountAmt);

  function onSubmit(values: QuotationFormValues) {
    const payload = {
      ...values,
      subtotal,
      taxAmount: totalCgst + totalSgst,
      total: grandTotal,
      clientId: values.clientId || undefined,
    };

    if (existing?.id) {
      updateMutation.mutate({ id: existing.id as string, data: payload as any });
    } else {
      createMutation.mutate({ data: payload as any });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto animated-fade-in">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to Quotations
        </Button>
        <h1 className="text-xl font-bold font-heading">
          {existing?.id ? "Edit Quotation" : "New Quotation"}
        </h1>
        <Button size="sm" className="gap-1.5" onClick={handleSubmit(onSubmit)} disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending ? "Saving…" : "Save & Continue"}
        </Button>
      </div>

      <WriteWithAI
        context="quotation"
        onFill={(fields) => {
          if (fields.currency) setValue("currency", fields.currency, { shouldDirty: true });
          if (fields.notes) setValue("notes", fields.notes, { shouldDirty: true });
          if (fields.termsAndConditions) setValue("termsAndConditions", fields.termsAndConditions, { shouldDirty: true });
          if (Array.isArray(fields.lineItems) && fields.lineItems.length > 0) {
            setValue("lineItems", fields.lineItems, { shouldDirty: true });
          }
        }}
      />

      <div className="space-y-6">
        <SectionCard icon={<Building2 className="h-4 w-4" />} title="Basic Details">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Quotation Title *">
              <Input {...register("title", { required: true })} placeholder="e.g. Website Redesign Quote" className="text-sm" />
            </Field>

            <Field label="Currency">
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR (₹)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Valid Until">
              <Input {...register("validUntil")} type="date" className="text-sm" />
            </Field>
          </div>
        </SectionCard>

        <SectionCard icon={<User className="h-4 w-4" />} title="Client Details">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Select Client">
              <Controller
                control={control}
                name="clientId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => {
                      field.onChange(val);
                      const c = clients?.find((cl) => cl.id === val);
                      if (c) {
                        if (c.phone) setValue("clientPhone", c.phone);
                        if (c.email) setValue("clientEmail", c.email);
                        if (c.gstin) setValue("clientGstin", c.gstin);
                        if (c.address) setValue("clientAddress", c.address);
                        if (c.city) setValue("clientCity", c.city);
                        if (c.state) setValue("clientState", c.state);
                        if (c.postalCode) setValue("clientPostalCode", c.postalCode);
                      }
                    }}
                  >
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Choose a client" /></SelectTrigger>
                    <SelectContent>
                      {(clients ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Client Phone">
              <Input {...register("clientPhone")} placeholder="+91 98765 43210" className="text-sm" />
            </Field>

            <Field label="Client Email">
              <Input {...register("clientEmail")} type="email" placeholder="client@company.com" className="text-sm" />
            </Field>

            <Field label="Client GSTIN">
              <Input {...register("clientGstin")} placeholder="27AAAAA0000A1Z5" className="text-sm" />
            </Field>

            <Field label="Address">
              <Input {...register("clientAddress")} placeholder="Street Address" className="text-sm" />
            </Field>

            <div className="grid grid-cols-3 gap-2 col-span-1 sm:col-span-3">
              <Field label="City">
                <Input {...register("clientCity")} placeholder="City" className="text-sm" />
              </Field>
              <Field label="State">
                <Input {...register("clientState")} placeholder="State" className="text-sm" />
              </Field>
              <Field label="PIN Code">
                <Input {...register("clientPostalCode")} placeholder="PIN Code" className="text-sm" />
              </Field>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={<Package className="h-4 w-4" />} title="Line Items">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold">
                  <th className="py-2 pr-2">Item Name</th>
                  <th className="py-2 pr-2 w-20">HSN/SAC</th>
                  <th className="py-2 pr-2 w-24">GST %</th>
                  <th className="py-2 pr-2 w-16 text-right">Qty</th>
                  <th className="py-2 pr-2 w-28 text-right">Rate</th>
                  <th className="py-2 pr-2 w-24 text-right">Amount</th>
                  <th className="py-2 pr-2 w-20 text-right">CGST</th>
                  <th className="py-2 pr-2 w-20 text-right">SGST</th>
                  <th className="py-2 pr-2 w-28 text-right">Total</th>
                  <th className="py-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {fields.map((field, idx) => {
                  const t = itemTotals[idx] ?? { amount: 0, cgst: 0, sgst: 0, total: 0 };
                  return (
                    <tr key={field.id} className="group">
                      <td className="py-2 pr-2">
                        <Input
                          {...register(`lineItems.${idx}.itemName`)}
                          placeholder="Item name"
                          className="text-xs h-8"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          {...register(`lineItems.${idx}.hsnSac`)}
                          placeholder="9983"
                          className="text-xs h-8"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Controller
                          control={control}
                          name={`lineItems.${idx}.taxPercent`}
                          render={({ field: f }) => (
                            <Select value={String(f.value)} onValueChange={(v) => f.onChange(Number(v))}>
                              <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {GST_RATES.map((r) => (
                                  <SelectItem key={r} value={String(r)} className="text-xs">{r}%</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          {...register(`lineItems.${idx}.qty`, { valueAsNumber: true })}
                          type="number"
                          min={1}
                          className="text-xs h-8 text-right"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          {...register(`lineItems.${idx}.unitPrice`, { valueAsNumber: true })}
                          type="number"
                          min={0}
                          step="0.01"
                          className="text-xs h-8 text-right"
                        />
                      </td>
                      <td className="py-2 pr-2 text-right text-muted-foreground">
                        {symbol}{t.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 pr-2 text-right text-muted-foreground">
                        {symbol}{t.cgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 pr-2 text-right text-muted-foreground">
                        {symbol}{t.sgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 pr-2 text-right font-semibold">
                        {symbol}{t.total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => remove(idx)}
                          disabled={fields.length === 1}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5 text-xs"
            onClick={() => append({ itemName: "", description: "", hsnSac: "", taxPercent: 18, qty: 1, unitPrice: 0 })}
          >
            <Plus className="h-3 w-3" /> Add New Line
          </Button>
        </SectionCard>

        <SectionCard icon={<Calculator className="h-4 w-4" />} title="Summary">
          <div className="max-w-sm ml-auto space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount</span>
              <span>{symbol}{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">CGST</span>
              <span>{symbol}{totalCgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">SGST</span>
              <span>{symbol}{totalSgst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Discount</span>
                <div className="flex items-center gap-1">
                  <Input
                    {...register("discount", { valueAsNumber: true })}
                    type="number"
                    min={0}
                    step="0.01"
                    className="text-xs h-7 w-20"
                  />
                  <Controller control={control} name="discountType" render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="text-xs h-7 w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AMOUNT" className="text-xs">Flat</SelectItem>
                        <SelectItem value="PERCENT" className="text-xs">%</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
              </div>
              <span className="text-destructive">
                -{symbol}{discountAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>Total ({watchedCurrency})</span>
              <span>{symbol}{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground italic capitalize">
              {numberToWords(grandTotal)}
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={<StickyNote className="h-4 w-4" />} title="Notes & Terms">
          <div className="space-y-4">
            <Field label="Notes">
              <Textarea
                {...register("notes")}
                placeholder="Any additional notes for the client…"
                rows={3}
                className="text-sm resize-none"
              />
            </Field>
            <Field label="Terms & Conditions">
              <Textarea
                {...register("termsAndConditions")}
                placeholder="Payment terms, delivery details, validity period…"
                rows={4}
                className="text-sm resize-none"
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard icon={<PenLine className="h-4 w-4" />} title="Signature">
          <Field label="Authorised Signatory Name">
            <Input {...register("signatureText")} placeholder="e.g. Director, Blink Beyond Agency" className="text-sm max-w-xs" />
          </Field>
        </SectionCard>

        <div className="flex justify-end pb-8">
          <Button size="lg" className="gap-2 px-8" onClick={handleSubmit(onSubmit)} disabled={isPending}>
            <Save className="h-4 w-4" />
            {isPending ? "Saving…" : "Save & Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
