// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

describe("Invoice Form & Table Component Tests", () => {
  it("renders invoice table and line items summary", () => {
    const lineItems = [
      { description: "UI/UX Design", qty: 2, unitPrice: 1500, total: 3000 },
      { description: "Frontend Development", qty: 1, unitPrice: 2500, total: 2500 },
    ];

    const grandTotal = lineItems.reduce((acc, curr) => acc + curr.total, 0);

    render(
      <div className="invoice-view">
        <h2>Invoice #INV-2026-001</h2>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, idx) => (
              <tr key={idx}>
                <td>{item.description}</td>
                <td>{item.qty}</td>
                <td>${item.unitPrice}</td>
                <td>${item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="summary">
          <strong>Grand Total: ${grandTotal}</strong>
        </div>
      </div>
    );

    expect(screen.getByText("Invoice #INV-2026-001")).toBeDefined();
    expect(screen.getByText("UI/UX Design")).toBeDefined();
    expect(screen.getByText("Frontend Development")).toBeDefined();
    expect(screen.getByText("Grand Total: $5500")).toBeDefined();
  });
});
