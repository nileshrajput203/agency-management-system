import {
  Plus,
  Trash2,
  FileText,
  Building2,
  CalendarDays,
  IndianRupee,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { LineItem, ClientInfo } from "./invoice-maker-preview";

export function InvoiceMakerForm({
  clients,
  selectedClientId,
  setSelectedClientId,
  selectedClient,
  invoiceDate,
  setInvoiceDate,
  dueDate,
  setDueDate,
  currency,
  setCurrency,
  currencies,
  lineItems,
  addLineItem,
  removeLineItem,
  updateLineItem,
  discount,
  setDiscount,
  notes,
  setNotes,
  formatAmount,
}: {
  clients: ClientInfo[];
  selectedClientId: string;
  setSelectedClientId: (id: string) => void;
  selectedClient?: ClientInfo;
  invoiceDate: string;
  setInvoiceDate: (d: string) => void;
  dueDate: string;
  setDueDate: (d: string) => void;
  currency: string;
  setCurrency: (c: string) => void;
  currencies: { value: string; label: string; symbol: string }[];
  lineItems: LineItem[];
  addLineItem: () => void;
  removeLineItem: (id: string) => void;
  updateLineItem: (id: string, field: keyof LineItem, value: string | number) => void;
  discount: number;
  setDiscount: (d: number) => void;
  notes: string;
  setNotes: (n: string) => void;
  formatAmount: (amount: number) => string;
}) {
  return (
    <div className="space-y-5">
      {/* Client Details */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="h-4 w-4 text-indigo-500" /> Client Details
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Select Client
            </Label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
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
              {selectedClient.gstin && (
                <p>GSTIN: {selectedClient.gstin}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dates & Currency */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarDays className="h-4 w-4 text-violet-500" /> Invoice Info
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Invoice Date
              </Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Due Date
              </Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-10"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Currency
            </Label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-border/60 bg-background px-3 text-sm focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all"
            >
              {currencies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
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
                  placeholder="Service description..."
                  value={item.description}
                  onChange={(e) =>
                    updateLineItem(item.id, "description", e.target.value)
                  }
                  className="h-9 text-sm"
                />
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">
                      Qty
                    </Label>
                    <Input
                      type="number"
                      min={0.01}
                      step="any"
                      value={item.quantity}
                      onChange={(e) =>
                        updateLineItem(
                          item.id,
                          "quantity",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">
                      Rate
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
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">
                      GST %
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={item.gstRate}
                      onChange={(e) =>
                        updateLineItem(
                          item.id,
                          "gstRate",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="text-right text-sm font-semibold text-foreground">
                  {formatAmount(item.quantity * item.rate)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Discount & Notes */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {currency === "INR" ? (
              <IndianRupee className="h-4 w-4 text-amber-500" />
            ) : (
              <DollarSign className="h-4 w-4 text-amber-500" />
            )}
            Totals & Notes
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Discount
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
              Terms & Notes
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="text-sm"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
