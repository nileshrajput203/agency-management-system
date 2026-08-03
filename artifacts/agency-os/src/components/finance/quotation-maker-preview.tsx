import { Card, CardContent } from "@/components/ui/card";

export type QuotationLineItem = {
  id: string;
  description: string;
  hours: number;
  rate: number;
};

export type QuotationClientInfo = {
  id: string;
  companyName: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  billingAddress?: string | null;
  gstin?: string | null;
};

export type QuotationAgencyInfo = {
  companyName: string;
  gstNumber?: string | null;
};

export function handlePrintQuotation({
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
}: {
  agency: QuotationAgencyInfo;
  selectedClient?: QuotationClientInfo;
  title: string;
  quotationDate: string;
  validUntil: string;
  scope: string;
  lineItems: QuotationLineItem[];
  subtotal: number;
  discount: number;
  grandTotal: number;
  terms: string;
  formatAmount: (amount: number) => string;
}) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  const clientName = selectedClient?.companyName || "—";
  const clientEmail = selectedClient?.email || "—";
  const clientAddress = selectedClient?.billingAddress || "—";

  const lineItemsHtml = lineItems
    .map(
      (item, idx) => `
    <tr>
      <td style="padding: 14px 16px; font-size: 14px; border-bottom: 1px solid #e2e8f0; color: #334155;">${idx + 1}</td>
      <td style="padding: 14px 16px; font-size: 14px; border-bottom: 1px solid #e2e8f0; color: #334155;">${item.description || "—"}</td>
      <td style="padding: 14px 16px; font-size: 14px; border-bottom: 1px solid #e2e8f0; color: #334155; text-align: right;">${item.hours}</td>
      <td style="padding: 14px 16px; font-size: 14px; border-bottom: 1px solid #e2e8f0; color: #334155; text-align: right;">${formatAmount(item.rate)}</td>
      <td style="padding: 14px 16px; font-size: 14px; border-bottom: 1px solid #e2e8f0; color: #334155; text-align: right; font-weight: 600;">${formatAmount(item.hours * item.rate)}</td>
    </tr>
  `
    )
    .join("");

  printWindow.document.write(`<!DOCTYPE html><html><head><title>Quotation - ${title || "Untitled"}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Inter', sans-serif; color: #1e293b; line-height: 1.6; background: #fff; padding: 40px; }
      .container { max-width: 800px; margin: 0 auto; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; margin-bottom: 32px; border-bottom: 3px solid #8b5cf6; }
      .brand h1 { font-size: 28px; font-weight: 900; color: #7c3aed; letter-spacing: -0.03em; }
      .brand p { font-size: 12px; color: #64748b; margin-top: 4px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 32px; }
      .label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.08em; margin-bottom: 8px; }
      .value { font-size: 14px; color: #334155; margin: 3px 0; }
      .value strong { color: #0f172a; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      th { background: #f8fafc; font-weight: 700; text-transform: uppercase; font-size: 11px; color: #94a3b8; letter-spacing: 0.06em; padding: 12px 16px; border-bottom: 2px solid #e2e8f0; text-align: left; }
      .summary { display: flex; justify-content: flex-end; margin-bottom: 32px; }
      .summary-table { width: 300px; }
      .summary-table td { padding: 8px 16px; font-size: 14px; color: #334155; }
      .summary-table .total td { font-size: 18px; font-weight: 800; color: #0f172a; border-top: 2px solid #e2e8f0; padding-top: 12px; }
      .scope-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
      .scope-box h4 { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 10px; }
      .scope-box p { font-size: 14px; color: #334155; white-space: pre-wrap; }
      .notes { margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; white-space: pre-wrap; }
      @media print { body { padding: 20px; } .scope-box { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style>
  </head><body>
    <div class="container">
      <div class="header">
        <div class="brand">
          <h1>${agency.companyName.toUpperCase()}</h1>
          <p>Creative & Tech Agency</p>
          ${agency.gstNumber ? `<p style="margin-top:6px; font-size:12px; color:#475569;">GSTIN: <strong>${agency.gstNumber}</strong></p>` : ""}
        </div>
        <div style="text-align:right;">
          <div style="font-size: 36px; font-weight: 900; color: #0f172a; letter-spacing: -0.03em;">QUOTATION</div>
          <p style="font-size:13px; color:#64748b; margin-top:4px;">Date: ${quotationDate}</p>
          ${validUntil ? `<p style="font-size:13px; color:#64748b;">Valid Until: ${validUntil}</p>` : ""}
        </div>
      </div>
      <div class="grid">
        <div>
          <div class="label">Prepared For</div>
          <p class="value"><strong>${clientName}</strong></p>
          <p class="value">${clientEmail}</p>
          <p class="value">${clientAddress}</p>
        </div>
        <div style="text-align:right;">
          <div class="label">Project</div>
          <p class="value"><strong>${title || "—"}</strong></p>
        </div>
      </div>
      ${scope ? `<div class="scope-box"><h4>Scope of Work</h4><p>${scope}</p></div>` : ""}
      <table>
        <thead><tr>
          <th style="width:40px;">#</th><th>Description</th>
          <th style="text-align:right; width:80px;">Hours/Qty</th>
          <th style="text-align:right; width:100px;">Rate</th>
          <th style="text-align:right; width:120px;">Amount</th>
        </tr></thead>
        <tbody>${lineItemsHtml}</tbody>
      </table>
      <div class="summary"><table class="summary-table">
        <tr><td>Subtotal</td><td style="text-align:right;">${formatAmount(subtotal)}</td></tr>
        ${discount > 0 ? `<tr><td>Discount</td><td style="text-align:right; color:#ef4444;">-${formatAmount(discount)}</td></tr>` : ""}
        <tr class="total"><td>Grand Total</td><td style="text-align:right;">${formatAmount(grandTotal)}</td></tr>
      </table></div>
      ${terms ? `<div class="notes"><strong style="color:#475569;">Terms & Conditions</strong><br><br>${terms}</div>` : ""}
    </div>
    <script>window.onload=function(){window.print();window.close();}<\/script>
  </body></html>`);
  printWindow.document.close();
}

