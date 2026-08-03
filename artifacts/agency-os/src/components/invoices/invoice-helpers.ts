const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigit(n: number) {
  if (n < 20) return ONES[n] ?? "";
  return (TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "")).trim();
}

function threeDigit(n: number) {
  if (n < 100) return twoDigit(n);
  return ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + twoDigit(n % 100) : "");
}

export function numberToWords(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thou = Math.floor((n % 100000) / 1000);
  const rem = n % 1000;
  let r = "";
  if (crore) r += twoDigit(crore) + " Crore ";
  if (lakh) r += twoDigit(lakh) + " Lakh ";
  if (thou) r += twoDigit(thou) + " Thousand ";
  if (rem) r += threeDigit(rem);
  return r.trim();
}

export function amountToWords(amount: number, currency = "INR") {
  const unit = currency === "INR" ? "Rupee" : "Dollar";
  const sub = currency === "INR" ? "Paise" : "Cent";
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let r = numberToWords(rupees) + " " + unit + (rupees !== 1 ? "s" : "");
  if (paise > 0) r += " And " + numberToWords(paise) + " " + sub;
  return r + " Only";
}

export const CURRENCY_SYMBOL: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
export const sym = (c: string) => CURRENCY_SYMBOL[c] ?? c;

export const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  DRAFT: { label: "Draft", variant: "secondary", className: "" },
  SENT: { label: "Sent", variant: "outline", className: "border-blue-300 text-blue-700" },
  VIEWED: { label: "Viewed", variant: "outline", className: "border-indigo-300 text-indigo-700" },
  PAID: { label: "Paid", variant: "default", className: "bg-emerald-600 border-emerald-600" },
  OVERDUE: { label: "Overdue", variant: "destructive", className: "" },
  CANCELLED: { label: "Cancelled", variant: "secondary", className: "line-through opacity-60" },
};

export function getToken() {
  return typeof window !== "undefined" ? localStorage.getItem("agency_token") : null;
}

export function authHeaders(json = false) {
  const h: Record<string, string> = { Authorization: `Bearer ${getToken()}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export interface LineItem { description: string; hsnSac: string; taxPercent: number; qty: number; unitPrice: number; }

export interface BuilderForm {
  invoiceNumber: string; invoiceDate: string; dueDate: string;
  currency: string; gstType: string;
  logoUrl: string;
  businessName: string; businessPhone: string; businessGstin: string;
  businessAddress: string; businessCity: string; businessPostalCode: string; businessState: string;
  businessEmail: string; businessPan: string;
  clientId: string; clientPhone: string; clientGstin: string;
  clientAddress: string; clientCity: string; clientPostalCode: string; clientState: string;
  clientEmail: string; clientPan: string;
  lineItems: LineItem[];
  discount: number; discountType: string;
  bankName: string; bankAccountName: string; bankAccount: string; bankIfsc: string;
  signatureUrl: string;
  termsAndConditions: string; notes: string;
}
