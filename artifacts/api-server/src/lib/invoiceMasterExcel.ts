import fs from "fs";
import zlib from "zlib";
import path from "path";
import { fileURLToPath } from "url";

const currentDir = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// CRC-32 table
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function calcCrc32(buf: Buffer): number {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function escapeXml(unsafe: unknown): string {
  if (unsafe == null) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function dateToExcelSerial(dateStr: string): number {
  const clean = String(dateStr).split("T")[0];
  const parts = clean.split("-").map(Number);
  const year = parts[0] || 2026;
  const month = (parts[1] || 1) - 1;
  const day = parts[2] || 1;
  const dt = new Date(Date.UTC(year, month, day));
  const base = new Date(Date.UTC(1899, 11, 30));
  return Math.floor((dt.getTime() - base.getTime()) / 86400000);
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
    return (ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + twoDigit(n % 100) : "")).trim();
  }
  function toWords(n: number) {
    if (n === 0) return "Zero";
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thou = Math.floor((n % 100000) / 1000);
    const rem = n % 1000;
    const res: string[] = [];
    if (crore) res.push(twoDigit(crore) + " Crore");
    if (lakh) res.push(twoDigit(lakh) + " Lakh");
    if (thou) res.push(twoDigit(thou) + " Thousand");
    if (rem) res.push(threeDigit(rem));
    return res.join(" ").trim();
  }

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  let res = toWords(rupees) + " Rupees";
  if (paise > 0) {
    res += " And " + toWords(paise) + " Paise";
  }
  return res + " Only.";
}

interface ZipEntry {
  filename: string;
  method: number;
  modTime: number;
  modDate: number;
  crc: number;
  compSize: number;
  uncompSize: number;
  compData: Buffer;
}

function parseZip(buf: Buffer): ZipEntry[] {
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error("EOCD not found");

  const cdCount = buf.readUInt16LE(eocdOffset + 10);
  const cdOffset = buf.readUInt32LE(eocdOffset + 16);

  const entries: ZipEntry[] = [];
  let curr = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    const method = buf.readUInt16LE(curr + 10);
    const modTime = buf.readUInt16LE(curr + 12);
    const modDate = buf.readUInt16LE(curr + 14);
    const crc = buf.readUInt32LE(curr + 16);
    const compSize = buf.readUInt32LE(curr + 20);
    const uncompSize = buf.readUInt32LE(curr + 24);
    const nameLen = buf.readUInt16LE(curr + 28);
    const extraLen = buf.readUInt16LE(curr + 30);
    const commentLen = buf.readUInt16LE(curr + 32);
    const localHeaderOffset = buf.readUInt32LE(curr + 42);

    const filename = buf.toString("utf8", curr + 46, curr + 46 + nameLen);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + nameLen + localExtraLen;
    const compData = buf.subarray(dataOffset, dataOffset + compSize);

    entries.push({
      filename,
      method,
      modTime,
      modDate,
      crc,
      compSize,
      uncompSize,
      compData,
    });

    curr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function createZip(entries: ZipEntry[]): Buffer {
  const parts: Buffer[] = [];
  const cdEntries: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.filename, "utf8");
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(entry.method, 8);
    localHeader.writeUInt16LE(entry.modTime, 10);
    localHeader.writeUInt16LE(entry.modDate, 12);
    localHeader.writeUInt32LE(entry.crc, 14);
    localHeader.writeUInt32LE(entry.compSize, 18);
    localHeader.writeUInt32LE(entry.uncompSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    parts.push(localHeader);
    parts.push(nameBuf);
    parts.push(entry.compData);

    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0);
    cdHeader.writeUInt16LE(20, 4);
    cdHeader.writeUInt16LE(20, 6);
    cdHeader.writeUInt16LE(0, 8);
    cdHeader.writeUInt16LE(entry.method, 10);
    cdHeader.writeUInt16LE(entry.modTime, 12);
    cdHeader.writeUInt16LE(entry.modDate, 14);
    cdHeader.writeUInt32LE(entry.crc, 16);
    cdHeader.writeUInt32LE(entry.compSize, 20);
    cdHeader.writeUInt32LE(entry.uncompSize, 24);
    cdHeader.writeUInt16LE(nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);
    cdHeader.writeUInt16LE(0, 32);
    cdHeader.writeUInt16LE(0, 34);
    cdHeader.writeUInt16LE(0, 36);
    cdHeader.writeUInt32LE(0, 38);
    cdHeader.writeUInt32LE(offset, 42);

    cdEntries.push(cdHeader);
    cdEntries.push(nameBuf);

    offset += localHeader.length + nameBuf.length + entry.compData.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const p of cdEntries) {
    parts.push(p);
    cdSize += p.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);
  parts.push(eocd);

  return Buffer.concat(parts);
}

