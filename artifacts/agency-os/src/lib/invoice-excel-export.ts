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

  // Rows 1-2: empty
  grid.push(createEmptyRow());
  grid.push(createEmptyRow());

  // Row 3: Original & Duplicate headers
  const r3 = createEmptyRow();
  r3[7] = "Original for Recipient";
  r3[17] = "Duplicate for Transporter  ";
  grid.push(r3);

  // Row 4: BLINK BEYOND
  const r4 = createEmptyRow();
  r4[1] = "BLINK BEYOND";
  r4[11] = "BLINK BEYOND";
  grid.push(r4);

  // Row 5: Digital Marketing Agency
  const r5 = createEmptyRow();
  r5[1] = "Digital Marketing Agency";
  r5[11] = "Digital Marketing Agency";
  grid.push(r5);

  // Row 6: empty
  grid.push(createEmptyRow());

  // Row 7: Address
  const agencyAddr = "Ground Gloor, Shop No. 07, Ali Chamber Apt., Manor Road, Kotak Mahindra Bank, Palghar West, Palghar, Palghar, Maharashtra, 401404";
  const r7 = createEmptyRow();
  r7[1] = agencyAddr;
  r7[11] = agencyAddr;
  grid.push(r7);

  // Row 8: Agency GSTIN
  const r8 = createEmptyRow();
  r8[1] = "GSTIN/UIN: 27ABGFB9280J1Z0";
  r8[11] = "GSTIN/UIN: 27ABGFB9280J1Z0";
  grid.push(r8);

  // Row 9: Document Type
  const r9 = createEmptyRow();
  r9[1] = docType;
  r9[11] = docType;
  grid.push(r9);

  // Row 10: Invoice Number
  const r10 = createEmptyRow();
  r10[1] = `Invoice No:- ${invNumber}`;
  r10[11] = `Invoice No:- ${invNumber}`;
  grid.push(r10);

  // Row 11: Date
  const r11 = createEmptyRow();
  r11[1] = "Date:";
  r11[2] = invDate;
  r11[11] = "Date:";
  r11[12] = invDate;
  grid.push(r11);

  // Row 12: Bill To & Ship To
  const r12 = createEmptyRow();
  r12[1] = "Bill To,";
  r12[5] = "Ship To,";
  r12[11] = "Bill To,";
  r12[15] = "Ship To,";
  grid.push(r12);

  // Row 13: Client Name
  const r13 = createEmptyRow();
  r13[1] = clientName;
  r13[5] = clientName;
  r13[11] = clientName;
  r13[15] = clientName;
  grid.push(r13);

  // Row 14: Client Address
  const r14 = createEmptyRow();
  r14[1] = clientAddr;
  r14[5] = clientAddr;
  r14[11] = clientAddr;
  r14[15] = clientAddr;
  grid.push(r14);

  // Row 15: Place of Supply
  const r15 = createEmptyRow();
  r15[1] = `Place of Supply:- ${placeOfSupply}`;
  r15[11] = `Place of Supply:- ${placeOfSupply}`;
  grid.push(r15);

  // Row 16: Client GSTIN
  const r16 = createEmptyRow();
  r16[1] = `GSTIN/UIN: ${clientGstin}`;
  r16[11] = `GSTIN/UIN: ${clientGstin}`;
  grid.push(r16);

  // Row 17: empty
  grid.push(createEmptyRow());

  // Row 18: Items Header
  const r18 = createEmptyRow();
  r18[2] = "Description";
  r18[5] = "HSN/SAC";
  r18[7] = "Tax Rate";
  r18[8] = "Amount";
  r18[9] = "Amount";
  r18[12] = "Description";
  r18[14] = "HSN/SAC";
  r18[15] = "HSN/SAC";
  r18[17] = "Tax Rate";
  r18[18] = "Amount";
  r18[19] = "Amount";
  grid.push(r18);

  // Items rows
  items.forEach((item, idx) => {
    const rItem = createEmptyRow();
    const itAmt = Number(item.qty || 1) * Number(item.unitPrice || 0);
    const sac = item.hsnSac || "998361";
    const rate = String(item.taxPercent || 18);
    const desc = item.description || "";

    rItem[1] = String(idx + 1);
    rItem[2] = desc;
    rItem[5] = sac;
    rItem[7] = rate;
    rItem[8] = String(itAmt);
    rItem[9] = String(itAmt);

    rItem[11] = String(idx + 1);
    rItem[12] = desc;
    rItem[14] = sac;
    rItem[15] = sac;
    rItem[17] = rate;
    rItem[18] = String(itAmt);
    rItem[19] = String(itAmt);

    grid.push(rItem);
  });

  // Empty filler rows (matching template height)
  const totalItemRows = items.length;
  const fillerCount = Math.max(1, 19 - totalItemRows);
  for (let i = 0; i < fillerCount; i++) {
    grid.push(createEmptyRow());
  }

  // Bank Details & Taxable
  const rBank = createEmptyRow();
  rBank[2] = "Bank Details";
  rBank[7] = "Taxable";
  rBank[9] = String(subtotal);
  rBank[12] = "Bank Details";
  rBank[17] = "Taxable";
  rBank[19] = String(subtotal);
  grid.push(rBank);

  // Banking Name & CGST
  const rCgst = createEmptyRow();
  rCgst[1] = "Banking Name: HDFC BANK LIMITED";
  rCgst[7] = "CGST";
  rCgst[9] = cgst;
  rCgst[11] = "Banking Name: HDFC BANK LIMITED";
  rCgst[17] = "CGST";
  rCgst[19] = cgst;
  grid.push(rCgst);

  // Account No & SGST
  const rSgst = createEmptyRow();
  rSgst[1] = "Account No:- 50200121903920";
  rSgst[7] = "SGST";
  rSgst[9] = sgst;
  rSgst[11] = "Account No:- 50200121903920";
  rSgst[17] = "SGST";
  rSgst[19] = sgst;
  grid.push(rSgst);

  // IFSC Code & IGST
  const rIgst = createEmptyRow();
  rIgst[1] = "IFSC Code:- HDFC0000663";
  rIgst[7] = "IGST";
  rIgst[9] = igst;
  rIgst[11] = "IFSC Code:- HDFC0000663";
  rIgst[17] = "IGST";
  rIgst[19] = igst;
  grid.push(rIgst);

  // Round Off
  const rRound = createEmptyRow();
  rRound[7] = "Round Off.";
  rRound[9] = String(roundOff);
  rRound[17] = "Round Off.";
  rRound[19] = String(roundOff);
  grid.push(rRound);

  // Gross Amount
  const rGross = createEmptyRow();
  rGross[7] = "Gross Amount";
  rGross[9] = String(grossAmount);
  rGross[17] = "Gross Amount";
  rGross[19] = String(grossAmount);
  grid.push(rGross);

  // Amount in Words
  const rWords = createEmptyRow();
  rWords[1] = "Amount in Words:-";
  rWords[3] = words;
  rWords[11] = "Amount in Words:-";
  rWords[13] = words;
  grid.push(rWords);

  // 6 empty spacer rows
  for (let i = 0; i < 6; i++) {
    grid.push(createEmptyRow());
  }

  // Thank you for choosing us
  const rThank = createEmptyRow();
  rThank[1] = "Thank you for choosing us.";
  rThank[11] = "Thank you for choosing us.";
  grid.push(rThank);

  // 1 empty row
  grid.push(createEmptyRow());

  // Authorised Signatory
  const rSign = createEmptyRow();
  rSign[5] = "Authorised Signatory";
  rSign[15] = "Authorised Signatory";
  grid.push(rSign);

  // Declaration
  const declaration = "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.";
  const rDecl = createEmptyRow();
  rDecl[1] = declaration;
  rDecl[11] = declaration;
  grid.push(rDecl);

  return grid;
}

