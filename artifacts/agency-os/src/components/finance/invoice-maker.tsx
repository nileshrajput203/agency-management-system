"use client";

import { useState, useCallback } from "react";
import { Download, Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { createFullInvoice } from "@/lib/actions/invoices";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  LineItem,
  ClientInfo,
  AgencyInfo,
  InvoicePreviewCard,
  handlePrintInvoice,
} from "./invoice-maker-preview";
import { InvoiceMakerForm } from "./invoice-maker-form";

export type { LineItem, ClientInfo, AgencyInfo };

export const CURRENCIES: { value: string; label: string; symbol: string }[] = [
  { value: "INR", label: "INR (₹)", symbol: "₹" },
  { value: "USD", label: "USD ($)", symbol: "$" },
  { value: "AED", label: "AED (د.إ)", symbol: "د.إ" },
  { value: "GBP", label: "GBP (£)", symbol: "£" },
];

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function InvoiceMaker({
  clients,
  agency,
}: {
  clients: ClientInfo[];
  agency: AgencyInfo;
}) {
  const [selectedClientId, setSelectedClientId] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState(
    "1. Payment is due within 15 days of invoice date.\n2. Please quote the invoice number for wire payments.\n3. This is a computer-generated invoice."
  );
  const [discount, setDiscount] = useState(0);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: generateId(),
      description: "",
      quantity: 1,
      rate: 0,
      gstRate: agency.defaultGstRate,
    },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const currencyObj = CURRENCIES.find((c) => c.value === currency)!;

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: generateId(),
        description: "",
        quantity: 1,
        rate: 0,
        gstRate: agency.defaultGstRate,
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateLineItem = (
    id: string,
    field: keyof LineItem,
    value: string | number
  ) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Calculations
  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * item.rate,
    0
  );
  const totalGst = lineItems.reduce(
    (sum, item) => sum + (item.quantity * item.rate * item.gstRate) / 100,
    0
  );
  const grandTotal = subtotal - discount + totalGst;

  const formatAmount = useCallback(
    (amount: number) => {
      if (currency === "INR")
        return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      return `${currencyObj.symbol}${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },
    [currency, currencyObj]
  );

  const handleSave = async () => {
    if (!selectedClientId) {
      toast.error("Please select a client");
      return;
    }
    if (lineItems.some((item) => !item.description.trim())) {
      toast.error("All line items need a description");
      return;
    }

    setIsSaving(true);
    try {
      const res = await createFullInvoice({
        clientId: selectedClientId,
        currency: currency as "INR" | "USD" | "AED" | "GBP",
        gstRate: agency.defaultGstRate,
        dueDate: dueDate || undefined,
        discount,
        lineItems: lineItems.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate,
          gstRate: item.gstRate,
        })),
      });
      if (res.ok) {
        toast.success("Invoice saved successfully!");
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to save invoice");
    } finally {
      setIsSaving(false);
    }
  };

  const onPrintClick = () => {
    handlePrintInvoice({
      agency,
      selectedClient,
      invoiceDate,
      dueDate,
      currency,
      lineItems,
      subtotal,
      discount,
      totalGst,
      grandTotal,
      notes,
      formatAmount,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
              Invoice Maker
            </h1>
            <p className="text-sm text-muted-foreground">
              Create professional invoices with live preview
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrintClick}
            className="h-9 gap-1.5"
          >
            <Download className="h-4 w-4" /> Download PDF
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border-0"
          >
            <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Invoice"}
          </Button>
        </div>
      </div>

      {/* Split pane */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Form */}
        <InvoiceMakerForm
          clients={clients}
          selectedClientId={selectedClientId}
          setSelectedClientId={setSelectedClientId}
          selectedClient={selectedClient}
          invoiceDate={invoiceDate}
          setInvoiceDate={setInvoiceDate}
          dueDate={dueDate}
          setDueDate={setDueDate}
          currency={currency}
          setCurrency={setCurrency}
          currencies={CURRENCIES}
          lineItems={lineItems}
          addLineItem={addLineItem}
          removeLineItem={removeLineItem}
          updateLineItem={updateLineItem}
          discount={discount}
          setDiscount={setDiscount}
          notes={notes}
          setNotes={setNotes}
          formatAmount={formatAmount}
        />

        {/* RIGHT: Live Preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <InvoicePreviewCard
            agency={agency}
            selectedClient={selectedClient}
            invoiceDate={invoiceDate}
            dueDate={dueDate}
            currency={currency}
            lineItems={lineItems}
            subtotal={subtotal}
            discount={discount}
            totalGst={totalGst}
            grandTotal={grandTotal}
            notes={notes}
            formatAmount={formatAmount}
          />
        </div>
      </div>
    </div>
  );
}
