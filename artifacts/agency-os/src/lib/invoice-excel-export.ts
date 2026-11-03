import ExcelJS from "exceljs";
import { amountToWords } from "./pdf-utils";

export interface InvoiceExportData {
  number?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceType?: string;
  clientName?: string;
  businessName?: string;
  businessAddress?: string;
  businessGstin?: string;
  companyGstin?: string;
  clientGstin?: string;
  billingAddress?: string;
  clientAddress?: string;
  clientCity?: string;
  clientState?: string;
  clientPostalCode?: string;
  placeOfSupply?: string;
  gstType?: string;
  subtotal?: number;
  taxAmount?: number;
  total?: number;
  currency?: string;
  lineItems?: Array<{
    description?: string;
    hsnSac?: string;
    taxPercent?: number;
    qty?: number;
    unitPrice?: number;
    amount?: number;
  }>;
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
    accountName?: string;
  };
}

const DEFAULT_AGENCY = {
  name: "BLINK BEYOND",
  tagline: "Digital Marketing Agency",
  address: "Ground Floor, Shop No. 07, Ali Chamber Apt., Manor Road, Kotak Mahindra Bank, Palghar West, Palghar, Palghar, Maharashtra, 401404",
  gstin: "27ABGFB9280J1Z0",
  placeOfSupply: "Maharashtra",
  bankName: "HDFC BANK LIMITED",
  accountNo: "50200121903920",
  ifsc: "HDFC0000663",
};

/**
 * Generates and downloads a CSV invoice formatted to match Blink Beyond's standard.
 */
