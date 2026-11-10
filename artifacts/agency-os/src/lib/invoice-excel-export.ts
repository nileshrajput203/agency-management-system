import ExcelJS from "exceljs";
import { amountToWords } from "./pdf-utils";
import { INVOICE_TEMPLATE_BASE64 } from "../templates/invoice-template-base64";

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

/**
 * Builds the exact 20-column 55-row 2D grid matching the user's template.
 * Left half: cols 0-9 (Original for Recipient)
 * Right half: cols 10-19 (Duplicate for Transporter)
 */
export function buildExactInvoiceGrid(inv: InvoiceExportData): string[][] {
  const invNumber = inv.number || inv.invoiceNumber || "0003";
  const invDate = inv.invoiceDate || new Date().toISOString().split("T")[0];
  const docType = inv.invoiceType === "PROFORMA" ? "PROFORMA INVOICE" : "TAX INVOICE";

  const clientName = inv.clientName || "(name)";
  const clientAddr = [
    inv.billingAddress || inv.clientAddress,
    inv.clientCity,
    inv.clientState,
    inv.clientPostalCode,
  ]
    .filter(Boolean)
    .join(", ") || "(adress)";
  const clientGstin = inv.clientGstin || "27AHQPB7460C1ZE";
  const placeOfSupply = inv.placeOfSupply || inv.clientState || "Maharashtra";

  const isIGST =
    inv.gstType === "IGST" ||
    (!clientGstin.startsWith("27") && placeOfSupply.toLowerCase() !== "maharashtra" && placeOfSupply.toLowerCase() !== "mh");

  const items =
    inv.lineItems && inv.lineItems.length > 0
      ? inv.lineItems
      : [
          {
            description: "Digital Marketing & Social Media Management Services",
            hsnSac: "998361",
            taxPercent: 18,
            qty: 1,
            unitPrice: inv.subtotal || inv.total || 0,
          },
        ];

  const subtotal = items.reduce(
    (s, it) => s + Number(it.qty || 1) * Number(it.unitPrice || 0),
    0
  );
  const taxRate = items[0]?.taxPercent || 18;
  const taxAmount = (subtotal * taxRate) / 100;
  const grossAmount = Math.round(subtotal + taxAmount);
  const roundOff = (grossAmount - (subtotal + taxAmount)).toFixed(2);

  const cgst = isIGST ? "0" : (taxAmount / 2).toFixed(2);
  const sgst = isIGST ? "0" : (taxAmount / 2).toFixed(2);
  const igst = isIGST ? taxAmount.toFixed(2) : "";

  const words = amountToWords(grossAmount, "INR");

  const createEmptyRow = () => new Array(20).fill("");
  const grid: string[][] = [];

  // Rows 1-2 (Index 0-1): empty
  grid.push(createEmptyRow());
  grid.push(createEmptyRow());

  // Row 3 (Index 2): Top Agency Header
  const r3 = createEmptyRow();
  r3[1] = "►►  BLINK BEYOND";
  r3[6] = "+91 95455 56009";
  r3[11] = "►►  BLINK BEYOND";
  r3[16] = "+91 95455 56009";
  grid.push(r3);

  // Row 4 (Index 3): Tagline & Email
  const r4 = createEmptyRow();
  r4[1] = "WEBSITE  |  SOCIAL MEDIA  |  MARKETING";
  r4[6] = "support@blinkbeyond.co.in";
  r4[11] = "WEBSITE  |  SOCIAL MEDIA  |  MARKETING";
  r4[16] = "support@blinkbeyond.co.in";
  grid.push(r4);

  // Row 5 (Index 4): HO & Website
  const r5 = createEmptyRow();
  r5[1] = "HO – Palghar, Maharashtra";
  r5[6] = "www.blinkbeyond.co.in";
  r5[11] = "HO – Palghar, Maharashtra";
  r5[16] = "www.blinkbeyond.co.in";
  grid.push(r5);

  // Row 6 (Index 5): Original & Duplicate indicators
  const r6 = createEmptyRow();
  r6[7] = "Original for Recipient";
  r6[17] = "Duplicate for Supplier  ";
  grid.push(r6);

  // Row 7 (Index 6): BLINK BEYOND
  const r7 = createEmptyRow();
  r7[1] = "BLINK BEYOND";
  r7[11] = "BLINK BEYOND";
  grid.push(r7);

  // Row 8 (Index 7): Digital Marketing Agency
  const r8 = createEmptyRow();
  r8[1] = "Digital Marketing Agency";
  r8[11] = "Digital Marketing Agency";
  grid.push(r8);

  // Row 9 (Index 8): empty spacer
  grid.push(createEmptyRow());

  // Row 10 (Index 9): Address
  const agencyAddr = "Ground Floor, Shop No. 07, Ali Chamber Apt., Manor Road, Near Kotak Mahindra Bank, Palghar West, Palghar, Maharashtra, 401404";
  const r10 = createEmptyRow();
  r10[1] = agencyAddr;
  r10[11] = agencyAddr;
  grid.push(r10);

  // Row 11 (Index 10): Agency GSTIN
  const r11 = createEmptyRow();
  r11[1] = "GSTIN/UIN: 27ABGFB9280J1Z0";
  r11[11] = "GSTIN/UIN: 27ABGFB9280J1Z0";
  grid.push(r11);

  // Row 12 (Index 11): Document Type
  const r12 = createEmptyRow();
  r12[1] = docType;
  r12[11] = docType;
  grid.push(r12);

  // Row 13 (Index 12): Invoice Number
  const r13 = createEmptyRow();
  r13[1] = `Invoice No:- ${invNumber}`;
  r13[11] = `Invoice No:- ${invNumber}`;
  grid.push(r13);

  // Row 14 (Index 13): Date
  const r14 = createEmptyRow();
  r14[1] = "Date:";
  r14[2] = invDate;
  r14[11] = "Date:";
  r14[12] = invDate;
  grid.push(r14);

  // Row 15 (Index 14): Bill To & Ship To labels
  const r15 = createEmptyRow();
  r15[1] = "Bill To,";
  r15[5] = "Ship To,";
  r15[11] = "Bill To,";
  r15[15] = "Ship To,";
  grid.push(r15);

  // Row 16 (Index 15): Client Name
  const r16 = createEmptyRow();
  r16[1] = clientName;
  r16[5] = clientName;
  r16[11] = clientName;
  r16[15] = clientName;
  grid.push(r16);

  // Row 17 (Index 16): Client Address
  const r17 = createEmptyRow();
  r17[1] = clientAddr;
  r17[5] = clientAddr;
  r17[11] = clientAddr;
  r17[15] = clientAddr;
  grid.push(r17);

  // Row 18 (Index 17): Place of Supply
  const r18 = createEmptyRow();
  r18[1] = `Place of Supply:- ${placeOfSupply}`;
  r18[11] = `Place of Supply:- ${placeOfSupply}`;
  grid.push(r18);

  // Row 19 (Index 18): Client GSTIN
  const r19 = createEmptyRow();
  r19[1] = `GSTIN/UIN: ${clientGstin}`;
  r19[11] = `GSTIN/UIN: ${clientGstin}`;
  grid.push(r19);

  // Row 20 (Index 19): empty spacer
  grid.push(createEmptyRow());

  // Row 21 (Index 20): Items Header
  const r21 = createEmptyRow();
  r21[1] = "S.No";
  r21[2] = "Description";
  r21[5] = "HSN/SAC";
  r21[7] = "Tax Rate";
  r21[8] = "Amount";
  r21[9] = "Amount";
  r21[11] = "S.No";
  r21[12] = "Description";
  r21[14] = "HSN/SAC";
  r21[15] = "HSN/SAC";
  r21[17] = "Tax Rate";
  r21[18] = "Amount";
  r21[19] = "Amount";
  grid.push(r21);

  // Rows 22..39 (Index 21..38 = 18 item slots)
  for (let i = 0; i < 18; i++) {
    const rItem = createEmptyRow();
    if (i < items.length) {
      const item = items[i];
      const itAmt = Number(item.amount != null ? item.amount : Number(item.qty || 1) * Number(item.unitPrice || 0));
      const sac = item.hsnSac || "998361";
      const rate = String(item.taxPercent || 18);
      const desc = item.description || "";

      rItem[1] = String(i + 1);
      rItem[2] = desc;
      rItem[5] = sac;
      rItem[7] = rate;
      rItem[8] = String(itAmt);
      rItem[9] = String(itAmt);

      rItem[11] = String(i + 1);
      rItem[12] = desc;
      rItem[14] = sac;
      rItem[15] = sac;
      rItem[17] = rate;
      rItem[18] = String(itAmt);
      rItem[19] = String(itAmt);
    }
    grid.push(rItem);
  }

  // Row 40 (Index 39): empty spacer
  grid.push(createEmptyRow());

  // Row 41 (Index 40): Bank Details & Taxable
  const r41 = createEmptyRow();
  r41[2] = "Bank Details";
  r41[7] = "Taxable";
  r41[9] = String(subtotal);
  r41[12] = "Bank Details";
  r41[17] = "Taxable";
  r41[19] = String(subtotal);
  grid.push(r41);

  // Row 42 (Index 41): Banking Name & CGST
  const r42 = createEmptyRow();
  r42[1] = "Bank Name: HDFC BANK LIMITED";
  r42[7] = "CGST";
  r42[9] = cgst;
  r42[11] = "Bank Name: HDFC BANK LIMITED";
  r42[17] = "CGST";
  r42[19] = cgst;
  grid.push(r42);

  // Row 43 (Index 42): Account No & SGST
  const r43 = createEmptyRow();
  r43[1] = "Account No:- 50200121903920";
  r43[7] = "SGST";
  r43[9] = sgst;
  r43[11] = "Account No:- 50200121903920";
  r43[17] = "SGST";
  r43[19] = sgst;
  grid.push(r43);

  // Row 44 (Index 43): IFSC Code & IGST
  const r44 = createEmptyRow();
  r44[1] = "IFSC Code:- HDFC0000663";
  r44[7] = "IGST";
  r44[9] = igst;
  r44[11] = "IFSC Code:- HDFC0000663";
  r44[17] = "IGST";
  r44[19] = igst;
  grid.push(r44);

  // Row 45 (Index 44): Round Off
  const r45 = createEmptyRow();
  r45[7] = "Round Off.";
  r45[9] = String(roundOff);
  r45[17] = "Round Off.";
  r45[19] = String(roundOff);
  grid.push(r45);

  // Row 46 (Index 45): Gross Amount
  const r46 = createEmptyRow();
  r46[7] = "Gross Amount";
  r46[9] = String(grossAmount);
  r46[17] = "Gross Amount";
  r46[19] = String(grossAmount);
  grid.push(r46);

  // Row 47 (Index 46): Amount in Words
  const r47 = createEmptyRow();
  r47[1] = "Amount in Words:-";
  r47[3] = words;
  r47[11] = "Amount in Words:-";
  r47[13] = words;
  grid.push(r47);

  // Rows 48..51: 4 empty spacer rows
  for (let i = 0; i < 4; i++) {
    grid.push(createEmptyRow());
  }

  // Row 52: Thank you for choosing us
  const rThank = createEmptyRow();
  rThank[1] = "Thank you for choosing us.";
  rThank[11] = "Thank you for choosing us.";
  grid.push(rThank);

  // Row 53: Authorised Signatory
  const rSign = createEmptyRow();
  rSign[5] = "Authorised Signatory";
  rSign[15] = "Authorised Signatory";
  grid.push(rSign);

  // Row 54: Declaration
  const declaration = "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.";
  const rDecl = createEmptyRow();
  rDecl[1] = declaration;
  rDecl[11] = declaration;
  grid.push(rDecl);

  return grid;

  return grid;
}