export function QuotationPreviewCard({
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
}: {
  agency: QuotationAgencyInfo;
  selectedClient?: QuotationClientInfo;
  title: string;
  quotationDate: string;
  validUntil: string;
  scope: string;
  lineItems: QuotationLineItem[];
  subtotal: number;
  discount: number;
  grandTotal: number;
  terms: string;
  formatAmount: (amount: number) => string;
}) {
  return (
    <Card className="border-border/50 shadow-lg overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500" />
      <CardContent className="p-6 space-y-5">
        {/* Preview header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-black tracking-tight text-violet-600 dark:text-violet-400">
              {agency.companyName.toUpperCase()}
            </h2>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mt-0.5">
              Creative & Tech Agency
            </p>
            {agency.gstNumber && (
              <p className="text-[10px] text-muted-foreground mt-1">
                GSTIN: {agency.gstNumber}
              </p>
            )}
          </div>
          <div className="text-right">
            <h3 className="text-3xl font-black tracking-tighter text-foreground">
              QUOTATION
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Date: {quotationDate}
            </p>
            {validUntil && (
              <p className="text-xs text-muted-foreground">
                Valid Until: {validUntil}
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-border/30" />

        {/* Client & Project */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60 mb-1.5">
              Prepared For
            </p>
            {selectedClient ? (
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-foreground">
                  {selectedClient.companyName}
                </p>
                {selectedClient.email && (
                  <p className="text-xs text-muted-foreground">
                    {selectedClient.email}
                  </p>
                )}
                {selectedClient.billingAddress && (
                  <p className="text-xs text-muted-foreground">
                    {selectedClient.billingAddress}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Select a client...
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60 mb-1.5">
              Project
            </p>
            <p className="text-sm font-bold">
              {title || (
                <span className="text-muted-foreground italic font-normal">
                  Untitled
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Scope */}
        {scope && (
          <div className="bg-muted/20 rounded-lg p-3.5 border border-border/20">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60 mb-1.5">
              Scope of Work
            </p>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {scope}
            </p>
          </div>
        )}

        {/* Line items table */}
        <div className="rounded-lg border border-border/30 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40">
                <th className="text-left py-2.5 px-3 font-bold text-muted-foreground/70 uppercase tracking-wider text-[10px]">
                  #
                </th>
                <th className="text-left py-2.5 px-3 font-bold text-muted-foreground/70 uppercase tracking-wider text-[10px]">
                  Description
                </th>
                <th className="text-right py-2.5 px-3 font-bold text-muted-foreground/70 uppercase tracking-wider text-[10px]">
                  Hrs/Qty
                </th>
                <th className="text-right py-2.5 px-3 font-bold text-muted-foreground/70 uppercase tracking-wider text-[10px]">
                  Rate
                </th>
                <th className="text-right py-2.5 px-3 font-bold text-muted-foreground/70 uppercase tracking-wider text-[10px]">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => (
                <tr key={item.id} className="border-t border-border/20">
                  <td className="py-2.5 px-3 text-muted-foreground">{idx + 1}</td>
                  <td className="py-2.5 px-3 text-foreground font-medium">
                    {item.description || (
                      <span className="italic text-muted-foreground/50">
                        No description
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">
                    {item.hours}
                  </td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">
                    {formatAmount(item.rate)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-foreground">
                    {formatAmount(item.hours * item.rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-56 space-y-1.5 text-xs">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatAmount(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium text-red-500">
                  -{formatAmount(discount)}
                </span>
              </div>
            )}
            <div className="border-t border-border/40" />
            <div className="flex justify-between py-2">
              <span className="font-black text-sm">Grand Total</span>
              <span className="font-black text-sm text-violet-600 dark:text-violet-400">
                {formatAmount(grandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Terms preview */}
        {terms && (
          <>
            <div className="border-t border-border/30" />
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60 mb-1.5">
                Terms & Conditions
              </p>
              <p className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {terms}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
