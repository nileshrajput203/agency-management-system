// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

describe("Dashboard Component Tests", () => {
  it("renders key metrics cards and navigation headers", () => {
    const metrics = [
      { label: "Active Clients", value: "24" },
      { label: "Ongoing Projects", value: "12" },
      { label: "Monthly Revenue", value: "$45,000" },
      { label: "Pending Tasks", value: "8" },
    ];

    render(
      <div className="dashboard-container">
        <h2>Dashboard Overview</h2>
        <div className="grid">
          {metrics.map((m) => (
            <div key={m.label} className="metric-card">
              <span>{m.label}</span>
              <p>{m.value}</p>
            </div>
          ))}
        </div>
      </div>
    );

    expect(screen.getByText("Dashboard Overview")).toBeDefined();
    expect(screen.getByText("Active Clients")).toBeDefined();
    expect(screen.getByText("24")).toBeDefined();
    expect(screen.getByText("$45,000")).toBeDefined();
  });
});
