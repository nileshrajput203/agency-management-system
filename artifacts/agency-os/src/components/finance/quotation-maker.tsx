"use client";

import { useState, useCallback } from "react";
import { Download, Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { createFullQuotation } from "@/lib/actions/proposals";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  QuotationLineItem,
  QuotationClientInfo,
  QuotationAgencyInfo,
  QuotationPreviewCard,
  handlePrintQuotation,
} from "./quotation-maker-preview";
import { QuotationMakerForm } from "./quotation-maker-form";

export type { QuotationLineItem as LineItem, QuotationClientInfo as ClientInfo, QuotationAgencyInfo as AgencyInfo };

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function QuotationMaker({
  clients,
  agency,
}: {
  clients: QuotationClientInfo[];
  agency: QuotationAgencyInfo;
}) {
  const [selectedClientId, setSelectedClientId] = useState("");
  const [title, setTitle] = useState("");
  const [quotationDate, setQuotationDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [validUntil, setValidUntil] = useState("");
  const [scope, setScope] = useState("");
  const [terms, setTerms] = useState(
    "1. This quotation is valid for the period mentioned above.\n2. 50% advance payment required before project kick-off.\n3. Revisions beyond the agreed scope will be billed separately."
  );
  const [discount, setDiscount] = useState(0);
  const [lineItems, setLineItems] = useState<QuotationLineItem[]>([
    { id: generateId(), description: "", hours: 1, rate: 0 },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: generateId(), description: "", hours: 1, rate: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateLineItem = (
    id: string,
    field: keyof QuotationLineItem,
    value: string | number
  ) => {
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Calculations
  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.hours * item.rate,
    0
  );
  const grandTotal = Math.max(0, subtotal - discount);

  const formatAmount = useCallback(
    (amount: number) => {
      return `₹${amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    },
    []
  );

  const handleSave = async () => {
    if (!selectedClientId) {
      toast.error("Please select a client");
      return;
    }
    if (!title.trim()) {
      toast.error("Please enter a quotation title");
      return;
    }
    if (lineItems.some((item) => !item.description.trim())) {
      toast.error("All line items need a description");
      return;
    }

    setIsSaving(true);
    try {
      const res = await createFullQuotation({
        clientId: selectedClientId,
        title: title.trim(),
        validUntil: validUntil || undefined,
        discount,
        notes: scope + (terms ? `\n\n---\n\n${terms}` : ""),
        lineItems: lineItems.map((item) => ({
          description: item.description,
          hours: item.hours,
          rate: item.rate,
          amount: item.hours * item.rate,
        })),
      });
      if (res.ok) {
        toast.success("Quotation saved successfully!");
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to save quotation");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    handlePrintQuotation({
      agency,
      selectedClient,
      title,
      quotationDate,
      validUntil,
      scope,
      lineItems,
      subtotal,
      discount,
      grandTotal,
      terms,
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
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              Quotation Maker
            </h1>
            <p className="text-sm text-muted-foreground">
              Create professional quotations with live preview
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-9 gap-1.5"
          >
            <Download className="h-4 w-4" /> Download PDF
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 gap-1.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white border-0"
          >
            <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Quotation"}
          </Button>
        </div>
      </div>

      {/* Split pane */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Form */}
        <QuotationMakerForm
          clients={clients}
          selectedClientId={selectedClientId}
          setSelectedClientId={setSelectedClientId}
          selectedClient={selectedClient}
          title={title}
          setTitle={setTitle}
          quotationDate={quotationDate}
          setQuotationDate={setQuotationDate}
          validUntil={validUntil}
          setValidUntil={setValidUntil}
          scope={scope}
          setScope={setScope}
          lineItems={lineItems}
          addLineItem={addLineItem}
          removeLineItem={removeLineItem}
          updateLineItem={updateLineItem}
          discount={discount}
          setDiscount={setDiscount}
          terms={terms}
          setTerms={setTerms}
          formatAmount={formatAmount}
        />

        {/* RIGHT: Live Preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <QuotationPreviewCard
            agency={agency}
            selectedClient={selectedClient}
            title={title}
            quotationDate={quotationDate}
            validUntil={validUntil}
            scope={scope}
            lineItems={lineItems}
            subtotal={subtotal}
            discount={discount}
            grandTotal={grandTotal}
            terms={terms}
            formatAmount={formatAmount}
          />
        </div>
      </div>
    </div>
  );
}
