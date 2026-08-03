export const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT:    { label: "Draft",    className: "bg-slate-100 text-slate-600" },
  SENT:     { label: "Sent",     className: "bg-blue-100 text-blue-700" },
  APPROVED: { label: "Approved", className: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Rejected", className: "bg-red-100 text-red-700" },
  EXPIRED:  { label: "Expired",  className: "bg-amber-100 text-amber-700" },
};

export const GST_RATES = [0, 5, 12, 18, 28];
export const CURRENCY_SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

export interface QuotationLineItem {
  itemName: string;
  description?: string;
  hsnSac?: string;
  taxPercent: number;
  qty: number;
  unitPrice: number;
}

export interface QuotationFormValues {
  number: string;
  title: string;
  currency: string;
  clientId: string;
  clientPhone: string;
  clientEmail: string;
  clientGstin: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientPostalCode: string;
  businessName: string;
  businessPhone: string;
  businessEmail: string;
  businessGstin: string;
  businessAddress: string;
  businessCity: string;
  businessState: string;
  businessPostalCode: string;
  lineItems: QuotationLineItem[];
  discount: number;
  discountType: "AMOUNT" | "PERCENT";
  validUntil: string;
  notes: string;
  termsAndConditions: string;
  signatureText: string;
}

export type QuotationRow = {
  id: string;
  number?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  status?: string | null;
  total?: number | null;
  validUntil?: string | null;
  createdAt?: string | null;
};

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function numToWords(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  if (n < 100) return `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}`.trim();
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred ${numToWords(n % 100)}`.trim();
  if (n < 100000) return `${numToWords(Math.floor(n / 1000))} thousand ${numToWords(n % 1000)}`.trim();
  if (n < 10000000) return `${numToWords(Math.floor(n / 100000))} lakh ${numToWords(n % 100000)}`.trim();
  return `${numToWords(Math.floor(n / 10000000))} crore ${numToWords(n % 10000000)}`.trim();
}

export function numberToWords(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded <= 0) return "zero rupees";
  return `${numToWords(rounded)} rupees only`;
}