/**
 * Downloads the exact CSV representation of the invoice.
 */
export function exportInvoiceToCsv(inv: InvoiceExportData) {
  const invNumber = inv.number || inv.invoiceNumber || "0003";
  const clientName = inv.clientName || "Client";
  const grid = buildExactInvoiceGrid(inv);

  const csvLines = grid.map((row) =>
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
 */
export async function exportInvoiceToExcel(inv: InvoiceExportData) {
  const invNumber = inv.number || inv.invoiceNumber || "0003";
  const clientName = inv.clientName || "Client";
  const grid = buildExactInvoiceGrid(inv);

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(invNumber.slice(0, 31));

  // Set 20 columns
  ws.columns = [
    { width: 3 },  // 0: spacer
    { width: 28 }, // 1: Bill To / Details
    { width: 28 }, // 2: Description
    { width: 12 }, // 3
    { width: 12 }, // 4
    { width: 14 }, // 5: Ship To / HSN
    { width: 10 }, // 6
    { width: 12 }, // 7: Tax Rate / Labels
    { width: 14 }, // 8: Amount
    { width: 16 }, // 9: Amount / Totals
    { width: 3 },  // 10: spacer
    { width: 28 }, // 11: Bill To / Details
    { width: 28 }, // 12: Description
    { width: 12 }, // 13
    { width: 12 }, // 14: HSN
    { width: 14 }, // 15: Ship To / HSN
    { width: 10 }, // 16
    { width: 12 }, // 17: Tax Rate / Labels
    { width: 14 }, // 18: Amount
    { width: 16 }, // 19: Amount / Totals
  ];

  grid.forEach((rowValues) => {
    const row = ws.addRow(rowValues);
    const firstCol = rowValues[1] || "";
    if (firstCol === "BLINK BEYOND") {
      row.font = { bold: true, size: 13, color: { argb: "FF1E1B4B" } };
    } else if (firstCol === "TAX INVOICE" || firstCol === "PROFORMA INVOICE") {
      row.font = { bold: true, size: 12 };
    } else if (rowValues[2] === "Description" || rowValues[7] === "Original for Recipient") {
      row.font = { bold: true };
    } else if (rowValues[7] === "Gross Amount") {
      row.font = { bold: true, size: 11 };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Invoice_${invNumber}_${clientName.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