function replaceCell(
  xml: string,
  cellRef: string,
  styleId: string,
  cellType: "inlineStr" | "str" | "n" | null,
  formula: string | null,
  value: string | number | null
): string {
  let content = "";
  if (formula) content += `<f>${escapeXml(formula)}</f>`;
  if (cellType === "inlineStr") {
    content += `<is><t>${escapeXml(value)}</t></is>`;
  } else if (cellType === "str") {
    content += `<v>${escapeXml(value)}</v>`;
  } else if (cellType === "n") {
    if (value !== undefined && value !== null && value !== "") {
      content += `<v>${value}</v>`;
    }
  }

  const typeAttr = cellType ? ` t="${cellType}"` : "";
  const newCell = content
    ? `<c r="${cellRef}" s="${styleId}"${typeAttr}>${content}</c>`
    : `<c r="${cellRef}" s="${styleId}"${typeAttr}/>`;
  const pattern = new RegExp(`<c r="${cellRef}"[^>]*(?:/>|>.*?</c>)`);
  return xml.replace(pattern, newCell);
}

function getMasterTemplateBuffer(): Buffer {
  const possiblePaths = [
    "C:\\Users\\USER\\Downloads\\BlinkBeyond_Intern_Kit_v4\\BlinkBeyond_Intern_Kit_v4\\Excel\\14_Invoice_Format.xlsx",
    path.resolve(currentDir, "../../templates/INVOICE_FORMAT.xlsx"),
    path.resolve(currentDir, "../templates/INVOICE_FORMAT.xlsx"),
    path.resolve(process.cwd(), "artifacts/api-server/templates/INVOICE_FORMAT.xlsx"),
    path.resolve(process.cwd(), "artifacts/agency-os/public/templates/INVOICE_FORMAT.xlsx"),
    path.resolve(process.cwd(), "dist/public/templates/INVOICE_FORMAT.xlsx"),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p);
    }
  }
  throw new Error("Master invoice template 14_Invoice_Format.xlsx not found on disk");
}

