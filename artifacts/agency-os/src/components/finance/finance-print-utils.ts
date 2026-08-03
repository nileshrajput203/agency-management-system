export type PrintInvoiceData = {
  number: string;
  status: string;
  total: number;
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  dueDate: Date | null;
  createdAt: Date;
  currency?: string;
  client: {
    companyName: string;
    email?: string | null;
    billingAddress?: string | null;
    gstin?: string | null;
  };
};

export function printAgreement(
  title: string,
  clientName: string,
  status: string,
  content: string
) {
  if (typeof window === "undefined") return;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(`
    <html>
      <head>
        <title>Agreement: ${title}</title>
        <style>
          body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
          .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
          .title { font-size: 24px; font-weight: bold; margin: 0; color: #0f172a; }
          .meta { font-size: 14px; color: #64748b; margin-top: 5px; }
          .content { font-size: 16px; white-space: pre-wrap; margin-bottom: 40px; }
          .signature-section { margin-top: 50px; border-top: 1px dashed #cbd5e1; padding-top: 20px; }
          .signature-title { font-weight: bold; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">${title}</h1>
          <div class="meta">Client: ${clientName} | Status: ${status}</div>
        </div>
        <div class="content">${content}</div>
        <div class="signature-section">
          <div class="signature-title">Acceptance and Signatures</div>
          <p>By signing below, both parties agree to the terms listed in this document.</p>
        </div>
        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

export function printInvoice(inv: PrintInvoiceData) {
  if (typeof window === "undefined") return;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(`
    <html>
      <head>
        <title>Invoice: ${inv.number}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          body { font-family: 'Inter', sans-serif; padding: 50px; color: #1e293b; line-height: 1.6; background-color: #ffffff; }
          .invoice-container { max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #6366f1; padding-bottom: 25px; margin-bottom: 35px; }
          .brand-title { font-size: 26px; font-weight: 800; color: #4f46e5; margin: 0; letter-spacing: -0.025em; }
          .brand-subtitle { font-size: 12px; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.05em; }
          .invoice-title { font-size: 32px; font-weight: 900; color: #0f172a; margin: 0; text-align: right; letter-spacing: -0.03em; }
          .invoice-status { display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 9999px; text-transform: uppercase; margin-top: 8px; }
          .status-paid { background-color: #dcfce7; color: #15803d; }
          .status-unpaid { background-color: #fef3c7; color: #b45309; }
          .grid-details { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
          .details-block h3 { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; margin: 0 0 10px 0; letter-spacing: 0.05em; }
          .details-block p { font-size: 14px; margin: 3px 0; color: #334155; }
          .meta-list { list-style: none; padding: 0; margin: 0; }
          .meta-list li { font-size: 14px; margin-bottom: 6px; color: #334155; display: flex; }
          .meta-list li span:first-child { font-weight: 600; color: #64748b; width: 110px; }
          table { width: 100%; border-collapse: collapse; margin-top: 30px; margin-bottom: 30px; }
          th { background-color: #f8fafc; font-weight: 700; text-transform: uppercase; font-size: 11px; color: #64748b; letter-spacing: 0.05em; padding: 14px 16px; border-bottom: 2px solid #e2e8f0; text-align: left; }
          td { padding: 16px; font-size: 14px; border-bottom: 1px solid #e2e8f0; color: #334155; }
          .text-right { text-align: right; }
          .summary-section { display: flex; justify-content: flex-end; margin-bottom: 40px; }
          .summary-table { width: 300px; margin: 0; }
          .summary-table td { padding: 8px 16px; border: none; font-size: 14px; }
          .summary-table tr.total-row td { font-size: 18px; font-weight: 800; color: #0f172a; border-top: 2px solid #e2e8f0; padding-top: 12px; }
          .bank-details-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-top: 40px; }
          .bank-details-box h4 { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #475569; margin: 0 0 12px 0; letter-spacing: 0.05em; }
          .bank-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
          .bank-details-grid p { font-size: 13px; margin: 0; color: #334155; }
          .bank-details-grid p span { font-weight: 600; color: #64748b; }
          .terms-box { margin-top: 30px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px; }
          .terms-box p { margin: 4px 0; }
          @media print {
            body { padding: 20px; }
            .bank-details-box { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div>
              <h1 class="brand-title">BLINK BEYOND</h1>
              <div class="brand-subtitle">Creative & Tech Agency</div>
              <p style="font-size: 13px; color: #475569; margin: 6px 0 0 0;">
                info@blinkbeyond.com | www.blinkbeyond.com<br>
                Plot 45, Sector 18, Gurugram, HR, India
              </p>
            </div>
            <div style="text-align: right;">
              <h2 class="invoice-title">INVOICE</h2>
              <div class="invoice-status ${inv.status === 'PAID' ? 'status-paid' : 'status-unpaid'}">
                ${inv.status}
              </div>
            </div>
          </div>

          <div class="grid-details">
            <div class="details-block">
              <h3>Billed To</h3>
              <p style="font-weight: 700; font-size: 16px; color: #0f172a; margin-bottom: 6px;">${inv.client.companyName}</p>
              <p>Email: ${inv.client.email || "—"}</p>
              <p>Address: ${inv.client.billingAddress || "—"}</p>
              ${inv.client.gstin ? `<p>GSTIN: <strong>${inv.client.gstin}</strong></p>` : ""}
            </div>
            <div class="details-block" style="display: flex; flex-direction: column; align-items: flex-end; text-align: right;">
              <div style="text-align: left;">
                <h3>Invoice Details</h3>
                <ul class="meta-list">
                  <li><span>Invoice No:</span> <strong>${inv.number}</strong></li>
                  <li><span>Date:</span> ${new Date(inv.createdAt).toLocaleDateString()}</li>
                  <li><span>Due Date:</span> ${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</li>
                  <li><span>Currency:</span> ${inv.currency || "INR"}</li>
                </ul>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="text-right" style="width: 100px;">Qty</th>
                <th class="text-right" style="width: 120px;">Rate</th>
                <th class="text-right" style="width: 150px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Professional Creative & Marketing Retainer Services</td>
                <td class="text-right">1.0</td>
                <td class="text-right">₹${inv.subtotal.toLocaleString("en-IN")}</td>
                <td class="text-right">₹${inv.subtotal.toLocaleString("en-IN")}</td>
              </tr>
            </tbody>
          </table>

          <div class="summary-section">
            <table class="summary-table">
              <tr>
                <td>Subtotal</td>
                <td class="text-right">₹${inv.subtotal.toLocaleString("en-IN")}</td>
              </tr>
              <tr>
                <td>GST (${inv.gstRate || 18}%)</td>
                <td class="text-right">₹${(inv.gstAmount || (inv.subtotal * (inv.gstRate || 18) / 100)).toLocaleString("en-IN")}</td>
              </tr>
              <tr class="total-row">
                <td>Grand Total</td>
                <td class="text-right">₹${inv.total.toLocaleString("en-IN")}</td>
              </tr>
            </table>
          </div>

          <div class="bank-details-box">
            <h4>Official Wire Payment Details</h4>
            <div class="bank-details-grid">
              <div>
                <p><span>Bank Name:</span> HDFC Bank Ltd</p>
                <p><span>Account Name:</span> Blink Beyond Agency Private Limited</p>
              </div>
              <div>
                <p><span>Account No:</span> 50200084729103 (Current Account)</p>
                <p><span>IFSC Code:</span> HDFC0000240</p>
                <p><span>Branch:</span> DLF Phase 3, Gurugram</p>
              </div>
            </div>
          </div>

          <div class="terms-box">
            <p><strong>Terms & Conditions:</strong></p>
            <p>1. Payment is due within 15 days of invoice date.</p>
            <p>2. Please quote the invoice number as a reference for wire payments.</p>
            <p>3. This is a computer-generated tax invoice and requires no physical signature.</p>
          </div>
        </div>
        <script>window.onload = function() { window.print(); window.close(); }</script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
