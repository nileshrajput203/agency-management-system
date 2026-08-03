import { describe, it, expect } from "vitest";

interface LineItem {
  qty: number;
  unitPrice: number;
  taxPercent?: number;
  discount?: number;
}

function calculateInvoiceTotals(items: LineItem[]) {
  let subtotal = 0;
  let totalTax = 0;
  let totalDiscount = 0;

  for (const item of items) {
    const qty = Number(item.qty) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const taxPercent = Number(item.taxPercent) || 0;
    const discount = Number(item.discount) || 0;

    const lineSubtotal = qty * unitPrice;
    const lineDiscount = lineSubtotal * (discount / 100);
    const taxableAmount = lineSubtotal - lineDiscount;
    const lineTax = taxableAmount * (taxPercent / 100);

    subtotal += lineSubtotal;
    totalDiscount += lineDiscount;
    totalTax += lineTax;
  }

  const grandTotal = subtotal - totalDiscount + totalTax;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    totalTax: Math.round(totalTax * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
  };
}

describe("Finance Calculations Unit Tests", () => {
  it("should calculate simple totals with 0 tax and discount", () => {
    const items: LineItem[] = [
      { qty: 2, unitPrice: 100 },
      { qty: 1, unitPrice: 50 },
    ];
    const totals = calculateInvoiceTotals(items);
    expect(totals.subtotal).toBe(250);
    expect(totals.totalTax).toBe(0);
    expect(totals.totalDiscount).toBe(0);
    expect(totals.grandTotal).toBe(250);
  });

  it("should calculate totals with tax and discount percentages", () => {
    const items: LineItem[] = [
      { qty: 1, unitPrice: 100, taxPercent: 10, discount: 10 }, // subtotal 100, discount 10, taxable 90, tax 9 => total 99
    ];
    const totals = calculateInvoiceTotals(items);
    expect(totals.subtotal).toBe(100);
    expect(totals.totalDiscount).toBe(10);
    expect(totals.totalTax).toBe(9);
    expect(totals.grandTotal).toBe(99);
  });

  it("should handle empty line items gracefully", () => {
    const totals = calculateInvoiceTotals([]);
    expect(totals.subtotal).toBe(0);
    expect(totals.grandTotal).toBe(0);
  });
});
