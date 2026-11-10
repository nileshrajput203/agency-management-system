import fs from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { generateInvoiceMasterHtml } from "./invoiceMasterHtml";

const execFileAsync = promisify(execFile);
const currentDir = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

function getPythonExecutable(): string {
  const candidates = [
    process.env.PLAYWRIGHT_PYTHON,
    "C:\\Users\\USER\\AppData\\Local\\hermes\\hermes-agent\\venv\\Scripts\\python.exe",
    "python",
    "python3",
  ].filter(Boolean) as string[];

  for (const cand of candidates) {
    if (cand.includes(path.sep) && fs.existsSync(cand)) {
      return cand;
    }
  }
  return candidates[0] || "python";
}

function getGeneratePdfScript(): string {
  const candidates = [
    path.resolve(currentDir, "generate_pdf.py"),
    path.resolve(currentDir, "src/lib/generate_pdf.py"),
    path.resolve(currentDir, "../src/lib/generate_pdf.py"),
    path.resolve(process.cwd(), "artifacts/api-server/src/lib/generate_pdf.py"),
    path.resolve(process.cwd(), "dist/generate_pdf.py"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

export async function generateInvoiceMasterPdf(inv: any): Promise<Buffer> {
  const htmlContent = generateInvoiceMasterHtml(inv);
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const tempHtml = path.join(os.tmpdir(), `invoice_${randomSuffix}.html`);
  const tempPdf = path.join(os.tmpdir(), `invoice_${randomSuffix}.pdf`);
  const scriptPath = getGeneratePdfScript();

  try {
    await fs.promises.writeFile(tempHtml, htmlContent, "utf-8");

    const pythonExe = getPythonExecutable();
    await execFileAsync(pythonExe, [scriptPath, tempHtml, tempPdf], {
      timeout: 30000,
      windowsHide: true,
    });

    if (!fs.existsSync(tempPdf)) {
      throw new Error("PDF generator did not produce output file");
    }

    const pdfBuffer = await fs.promises.readFile(tempPdf);
    return pdfBuffer;
  } finally {
    try {
      if (fs.existsSync(tempHtml)) await fs.promises.unlink(tempHtml);
    } catch {}
    try {
      if (fs.existsSync(tempPdf)) await fs.promises.unlink(tempPdf);
    } catch {}
  }
}
