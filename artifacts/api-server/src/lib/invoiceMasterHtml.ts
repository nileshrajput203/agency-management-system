import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const currentDir = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

function getTemplateImageBase64(imgName: string): string {
  const possiblePaths = [
    path.resolve(currentDir, "../../templates", imgName),
    path.resolve(currentDir, "../templates", imgName),
    path.resolve(process.cwd(), "artifacts/api-server/templates", imgName),
    path.resolve(process.cwd(), "artifacts/agency-os/public/images/invoice", imgName),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;
    }
  }
  return "";
}

function esc(str: unknown): string {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(n: unknown): string {
  const num = Number(n);
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMasterDate(dateStr?: string | null): string {
  if (!dateStr) return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replace(/ /g, "-");
  const clean = String(dateStr).split("T")[0];
  const parts = clean.split("-").map(Number);
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = String(parts[2]).padStart(2, "0");
    const mon = months[(parts[1] || 1) - 1];
    const yr = String(parts[0]).slice(-2);
    return `${day}-${mon}-${yr}`;
  }
  return dateStr;
}

function amountToWordsIndian(num: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function twoDigit(n: number) {
    if (n < 20) return ones[n];
    return (tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "")).trim();
  }
  function threeDigit(n: number) {
    if (n < 100) return twoDigit(n);
    return (ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + twoDigit(n % 100) : "")).trim();
  }

  const rounded = Math.round(num * 100);
  const intPart = Math.floor(rounded / 100);
  const paise = rounded % 100;

  if (intPart === 0 && paise === 0) return "Zero Rupees Only.";

  let remaining = intPart;
  const crores = Math.floor(remaining / 10000000);
  remaining %= 10000000;
  const lakhs = Math.floor(remaining / 100000);
  remaining %= 100000;
  const thousands = Math.floor(remaining / 1000);
  remaining %= 1000;
  const hundreds = remaining;

  let result = "";
  if (crores > 0) result += (result ? " " : "") + twoDigit(crores) + " Crore";
  if (lakhs > 0) result += (result ? " " : "") + twoDigit(lakhs) + " Lakh";
  if (thousands > 0) result += (result ? " " : "") + twoDigit(thousands) + " Thousand";
  if (hundreds > 0) result += (result ? " " : "") + threeDigit(hundreds);

  result = (result.trim() || "Zero") + " Rupees";
  if (paise > 0) {
    result += " and " + twoDigit(paise) + " Paise";
  }
  return result + " Only.";
}