export function exportInvoiceToCsv(inv: InvoiceExportData) {
  const invNumber = inv.number || inv.invoiceNumber || "0001";
  const invDate = inv.invoiceDate || new Date().toISOString().split("T")[0];
  const docType = inv.invoiceType === "PROFORMA" ? "PROFORMA INVOICE" : "TAX INVOICE";

  const clientName = inv.clientName || "Valued Client";
  const clientAddr = [inv.billingAddress || inv.clientAddress, inv.clientCity, inv.clientState, inv.clientPostalCode]
    .filter(Boolean)
    .join(", ") || "Client Address";
  const clientGstin = inv.clientGstin || "URP (Unregistered Person)";
  const placeOfSupply = inv.placeOfSupply || inv.clientState || "Maharashtra";

  const isIGST = inv.gstType === "IGST" || (!clientGstin.startsWith("27") && placeOfSupply.toLowerCase() !== "maharashtra");
  
  const items = inv.lineItems && inv.lineItems.length > 0 ? inv.lineItems : [
    { description: "Digital Marketing & Social Media Management Services", hsnSac: "998361", taxPercent: 18, qty: 1, unitPrice: inv.subtotal || inv.total || 0 }
  ];

  const subtotal = items.reduce((s, it) => s + (Number(it.qty || 1) * Number(it.unitPrice || 0)), 0);
  const taxRate = items[0]?.taxPercent || 18;
  const taxAmount = (subtotal * taxRate) / 100;
  const grossAmount = Math.round(subtotal + taxAmount);
  const roundOff = (grossAmount - (subtotal + taxAmount)).toFixed(2);

  const cgst = isIGST ? 0 : Number((taxAmount / 2).toFixed(2));
  const sgst = isIGST ? 0 : Number((taxAmount / 2).toFixed(2));
  const igst = isIGST ? Number(taxAmount.toFixed(2)) : 0;

  const words = amountToWords(grossAmount, "INR");

  const clean = (str: string) => `"${str.replace(/"/g, '""')}"`;

  const rows: string[] = [
    `,,,,,,,Original for Recipient,,,,,,,,,,Duplicate for Transporter  ,,`,
    `,BLINK BEYOND,,,,,,,,,,BLINK BEYOND,,,,,,,,`,
    `,Digital Marketing Agency,,,,,,,,,,Digital Marketing Agency,,,,,,,,`,
    `,,,,,,,,,,,,,,,,,,,`,
    `,${clean(DEFAULT_AGENCY.address)},,,,,,,,,,,${clean(DEFAULT_AGENCY.address)},,,,,,,,`,
    `,GSTIN/UIN: ${DEFAULT_AGENCY.gstin},,,,,,,,,,GSTIN/UIN: ${DEFAULT_AGENCY.gstin},,,,,,,,`,
    `,${docType},,,,,,,,,,${docType},,,,,,,,`,
    `,Invoice No:- ${invNumber},,,,,,,,,,Invoice No:- ${invNumber},,,,,,,,`,
    `,Date:,${invDate},,,,,,,,,Date:,${invDate},,,,,,,`,
    `,"Bill To,",,,,"Ship To,",,,,,,"Bill To,",,,,"Ship To,",,,,`,
    `,${clean(clientName)},,,,${clean(clientName)},,,,,,${clean(clientName)},,,,${clean(clientName)},,,,`,
    `,${clean(clientAddr)},,,,${clean(clientAddr)},,,,,,${clean(clientAddr)},,,,${clean(clientAddr)},,,,`,
    `,Place of Supply:- ${placeOfSupply},,,,,,,,,,Place of Supply:- ${placeOfSupply},,,,,,,,`,
    `,GSTIN/UIN: ${clientGstin},,,,,,,,,,GSTIN/UIN: ${clientGstin},,,,,,,,`,
    `,,,,,,,,,,,,,,,,,,,`,
    `,,Description,,,HSN/SAC,,Tax Rate,Amount,Amount,,,Description,,HSN/SAC,HSN/SAC,,Tax Rate,Amount,Amount`,
  ];

  items.forEach((item, idx) => {
    const amt = Number(item.qty || 1) * Number(item.unitPrice || 0);
    const sac = item.hsnSac || "998361";
    const rate = item.taxPercent || 18;
    const desc = clean(item.description || "Digital Marketing Services");
    rows.push(
      `,${idx + 1},${desc},,,${sac},,${rate},${amt},${amt},,,${idx + 1},${desc},,${sac},${sac},,${rate},${amt},${amt}`
    );
  });

  // Empty filler rows matching standard invoice format height
  for (let i = 0; i < 5; i++) {
    rows.push(`,,,,,,,,,,,,,,,,,,,`);
  }

  // Totals & Bank details
  rows.push(`,,Bank Details,,,,,Taxable,,${subtotal},,,Bank Details,,,,,Taxable,,${subtotal}`);
  rows.push(`,Banking Name: ${DEFAULT_AGENCY.bankName},,,,,,CGST,,${cgst},,Banking Name: ${DEFAULT_AGENCY.bankName},,,,,,CGST,,${cgst}`);
  rows.push(`,Account No:- ${DEFAULT_AGENCY.accountNo},,,,,,SGST,,${sgst},,Account No:- ${DEFAULT_AGENCY.accountNo},,,,,,SGST,,${sgst}`);
  rows.push(`,IFSC Code:- ${DEFAULT_AGENCY.ifsc},,,,,,IGST,,${igst},,IFSC Code:- ${DEFAULT_AGENCY.ifsc},,,,,,IGST,,${igst}`);
  rows.push(`,,,,,,,Round Off.,,${roundOff},,,,,,,,,,Round Off.,,${roundOff}`);
  rows.push(`,,,,,,,Gross Amount,,${grossAmount},,,,,,,,Gross Amount,,${grossAmount}`);
  rows.push(`,Amount in Words:-,,${clean(words)},,,,,,,,Amount in Words:-,,${clean(words)},,,,,,`);
  rows.push(`,,,,,,,,,,,,,,,,,,,`);
  rows.push(`,Thank you for choosing us.,,,,,,,,,,Thank you for choosing us.,,,,,,,,`);
  rows.push(`,,,,,Authorised Signatory,,,,,,,,,,Authorised Signatory,,,,`);
  rows.push(
    `,"We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",,,,,,,,,,"We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",,,,,,,,`
  );

  const csvContent = "\uFEFF" + rows.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Invoice_${invNumber}_${clientName.replace(/[^a-zA-Z0-9]/g, "_")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a rich, formatted Excel workbook (.xlsx) with grid styling.
 */
export async function exportInvoiceToExcel(inv: InvoiceExportData) {
  const invNumber = inv.number || inv.invoiceNumber || "0001";
  const invDate = inv.invoiceDate || new Date().toISOString().split("T")[0];
  const docType = inv.invoiceType === "PROFORMA" ? "PROFORMA INVOICE" : "TAX INVOICE";

  const clientName = inv.clientName || "Valued Client";
  const clientAddr = [inv.billingAddress || inv.clientAddress, inv.clientCity, inv.clientState, inv.clientPostalCode]
    .filter(Boolean)
    .join(", ") || "Client Address";
  const clientGstin = inv.clientGstin || "URP (Unregistered Person)";
  const placeOfSupply = inv.placeOfSupply || inv.clientState || "Maharashtra";

  const isIGST = inv.gstType === "IGST" || (!clientGstin.startsWith("27") && placeOfSupply.toLowerCase() !== "maharashtra");
  
  const items = inv.lineItems && inv.lineItems.length > 0 ? inv.lineItems : [
    { description: "Digital Marketing & Social Media Management Services", hsnSac: "998361", taxPercent: 18, qty: 1, unitPrice: inv.subtotal || inv.total || 0 }
  ];

  const subtotal = items.reduce((s, it) => s + (Number(it.qty || 1) * Number(it.unitPrice || 0)), 0);
  const taxRate = items[0]?.taxPercent || 18;
  const taxAmount = (subtotal * taxRate) / 100;
  const grossAmount = Math.round(subtotal + taxAmount);
  const roundOff = (grossAmount - (subtotal + taxAmount)).toFixed(2);

  const cgst = isIGST ? 0 : Number((taxAmount / 2).toFixed(2));
  const sgst = isIGST ? 0 : Number((taxAmount / 2).toFixed(2));
  const igst = isIGST ? Number(taxAmount.toFixed(2)) : 0;

  const words = amountToWords(grossAmount, "INR");

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(invNumber.slice(0, 31));

  // Set default column widths
  ws.columns = [
    { width: 4 },  // A
    { width: 5 },  // B (Sr)
    { width: 32 }, // C (Desc)
    { width: 12 }, // D
    { width: 12 }, // E
    { width: 12 }, // F (HSN)
    { width: 10 }, // G (Tax)
    { width: 14 }, // H (Rate)
    { width: 16 }, // I (Amount)
    { width: 16 }, // J (Amount)
    { width: 4 },  // K (Spacer)
    { width: 5 },  // L (Sr)
    { width: 32 }, // M (Desc)
    { width: 12 }, // N
    { width: 12 }, // O (HSN)
    { width: 10 }, // P (Tax)
    { width: 14 }, // Q (Rate)
    { width: 16 }, // R (Amount)
    { width: 16 }, // S (Amount)
  ];

  // Helper to fill side-by-side or single section
  const addHeaderRow = (text1: string, text2: string) => {
    const row = ws.addRow(["", text1, "", "", "", "", "", "", "", "", "", text2]);
    return row;
  };

  ws.addRow(["", "", "", "", "", "", "Original for Recipient", "", "", "", "", "", "", "", "", "", "Duplicate for Transporter"]);
  const brandRow = ws.addRow(["", DEFAULT_AGENCY.name, "", "", "", "", "", "", "", "", "", DEFAULT_AGENCY.name]);
  brandRow.font = { bold: true, size: 14, color: { argb: "FF1E1B4B" } };

  ws.addRow(["", DEFAULT_AGENCY.tagline, "", "", "", "", "", "", "", "", "", DEFAULT_AGENCY.tagline]);
  ws.addRow(["", DEFAULT_AGENCY.address, "", "", "", "", "", "", "", "", "", DEFAULT_AGENCY.address]);
  ws.addRow(["", `GSTIN/UIN: ${DEFAULT_AGENCY.gstin}`, "", "", "", "", "", "", "", "", "", `GSTIN/UIN: ${DEFAULT_AGENCY.gstin}`]);

  const docRow = ws.addRow(["", docType, "", "", "", "", "", "", "", "", "", docType]);
  docRow.font = { bold: true, size: 12 };

  ws.addRow(["", `Invoice No:- ${invNumber}`, "", "", "", "", "", "", "", "", "", `Invoice No:- ${invNumber}`]);
  ws.addRow(["", "Date:", invDate, "", "", "", "", "", "", "", "", "Date:", invDate]);

  ws.addRow(["", "Bill To,", "", "", "Ship To,", "", "", "", "", "", "", "Bill To,", "", "", "Ship To,"]);
  ws.addRow(["", clientName, "", "", clientName, "", "", "", "", "", "", clientName, "", "", clientName]);
  ws.addRow(["", clientAddr, "", "", clientAddr, "", "", "", "", "", "", clientAddr, "", "", clientAddr]);
  ws.addRow(["", `Place of Supply:- ${placeOfSupply}`, "", "", "", "", "", "", "", "", "", `Place of Supply:- ${placeOfSupply}`]);
  ws.addRow(["", `GSTIN/UIN: ${clientGstin}`, "", "", "", "", "", "", "", "", "", `GSTIN/UIN: ${clientGstin}`]);
  ws.addRow([]);

  // Table header
  const tableHeaderRow = ws.addRow([
    "", "Sr", "Description", "", "", "HSN/SAC", "Tax %", "Qty", "Rate", "Amount",
    "", "Sr", "Description", "", "HSN/SAC", "Tax %", "Qty", "Rate", "Amount"
  ]);
  tableHeaderRow.font = { bold: true };
  tableHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" }
  };

  items.forEach((item, idx) => {
    const amt = Number(item.qty || 1) * Number(item.unitPrice || 0);
    const sac = item.hsnSac || "998361";
    const rate = item.taxPercent || 18;
    const desc = item.description || "Digital Marketing Services";
    ws.addRow([
      "", idx + 1, desc, "", "", sac, `${rate}%`, item.qty || 1, item.unitPrice || 0, amt,
      "", idx + 1, desc, "", sac, `${rate}%`, item.qty || 1, item.unitPrice || 0, amt
    ]);
  });

  // Empty spacing rows
  ws.addRow([]);
  ws.addRow([]);

  // Totals & Bank
  ws.addRow(["", "Bank Details", "", "", "", "", "Taxable", "", "", subtotal, "", "Bank Details", "", "", "Taxable", "", "", subtotal]);
  ws.addRow(["", `Banking Name: ${DEFAULT_AGENCY.bankName}`, "", "", "", "", "CGST (9%)", "", "", cgst, "", `Banking Name: ${DEFAULT_AGENCY.bankName}`, "", "", "CGST (9%)", "", "", cgst]);
  ws.addRow(["", `Account No:- ${DEFAULT_AGENCY.accountNo}`, "", "", "", "", "SGST (9%)", "", "", sgst, "", `Account No:- ${DEFAULT_AGENCY.accountNo}`, "", "", "SGST (9%)", "", "", sgst]);
  ws.addRow(["", `IFSC Code:- ${DEFAULT_AGENCY.ifsc}`, "", "", "", "", "IGST (18%)", "", "", igst, "", `IFSC Code:- ${DEFAULT_AGENCY.ifsc}`, "", "", "IGST (18%)", "", "", igst]);
  ws.addRow(["", "", "", "", "", "", "Round Off", "", "", roundOff, "", "", "", "", "Round Off", "", "", roundOff]);
  
  const grossRow = ws.addRow(["", "", "", "", "", "", "Gross Total", "", "", grossAmount, "", "", "", "", "Gross Total", "", "", grossAmount]);
  grossRow.font = { bold: true, size: 12 };

  ws.addRow(["", `Amount in Words: ${words}`, "", "", "", "", "", "", "", "", "", `Amount in Words: ${words}`]);
  ws.addRow([]);
  ws.addRow(["", "Thank you for choosing us.", "", "", "", "", "", "", "", "", "", "Thank you for choosing us."]);
  ws.addRow(["", "Authorised Signatory", "", "", "", "", "", "", "", "", "", "Authorised Signatory"]);
  ws.addRow(["", "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct."]);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Invoice_${invNumber}_${clientName.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