export function generateInvoiceMasterExcel(inv: any): Buffer {
  const masterBuf = getMasterTemplateBuffer();
  const entries = parseZip(masterBuf);

  const sheetEntry = entries.find((e) => e.filename === "xl/worksheets/sheet1.xml");
  if (!sheetEntry) throw new Error("sheet1.xml not found in master template");

  let sheetXml = zlib.inflateRawSync(sheetEntry.compData).toString("utf8");

  const invNumber = inv.number || inv.invoiceNumber || "0003";
  const invDate = (inv.invoiceDate || new Date().toISOString().split("T")[0]).split("T")[0];
  const clientName = inv.clientName || "(name)";
  const clientAddress = [
    inv.billingAddress || inv.clientAddress,
    inv.clientCity,
    inv.clientState,
    inv.clientPostalCode,
  ]
    .filter(Boolean)
    .join(", ") || "(address)";
  const placeOfSupply = inv.placeOfSupply || inv.clientState || "Maharashtra";
  const clientGstin = inv.clientGstin || "27AHQPB7460C1ZE";

  const isIGST =
    inv.gstType === "IGST" ||
    (!clientGstin.startsWith("27") &&
      !placeOfSupply.toLowerCase().includes("maharashtra") &&
      !placeOfSupply.toLowerCase().includes("mh"));

  let rawItems = inv.lineItems;
  if (typeof rawItems === "string") {
    try { rawItems = JSON.parse(rawItems); } catch {}
  }

  const items =
    Array.isArray(rawItems) && rawItems.length > 0
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
  const serialDate = dateToExcelSerial(invDate);

  const dateParts = invDate.split("-").map(Number);
  const monthAbbrs = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formattedMasterDate = (dateParts.length === 3 && dateParts[0] && dateParts[1] && dateParts[2])
    ? `${String(dateParts[2]).padStart(2, "0")}-${monthAbbrs[dateParts[1] - 1]}-${String(dateParts[0]).slice(-2)}`
    : invDate;

  // 1. Invoice Number: B13 & L13
  sheetXml = replaceCell(sheetXml, "B13", "170", "inlineStr", null, `Invoice No:- ${invNumber}`);
  sheetXml = replaceCell(sheetXml, "L13", "170", "str", "B13", `Invoice No:- ${invNumber}`);

  // 2. Date: C14 & M14 (using formatted inlineStr so Excel never overflows to #####)
  sheetXml = replaceCell(sheetXml, "C14", "175", "inlineStr", null, formattedMasterDate);
  sheetXml = replaceCell(sheetXml, "M14", "175", "str", "C14", formattedMasterDate);

  // 3. Client Name: B16, F16, L16, P16
  sheetXml = replaceCell(sheetXml, "B16", "184", "inlineStr", null, clientName);
  sheetXml = replaceCell(sheetXml, "F16", "184", "str", "B16", clientName);
  sheetXml = replaceCell(sheetXml, "L16", "184", "str", "B16", clientName);
  sheetXml = replaceCell(sheetXml, "P16", "187", "str", "L16", clientName);

  // 4. Client Address: B17, F17, L17, P17
  sheetXml = replaceCell(sheetXml, "B17", "189", "inlineStr", null, clientAddress);
  sheetXml = replaceCell(sheetXml, "F17", "189", "str", "B17", clientAddress);
  sheetXml = replaceCell(sheetXml, "L17", "189", "str", "B17", clientAddress);
  sheetXml = replaceCell(sheetXml, "P17", "190", "str", "L17", clientAddress);

  // 5. Place of Supply: B18 & L18
  sheetXml = replaceCell(sheetXml, "B18", "191", "inlineStr", null, `Place of Supply:- ${placeOfSupply}`);
  sheetXml = replaceCell(sheetXml, "L18", "191", "str", "B18", `Place of Supply:- ${placeOfSupply}`);

  // 6. GSTIN: B19 & L19
  sheetXml = replaceCell(sheetXml, "B19", "193", "inlineStr", null, `GSTIN/UIN: ${clientGstin}`);
  sheetXml = replaceCell(sheetXml, "L19", "193", "str", "B19", `GSTIN/UIN: ${clientGstin}`);

  // 7. W3 intra/inter-state formula flag
  sheetXml = replaceCell(
    sheetXml,
    "W3",
    "0",
    null,
    'IF(ISNUMBER(SEARCH("Maharashtra",$B$18)),1,0)',
    isIGST ? "0" : "1"
  );

  // 8. Line Items rows 22..39 (18 slots)
  for (let idx = 0; idx < 18; idx++) {
    const r = 22 + idx;
    if (idx < items.length) {
      const it = items[idx];
      const sac = String(it.hsnSac || "998361");
      const rate = Number(it.taxPercent || 18);
      const amt = Number(
        it.amount != null ? it.amount : Number(it.qty || 1) * Number(it.unitPrice || 0)
      );

      sheetXml = replaceCell(sheetXml, `B${r}`, "204", "n", null, idx + 1);
      sheetXml = replaceCell(sheetXml, `C${r}`, "205", "inlineStr", null, it.description || "");
      sheetXml = replaceCell(sheetXml, `F${r}`, "208", "n", null, sac);
      sheetXml = replaceCell(sheetXml, `H${r}`, "209", "n", null, rate);
      sheetXml = replaceCell(sheetXml, `I${r}`, "210", "n", null, amt);

      sheetXml = replaceCell(sheetXml, `L${r}`, "212", null, `B${r}`, idx + 1);
      sheetXml = replaceCell(sheetXml, `M${r}`, "213", "str", `C${r}`, it.description || "");
      sheetXml = replaceCell(sheetXml, `P${r}`, "214", null, `F${r}`, sac);
      sheetXml = replaceCell(sheetXml, `R${r}`, "215", null, `H${r}`, rate);
      sheetXml = replaceCell(sheetXml, `S${r}`, "216", null, `I${r}`, amt);
    } else {
      sheetXml = replaceCell(sheetXml, `B${r}`, "204", "n", null, "");
      sheetXml = replaceCell(sheetXml, `C${r}`, "205", "n", null, "");
      sheetXml = replaceCell(sheetXml, `F${r}`, "208", "n", null, "");
      sheetXml = replaceCell(sheetXml, `H${r}`, "209", "n", null, "");
      sheetXml = replaceCell(sheetXml, `I${r}`, "210", "n", null, "");

      sheetXml = replaceCell(sheetXml, `L${r}`, "212", null, `B${r}`, "");
      sheetXml = replaceCell(sheetXml, `M${r}`, "213", null, `C${r}`, "");
      sheetXml = replaceCell(sheetXml, `P${r}`, "214", null, `F${r}`, "");
      sheetXml = replaceCell(sheetXml, `R${r}`, "215", null, `H${r}`, "");
      sheetXml = replaceCell(sheetXml, `S${r}`, "216", null, `I${r}`, "");
    }
  }

  // 9. Totals rows 41..46
  sheetXml = replaceCell(sheetXml, "J41", "240", null, "SUM(I22:J39)", subtotal);
  sheetXml = replaceCell(sheetXml, "T41", "240", null, "J41", subtotal);

  sheetXml = replaceCell(sheetXml, "J42", "243", null, "IF($W$3=1,ROUND($W$13/2,2),0)", cgst);
  sheetXml = replaceCell(sheetXml, "T42", "243", null, "J42", cgst);

  sheetXml = replaceCell(sheetXml, "J43", "243", null, "J42", sgst);
  sheetXml = replaceCell(sheetXml, "T43", "243", null, "J43", sgst);

  sheetXml = replaceCell(sheetXml, "J44", "243", null, "IF($W$3=1,0,ROUND($W$13,2))", igst);
  sheetXml = replaceCell(sheetXml, "T44", "243", null, "J44", igst);

  sheetXml = replaceCell(sheetXml, "J45", "247", "n", null, roundOff !== 0 ? roundOff : "");
  sheetXml = replaceCell(sheetXml, "T45", "247", null, "J45", roundOff !== 0 ? roundOff : "");

  sheetXml = replaceCell(sheetXml, "J46", "250", null, "J41+J42+J43+J44+J45", grossAmount);
  sheetXml = replaceXml(sheetXml, "T46", "250", null, "J46", grossAmount);

  // 10. Words
  const d47Formula =
    'IF(W4<=0,"",IF(W5>=1000000000,"(amount too large for words)",IF(W5=0,"Zero",TRIM(X7&X8&X9&X10&X11))&" Rupees"&X12&" Only."))';
  sheetXml = replaceCell(sheetXml, "D47", "252", "str", d47Formula, words);
  sheetXml = replaceCell(sheetXml, "N47", "252", "str", "D47", words);

  // Replace sheet entry with new compressed xml
  const newSheetBuf = Buffer.from(sheetXml, "utf8");
  sheetEntry.uncompSize = newSheetBuf.length;
  sheetEntry.compData = zlib.deflateRawSync(newSheetBuf);
  sheetEntry.compSize = sheetEntry.compData.length;
  sheetEntry.crc = calcCrc32(newSheetBuf);

  return createZip(entries);
}

function replaceXml(
  xml: string,
  cellRef: string,
  styleId: string,
  cellType: "inlineStr" | "str" | "n" | null,
  formula: string | null,
  value: string | number | null
): string {
  return replaceCell(xml, cellRef, styleId, cellType, formula, value);
}