export function generateInvoiceMasterHtml(inv: any): string {
  const bannerBase64 = getTemplateImageBase64("image1.png");
  let stampBase64 = getTemplateImageBase64("image3.png");
  if (!stampBase64) {
    stampBase64 = getTemplateImageBase64("image2.png");
  }

  const invNumber = inv.number || inv.invoiceNumber || "0003";
  const formattedDate = formatMasterDate(inv.invoiceDate);
  const clientName = inv.clientName || "(name)";
  const clientAddress = [
    inv.billingAddress || inv.clientAddress,
    inv.clientCity,
    inv.clientState,
    inv.clientPostalCode,
  ].filter(Boolean).map(esc).join(", ") || "[address]";

  const placeOfSupply = inv.clientState || inv.placeOfSupply || "Maharashtra";
  const clientGstin = inv.clientGstin || "27AHQPB7460C1ZE";
  const isIGST =
    inv.gstType === "IGST" ||
    (!clientGstin.startsWith("27") &&
      !placeOfSupply.toLowerCase().includes("maharashtra") &&
      !placeOfSupply.toLowerCase().includes("mh"));

  const isProforma = inv.invoiceType === "PROFORMA";
  const bannerTitle = isProforma ? "PROFORMA INVOICE" : "TAX INVOICE";

  let rawItems = inv.lineItems;
  if (typeof rawItems === "string") {
    try { rawItems = JSON.parse(rawItems); } catch {}
  }
  const items = Array.isArray(rawItems) && rawItems.length > 0
    ? rawItems
    : [
        {
          description: "Digital Marketing & Social Media Management Services",
          hsnSac: "998361",
          taxPercent: 18,
          amount: inv.subtotal || inv.total || 0,
        },
      ];

  const subtotal = items.reduce(
    (s: number, it: any) =>
      s + Number(it.amount != null ? it.amount : Number(it.qty || 1) * Number(it.unitPrice || 0)),
    0
  );
  const taxRate = items[0]?.taxPercent || 18;
  const taxAmount = (subtotal * taxRate) / 100;
  const cgst = isIGST ? 0 : Number((taxAmount / 2).toFixed(2));
  const sgst = isIGST ? 0 : Number((taxAmount / 2).toFixed(2));
  const igst = isIGST ? Number(taxAmount.toFixed(2)) : 0;
  const grossAmount = Math.round(subtotal + taxAmount);
  const roundOff = Number((grossAmount - (subtotal + taxAmount)).toFixed(2));
  const words = amountToWordsIndian(grossAmount);

  // Generate 18 item rows exactly matching Excel rows 22-39
  const TOTAL_SLOTS = 18;
  const renderedRowsHtml = Array.from({ length: TOTAL_SLOTS }, (_, idx) => {
    const item: any = items[idx];
    if (item) {
      const itemAmt = item.amount != null ? Number(item.amount) : (Number(item.qty || 1) * Number(item.unitPrice || 0));
      return `
        <tr>
          <td style="text-align:center;font-weight:bold;">${idx + 1}</td>
          <td style="text-align:left;">${esc(item.description || "")}</td>
          <td style="text-align:center;">${esc(item.hsnSac || "998361")}</td>
          <td style="text-align:center;">${(item.taxPercent || 18).toFixed(2)}</td>
          <td style="text-align:right;">${itemAmt.toFixed(2)}</td>
        </tr>
      `;
    }
    return `
      <tr>
        <td style="text-align:center;color:transparent;">${idx + 1}</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
        <td>&nbsp;</td>
      </tr>
    `;
  }).join("");

  function renderHalf(copyTitle: string) {
    return `
      <div class="invoice-half">
        <div class="half-tag">${copyTitle}</div>
        ${bannerBase64 ? `<img src="${bannerBase64}" class="banner-img" alt="Blink Beyond Header" />` : ""}

        <div class="co-header">
          <div class="co-name">BLINK BEYOND</div>
          <div class="co-sub">Digital Marketing Agency</div>
          <div class="co-addr">Ground Floor, Shop No. 07, Ali Chamber Apt., Manor Road, Near Kotak Mahindra Bank, Palghar West, Palghar, Palghar, Maharashtra, 401404</div>
          <div class="co-gst">GSTIN/UIN: 27ABGFB9280J1Z0</div>
        </div>

        <div class="tax-invoice-bar">${bannerTitle}</div>

        <table class="table-bordered meta-table">
          <tr>
            <td style="width: 50%;">Invoice No:- <strong>${esc(invNumber)}</strong></td>
            <td style="width: 50%;">Date: <strong>${esc(formattedDate)}</strong></td>
          </tr>
        </table>

        <table class="table-bordered parties-table">
          <tr>
            <td style="width: 50%;">
              <div class="party-title">Bill To,</div>
              <div class="party-name">${esc(clientName)}</div>
              <div class="party-text">${clientAddress}</div>
              <div class="party-text" style="margin-top:2px;">Place of Supply:- <strong>${esc(placeOfSupply)}</strong></div>
              <div class="party-text">GSTIN/UIN: <strong>${esc(clientGstin)}</strong></div>
            </td>
            <td style="width: 50%;">
              <div class="party-title">Ship To,</div>
              <div class="party-name">${esc(clientName)}</div>
              <div class="party-text">${clientAddress}</div>
            </td>
          </tr>
        </table>

        <table class="table-bordered items-table">
          <thead>
            <tr>
              <th style="width: 6%;">S.No</th>
              <th style="width: 48%;">Description</th>
              <th style="width: 14%;">HSN/SAC</th>
              <th style="width: 14%;">Tax Rate</th>
              <th style="width: 18%;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${renderedRowsHtml}
          </tbody>
        </table>

        <table class="table-bordered totals-section-table">
          <tr>
            <td style="width: 52%; vertical-align: top; padding: 3px;">
              <div style="font-weight: 800; font-size: 6.5pt; color: #1a1a54; margin-bottom: 2px;">Bank Details</div>
              <div style="font-size: 5.6pt; line-height: 1.35; color: #1a1a54;">
                <div>Bank Name: <strong>HDFC BANK LIMITED</strong></div>
                <div>Account No:- <strong>50200121903920</strong></div>
                <div>IFSC Code:- <strong>HDFC0000663</strong></div>
              </div>
            </td>
            <td style="width: 48%; padding: 0; vertical-align: top;">
              <table class="totals-table">
                <tr><td>Taxable</td><td style="text-align:right;">${fmt(subtotal)}</td></tr>
                <tr><td>CGST</td><td style="text-align:right;">${fmt(cgst)}</td></tr>
                <tr><td>SGST</td><td style="text-align:right;">${fmt(sgst)}</td></tr>
                <tr><td>IGST</td><td style="text-align:right;">${fmt(igst)}</td></tr>
                <tr><td>Round Off.</td><td style="text-align:right;">${roundOff !== 0 ? fmt(roundOff) : "0.00"}</td></tr>
                <tr class="gross-row"><td>Gross Amount</td><td style="text-align:right;">₹${fmt(grossAmount)}</td></tr>
              </table>
            </td>
          </tr>
        </table>

        <div class="words-box">
          <strong>Amount in Words:-</strong> ${esc(words)}
        </div>

        <div class="stamp-box">
          ${stampBase64 ? `<img src="${stampBase64}" class="stamp-img" alt="Certified Seal" />` : ""}
        </div>

        <div class="footer-box">
          <div class="thankyou-text">Thank you for choosing us.</div>
          <div class="sig-container">
            <div class="sig-line"></div>
            <div class="sig-label">Authorized Signatory</div>
          </div>
        </div>

        <div class="decl-text">
          We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
        </div>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice-${esc(invNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #fff;
      color: #0c0836;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @page {
      size: A4 portrait;
      margin: 3mm;
    }
    .sheet-wrapper {
      max-width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #fff;
      padding: 1.5mm;
      display: flex;
      flex-direction: row;
      gap: 3mm;
      justify-content: space-between;
      box-sizing: border-box;
    }
    .invoice-half {
      width: 49.3%;
      border: 1.5px solid #1a1a54;
      display: flex;
      flex-direction: column;
      position: relative;
      background: #fff;
      box-sizing: border-box;
      padding: 1.5mm;
    }
    .half-tag {
      font-size: 6.8pt;
      font-style: italic;
      text-align: right;
      color: #1a1a54;
      font-weight: 600;
      margin-bottom: 1.5px;
    }
    .banner-img {
      width: 100%;
      height: auto;
      display: block;
      margin-bottom: 2px;
    }
    .co-header {
      text-align: center;
      margin-bottom: 2px;
    }
    .co-name {
      font-size: 11.5pt;
      font-weight: 900;
      color: #1a1a54;
      letter-spacing: 0.5px;
      line-height: 1.1;
    }
    .co-sub {
      font-size: 7.8pt;
      font-weight: 700;
      color: #432b85;
      font-style: italic;
      margin-top: 0.5px;
    }
    .co-addr {
      font-size: 5.1pt;
      color: #1a1a54;
      line-height: 1.25;
      margin-top: 1px;
      padding: 0 2px;
    }
    .co-gst {
      font-size: 6.8pt;
      font-weight: 800;
      color: #1a1a54;
      margin-top: 1px;
    }
    .tax-invoice-bar {
      background: #1a1a54;
      color: #fff;
      text-align: center;
      font-weight: 800;
      font-size: 7.8pt;
      padding: 2.5px 0;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .table-bordered {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .table-bordered td, .table-bordered th {
      border: 1px solid #1a1a54;
      padding: 1.5px 3px;
      font-size: 5.9pt;
      vertical-align: top;
      color: #0c0836;
      word-break: break-word;
    }
    .meta-table {
      margin-top: 0px;
      background: #f7f7fd;
    }
    .meta-table td {
      font-size: 6.4pt;
      font-weight: 600;
      padding: 2px 4px;
    }
    .party-title {
      font-weight: 800;
      color: #1a1a54;
      font-size: 6.5pt;
      margin-bottom: 1px;
    }
    .party-name {
      font-weight: 800;
      color: #000;
      font-size: 6.8pt;
      margin-bottom: 1px;
    }
    .party-text {
      font-size: 5.6pt;
      color: #1a1a54;
      line-height: 1.25;
    }
    .items-table {
      margin-top: 0;
    }
    .items-table thead th {
      background: #1a1a54;
      color: #fff;
      font-weight: 700;
      font-size: 6.2pt;
      text-align: center;
      padding: 2px;
    }
    .items-table tbody td {
      height: 14.5px;
      padding: 1px 3px;
      font-size: 5.8pt;
    }
    .items-table tbody tr:nth-child(even) {
      background: #fafafc;
    }
    .totals-table {
      width: 100%;
      border-collapse: collapse;
    }
    .totals-table td {
      border: none;
      padding: 1px 3px;
      font-size: 5.8pt;
      color: #1a1a54;
    }
    .totals-table tr.gross-row td {
      background: #1a1a54;
      color: #fff;
      font-weight: 900;
      font-size: 6.8pt;
      padding: 2px 3px;
    }
    .words-box {
      border: 1px solid #1a1a54;
      border-top: none;
      padding: 2px 4px;
      font-size: 5.6pt;
      color: #1a1a54;
      background: #fbfbfd;
      min-height: 14px;
    }
    .stamp-box {
      text-align: center;
      margin-top: auto;
      padding-top: 10px;
      margin-bottom: 5px;
    }
    .stamp-img {
      height: 64px;
      width: 64px;
      object-fit: contain;
      display: inline-block;
    }
    .footer-box {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding: 3px 6px 1px 6px;
    }
    .thankyou-text {
      font-family: Georgia, serif;
      font-style: italic;
      font-size: 7.5pt;
      font-weight: bold;
      color: #1a1a54;
      padding-bottom: 2px;
    }
    .sig-container {
      text-align: center;
      width: 120px;
    }
    .sig-line {
      border-top: 1px solid #1a1a54;
      margin-bottom: 2px;
      width: 100%;
    }
    .sig-label {
      font-size: 6.2pt;
      font-weight: 800;
      color: #1a1a54;
    }
    .decl-text {
      font-size: 4.6pt;
      font-style: italic;
      color: #3b3a62;
      text-align: center;
      margin-top: 2px;
      line-height: 1.15;
    }
  </style>
</head>
<body>
  <div class="sheet-wrapper">
    ${renderHalf("Original for Recipient")}
    ${renderHalf("Duplicate for Supplier")}
  </div>
</body>
</html>`;
}