/**
 * Loads the master workbook from /templates/INVOICE_FORMAT.xlsx or embedded base64.
 */
export async function loadMasterTemplateWorkbook(): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  let loaded = false;

  // 1. Try fetching from web server
  if (typeof window !== "undefined" && typeof fetch === "function") {
    try {
      const res = await fetch("/templates/INVOICE_FORMAT.xlsx");
      if (res.ok) {
        const ab = await res.arrayBuffer();
        await wb.xlsx.load(ab);
        loaded = true;
      }
    } catch {
      // ignore, fallback
    }
  }

  // 2. Fallback to embedded base64 string
  if (!loaded && INVOICE_TEMPLATE_BASE64) {
    try {
      const binStr = atob(INVOICE_TEMPLATE_BASE64);
      const len = binStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      await wb.xlsx.load(bytes.buffer);
      loaded = true;
    } catch (err) {
      console.error("Failed to load embedded invoice template:", err);
    }
  }

  return wb;
}

/**
 * Injects dynamic invoice data into the exact master template worksheet.
 */
export async function populateExactTemplate(inv: InvoiceExportData): Promise<ExcelJS.Workbook> {
  const wb = await loadMasterTemplateWorkbook();
  const ws = wb.worksheets[0] || wb.getWorksheet("Sale Invoice");
  if (!ws) {
    throw new Error("Master template worksheet not found");
  }

  const invNumber = inv.number || inv.invoiceNumber || "0003";
  const invDate = inv.invoiceDate || new Date().toISOString().split("T")[0];

  const clientName = inv.clientName || "(name)";
  const clientAddr = [
    inv.billingAddress || inv.clientAddress,
    inv.clientCity,
    inv.clientState,
    inv.clientPostalCode,
  ]
    .filter(Boolean)
    .join(", ") || "(adress)";
  const clientGstin = inv.clientGstin || "27AHQPB7460C1ZE";
  const placeOfSupply = inv.placeOfSupply || inv.clientState || "Maharashtra";

  const isIGST =
    inv.gstType === "IGST" ||
    (!clientGstin.startsWith("27") &&
      placeOfSupply.toLowerCase() !== "maharashtra" &&
      placeOfSupply.toLowerCase() !== "mh");

  const items =
    inv.lineItems && inv.lineItems.length > 0
      ? inv.lineItems
      : [
          {
            description: "Digital Marketing & Social Media Management Services",
            hsnSac: "998361",
            taxPercent: 18,
            qty: 1,
            unitPrice: inv.subtotal || inv.total || 0,
            amount: inv.subtotal || inv.total || 0,
          },
        ];

  const subtotal = items.reduce(
    (s, it) => s + Number(it.amount != null ? it.amount : Number(it.qty || 1) * Number(it.unitPrice || 0)),
    0
  );
  const taxRate = items[0]?.taxPercent || 18;
  const taxAmount = (subtotal * taxRate) / 100;
  const grossAmount = Math.round(subtotal + taxAmount);
  const roundOff = Number((grossAmount - (subtotal + taxAmount)).toFixed(2));
  const words = amountToWords(grossAmount, "INR");

  // Invoice Number (Row 13 in master template)
  ws.getCell("B13").value = `Invoice No:- ${invNumber}`;
  ws.getCell("L13").value = { formula: "B13", result: `Invoice No:- ${invNumber}` };

  // Date (Row 14)
  ws.getCell("C14").value = invDate;
  ws.getCell("M14").value = { formula: "C14", result: invDate };

  // Bill To / Ship To (Rows 16 & 17)
  ws.getCell("B16").value = clientName;
  ws.getCell("F16").value = { formula: "B16", result: clientName };
  ws.getCell("L16").value = { formula: "B16", result: clientName };
  ws.getCell("P16").value = { formula: "L16", result: clientName };

  ws.getCell("B17").value = clientAddr;
  ws.getCell("F17").value = { formula: "B17", result: clientAddr };
  ws.getCell("L17").value = { formula: "B17", result: clientAddr };
  ws.getCell("P17").value = { formula: "L17", result: clientAddr };

  // Place of Supply (Row 18) & GSTIN (Row 19)
  ws.getCell("B18").value = `Place of Supply:- ${placeOfSupply}`;
  ws.getCell("L18").value = { formula: "B18", result: `Place of Supply:- ${placeOfSupply}` };

  ws.getCell("B19").value = `GSTIN/UIN: ${clientGstin}`;
  ws.getCell("L19").value = { formula: "B19", result: `GSTIN/UIN: ${clientGstin}` };

  // Items table (Rows 22 to 39 = 18 available slots)
  for (let i = 0; i < 18; i++) {
    const rowNum = 22 + i;
    if (i < items.length) {
      const it = items[i];
      const itAmt = Number(it.amount != null ? it.amount : Number(it.qty || 1) * Number(it.unitPrice || 0));
      const itTax = it.taxPercent != null ? Number(it.taxPercent) : Number(taxRate);
      const itHsn = it.hsnSac ? (isNaN(Number(it.hsnSac)) ? it.hsnSac : Number(it.hsnSac)) : 998361;
      const itDesc = it.description || "";

      ws.getCell(`B${rowNum}`).value = i + 1;
      ws.getCell(`C${rowNum}`).value = itDesc;
      ws.getCell(`F${rowNum}`).value = itHsn;
      ws.getCell(`H${rowNum}`).value = itTax;
      ws.getCell(`I${rowNum}`).value = itAmt;

      ws.getCell(`L${rowNum}`).value = { formula: `B${rowNum}`, result: i + 1 };
      ws.getCell(`M${rowNum}`).value = { formula: `C${rowNum}`, result: itDesc };
      ws.getCell(`P${rowNum}`).value = { formula: `F${rowNum}`, result: itHsn };
      ws.getCell(`R${rowNum}`).value = { formula: `H${rowNum}`, result: itTax };
      ws.getCell(`S${rowNum}`).value = { formula: `I${rowNum}`, result: itAmt };
    } else {
      ws.getCell(`B${rowNum}`).value = null;
      ws.getCell(`C${rowNum}`).value = null;
      ws.getCell(`F${rowNum}`).value = null;
      ws.getCell(`H${rowNum}`).value = null;
      ws.getCell(`I${rowNum}`).value = null;

      ws.getCell(`L${rowNum}`).value = null;
      ws.getCell(`M${rowNum}`).value = null;
      ws.getCell(`P${rowNum}`).value = null;
      ws.getCell(`R${rowNum}`).value = null;
      ws.getCell(`S${rowNum}`).value = null;
    }
  }

  // Intra-state / Inter-state flag in cell W3
  ws.getCell("W3").value = {
    formula: 'IF(ISNUMBER(SEARCH("Maharashtra",$B$18)),1,0)',
    result: isIGST ? 0 : 1,
  };

  // Row 41: Taxable Amount
  ws.getCell("J41").value = { formula: "SUM(I22:J39)", result: subtotal };
  ws.getCell("T41").value = { formula: "J41", result: subtotal };

  // Rows 42..44: CGST, SGST, IGST
  if (isIGST) {
    ws.getCell("J42").value = { formula: "IF($W$3=1,ROUND($W$13/2,2),0)", result: 0 };
    ws.getCell("T42").value = { formula: "J42", result: 0 };
    ws.getCell("J43").value = { formula: "J42", result: 0 };
    ws.getCell("T43").value = { formula: "J43", result: 0 };
    ws.getCell("J44").value = { formula: "IF($W$3=1,0,ROUND($W$13,2))", result: taxAmount };
    ws.getCell("T44").value = { formula: "J44", result: taxAmount };
  } else {
    const halfTax = Number((taxAmount / 2).toFixed(2));
    ws.getCell("J42").value = { formula: "IF($W$3=1,ROUND($W$13/2,2),0)", result: halfTax };
    ws.getCell("T42").value = { formula: "J42", result: halfTax };
    ws.getCell("J43").value = { formula: "J42", result: halfTax };
    ws.getCell("T43").value = { formula: "J43", result: halfTax };
    ws.getCell("J44").value = { formula: "IF($W$3=1,0,ROUND($W$13,2))", result: 0 };
    ws.getCell("T44").value = { formula: "J44", result: 0 };
  }

  // Row 45: Round Off
  ws.getCell("J45").value = roundOff;
  ws.getCell("T45").value = { formula: "J45", result: roundOff };

  // Row 46: Gross Amount
  ws.getCell("J46").value = { formula: "J41+J42+J43+J44+J45", result: grossAmount };
  ws.getCell("T46").value = { formula: "J46", result: grossAmount };

  // Row 47: Amount in Words
  const currentD47Formula = (ws.getCell("D47").value as any)?.formula;
  if (currentD47Formula) {
    ws.getCell("D47").value = { formula: currentD47Formula, result: words };
  } else {
    ws.getCell("D47").value = words;
  }
  ws.getCell("N47").value = { formula: "D47", result: words };

  return wb;

  return wb;
}

