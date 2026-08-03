import { describe, it, expect } from "vitest";

const PERMISSION_TO_MODULE: Record<string, string> = {
  "crm.view": "crm",
  "crm.edit": "crm",
  "finance.view": "finance",
  "invoices.view": "invoices",
  "meetings.view": "meetings",
  "attendance.view": "attendance",
  "reports.view": "reports",
};

function hasModuleAccess(allowedModules: string[] | unknown, moduleKey: string): boolean {
  let list: string[] = [];
  if (Array.isArray(allowedModules)) {
    list = allowedModules as string[];
  } else if (typeof allowedModules === "string" && allowedModules) {
    try {
      const parsed = JSON.parse(allowedModules);
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      list = (allowedModules as string).split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return list.includes(moduleKey);
}

describe("Permission Helpers Unit Tests", () => {
  it("should map permissions to modules accurately", () => {
    expect(PERMISSION_TO_MODULE["crm.view"]).toBe("crm");
    expect(PERMISSION_TO_MODULE["invoices.view"]).toBe("invoices");
    expect(PERMISSION_TO_MODULE["meetings.view"]).toBe("meetings");
  });

  it("should check module permissions correctly with array format", () => {
    const modules = ["crm", "finance", "meetings"];
    expect(hasModuleAccess(modules, "crm")).toBe(true);
    expect(hasModuleAccess(modules, "attendance")).toBe(false);
  });

  it("should maintain backward compatibility for string representation", () => {
    const jsonStr = '["crm", "meetings"]';
    expect(hasModuleAccess(jsonStr, "meetings")).toBe(true);
    expect(hasModuleAccess(jsonStr, "finance")).toBe(false);

    const csvStr = "crm, meetings, finance";
    expect(hasModuleAccess(csvStr, "finance")).toBe(true);
    expect(hasModuleAccess(csvStr, "attendance")).toBe(false);
  });

  it("should return false for empty or invalid allowedModules", () => {
    expect(hasModuleAccess(null, "crm")).toBe(false);
    expect(hasModuleAccess(undefined, "crm")).toBe(false);
    expect(hasModuleAccess([], "crm")).toBe(false);
  });
});
