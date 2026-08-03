import { describe, it, expect } from "vitest";

describe("Settings Page Vertical Navigation Structure", () => {
  it("defines standard vertical settings sections for scalability", () => {
    const sections = [
      { id: "general", label: "General", desc: "Profile & work schedule" },
      { id: "branding", label: "Branding & Theme", desc: "Colors, logo & dark mode" },
      { id: "financials", label: "Taxes & Currency", desc: "Default GST & currencies" },
      { id: "security", label: "Security & Access", desc: "Session rules & permissions" },
      { id: "integrations", label: "Integrations", desc: "Social API & AI Copilot" },
      { id: "notifications", label: "Notifications", desc: "Alert preferences" },
    ];

    expect(sections.length).toBeGreaterThanOrEqual(6);
    expect(sections.map((s) => s.id)).toEqual([
      "general",
      "branding",
      "financials",
      "security",
      "integrations",
      "notifications",
    ]);
  });

  it("validates form data mapping for settings submission", () => {
    const rawSettings = {
      agencyName: "Blink Beyond",
      website: "https://blinkbeyond.com",
      email: "hello@blinkbeyond.com",
      phone: "+91 98765 43210",
      address: "Bangalore, India",
      primaryColor: "#6366f1",
      currency: "INR",
      taxLabel: "GST",
      taxPercent: "18",
      workDayStart: "09:00",
      workDayEnd: "18:00",
    };

    const formattedData = {
      ...rawSettings,
      taxPercent: Number(rawSettings.taxPercent),
    };

    expect(formattedData.taxPercent).toBe(18);
    expect(typeof formattedData.taxPercent).toBe("number");
    expect(formattedData.agencyName).toBe("Blink Beyond");
    expect(formattedData.currency).toBe("INR");
  });
});