/**
 * Downloads the exact CSV representation of the invoice.
 */
export async function exportInvoiceToCsv(inv: InvoiceExportData) {
  const invNumber = inv.number || inv.invoiceNumber || "0003";
  const clientName = inv.clientName || "Client";
  const wb = await populateExactTemplate(inv);
  const ws = wb.worksheets[0];

  const rows: string[][] = [];
  for (let r = 1; r <= Math.max(54, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const rowCells: string[] = [];
    for (let c = 1; c <= 20; c++) {
      const cell = row.getCell(c);
      let val = cell.value;
      if (val != null && typeof val === "object") {
        if ("result" in val && val.result != null) {
          val = val.result;
        } else if ("formula" in val) {
          val = "";
        }
      }
      rowCells.push(val != null ? String(val) : "");
    }
    rows.push(rowCells);
  }

  const csvLines = rows.map((row) =>
    row
      .map((cell) => {
        if (!cell) return "";
        if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      })
      .join(",")
  );

  const csvContent = "\uFEFF" + csvLines.join("\r\n");
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
 * Downloads the exact Excel workbook (.xlsx) matching the 20-column dual template.
 * Uses direct master template ZIP injection on the backend for 100% byte-level fidelity.
 */
export async function exportInvoiceToExcel(inv: InvoiceExportData) {
  const invNumber = inv.number || inv.invoiceNumber || "0003";
  const clientName = (inv.clientName || "Client").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `Invoice_${invNumber}_${clientName}.xlsx`;

  // First try the backend master excel generator (produces 100% byte-for-byte identical output from original 14_Invoice_Format.xlsx)
  try {
    const token =
      localStorage.getItem("agency_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("auth_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch("/api/invoices/export-excel", {
      method: "POST",
      headers,
      body: JSON.stringify(inv),
    });

    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }
  } catch (err) {
    console.warn("Backend excel export failed, falling back to local generator", err);
  }

  // Fallback to client-side generator if offline
  const workbook = await populateExactTemplate(inv);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads the exact Master Invoice PDF matching 14_Invoice_Format.xlsx (dual-sided A4 layout).
 * Performs direct server-side headless generation for 100% pixel-perfect vector A4 PDF.
 */
export async function exportInvoiceToPdf(inv: InvoiceExportData | any) {
  const invNumber = inv.number || inv.invoiceNumber || "0003";
  const clientName = (inv.clientName || "Client").replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `Invoice_${invNumber}_${clientName}.pdf`;

  const token =
    localStorage.getItem("agency_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("auth_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  if (inv.id && (!inv.lineItems || inv.lineItems.length === 0)) {
    res = await fetch(`/api/invoices/${inv.id}/pdf`, { headers });
  } else {
    res = await fetch("/api/invoices/export-pdf", {
      method: "POST",
      headers,
      body: JSON.stringify(inv),
    });
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to generate PDF: ${res.statusText} (${errorText})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


