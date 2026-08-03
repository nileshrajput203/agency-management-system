import {
  Plus,
  Trash2,
  FileText,
  Building2,
  CalendarDays,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type {
  QuotationLineItem,
  QuotationClientInfo,
} from "./quotation-maker-preview";

export function QuotationMakerForm({
  clients,
  selectedClientId,
  setSelectedClientId,
  selectedClient,
  title,
  setTitle,
  quotationDate,
  setQuotationDate,
  validUntil,
  setValidUntil,
  scope,
  setScope,
  lineItems,
  addLineItem,
  removeLineItem,
  updateLineItem,
  discount,
  setDiscount,
  terms,
  setTerms,
  formatAmount,
}: {
  clients: QuotationClientInfo[];
  selectedClientId: string;
  setSelectedClientId: (id: string) => void;
  selectedClient?: QuotationClientInfo;
  title: string;
  setTitle: (t: string) => void;
  quotationDate: string;
  setQuotationDate: (d: string) => void;
  validUntil: string;
  setValidUntil: (d: string) => void;
  scope: string;
  setScope: (s: string) => void;
  lineItems: QuotationLineItem[];
  addLineItem: () => void;
  removeLineItem: (id: string) => void;
  updateLineItem: (
    id: string,
    field: keyof QuotationLineItem,
    value: string | number
  ) => void;
  discount: number;
  setDiscount: (d: number) => void;
  terms: string;
  setTerms: (t: string) => void;
  formatAmount: (amount: number) => string;
}) {
  return (
    <div className="space-y-5">
      {/* Client Details */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="h-4 w-4 text-violet-500" /> Client Details
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Select Client
            </Label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
            >
              <option value="">Choose a client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </div>
          {selectedClient && (
            <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground space-y-0.5 border border-border/30">
              <p className="font-medium text-foreground">
                {selectedClient.companyName}
              </p>
              {selectedClient.email && <p>{selectedClient.email}</p>}
              {selectedClient.billingAddress && (
                <p>{selectedClient.billingAddress}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quotation Info */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ScrollText className="h-4 w-4 text-purple-500" /> Quotation Info
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Project / Quotation Title
            </Label>
            <Input
              placeholder="e.g., E-Commerce Website Development"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Quotation Date
              </Label>
              <Input
                type="date"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Valid Until
              </Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="h-10"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Scope of Work
            </Label>
            <Textarea
              placeholder="Describe the project scope, deliverables, and milestones..."
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              rows={4}
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="h-4 w-4 text-emerald-500" /> Line Items
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={addLineItem}
              className="h-8 gap-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add Item
            </Button>
          </div>
          <div className="space-y-3">
            {lineItems.map((item, idx) => (
              <div
                key={item.id}
                className="bg-muted/20 rounded-lg p-3 border border-border/30 space-y-2.5 group relative"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
                    #{idx + 1}
                  </span>
                  {lineItems.length > 1 && (
                    <button
                      onClick={() => removeLineItem(item.id)}
                      className="text-red-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <Input
                  placeholder="Service / deliverable description..."
                  value={item.description}
                  onChange={(e) =>
                    updateLineItem(item.id, "description", e.target.value)
                  }
                  className="h-9 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">
                      Hours / Qty
                    </Label>
                    <Input
                      type="number"
                      min={0.01}
                      step="any"
                      value={item.hours}
                      onChange={(e) =>
                        updateLineItem(
                          item.id,
                          "hours",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">
                      Rate (₹)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={item.rate}
                      onChange={(e) =>
                        updateLineItem(
                          item.id,
                          "rate",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="text-right text-sm font-semibold text-foreground">
                  {formatAmount(item.hours * item.rate)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Discount & Terms */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarDays className="h-4 w-4 text-amber-500" /> Totals & Terms
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Discount (₹)
            </Label>
            <Input
              type="number"
              min={0}
              step="any"
              value={discount}
              onChange={(e) =>
                setDiscount(parseFloat(e.target.value) || 0)
              }
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Terms & Conditions
            </Label>
            <Textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={4}
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
