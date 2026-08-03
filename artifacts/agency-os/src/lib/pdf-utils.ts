/**
 * PDF / Print Helper Utilities
 */

export function esc(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function sanitizeRichHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?>/gi, "")
    .replace(/\bon\w+\s*=/gi, "data-removed=")
    .replace(/href\s*=\s*["']?\s*javascript:[^"'>]*/gi, 'href="#"');
}

const CURRENCY_SYM: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
export const sym = (c?: string | null) => CURRENCY_SYM[c ?? "INR"] ?? "₹";

export const fmt = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ONES = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
  "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
const TENS = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

function twoDigit(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  return (TENS[Math.floor(n/10)] + (n%10 ? " "+ONES[n%10] : "")).trim();
}

function threeDigit(n: number): string {
  if (n < 100) return twoDigit(n);
  return ONES[Math.floor(n/100)] + " Hundred" + (n%100 ? " "+twoDigit(n%100) : "");
}

function numberToWords(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10000000);
  const lakh  = Math.floor((n % 10000000) / 100000);
  const thou  = Math.floor((n % 100000) / 1000);
  const rem   = n % 1000;
  let r = "";
  if (crore) r += twoDigit(crore) + " Crore ";
  if (lakh)  r += twoDigit(lakh)  + " Lakh ";
  if (thou)  r += twoDigit(thou)  + " Thousand ";
  if (rem)   r += threeDigit(rem);
  return r.trim();
}

export function amountToWords(amount: number, currency = "INR"): string {
  const unit = currency === "INR" ? "Rupee" : "Dollar";
  const sub  = currency === "INR" ? "Paise" : "Cent";

  const rounded = Math.round(amount * 100);
  const rupees  = Math.floor(rounded / 100);
  const paise   = rounded % 100;

  let r = numberToWords(rupees) + " " + unit + (rupees !== 1 ? "s" : "");
  if (paise > 0) r += " And " + numberToWords(paise) + " " + sub;
  return r + " Only";
}
