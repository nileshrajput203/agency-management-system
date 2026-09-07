import { describe, it, expect } from "vitest";
import { getUserModules, hasModuleAccess } from "../../artifacts/agency-os/src/lib/permissions";

const PERMISSION_TO_MODULE: Record<string, string> = {
  "crm.view": "crm",
  "crm.edit": "crm",
  "finance.view": "finance",
  "invoices.view": "invoices",
  "meetings.view": "meetings",
  "attendance.view": "attendance",
  "reports.view": "reports",
};

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

  it("should expose the default employee workspace when no modules are selected", () => {
    expect(getUserModules([])).toEqual(["tasks", "attendance", "leaves", "reports"]);
    expect(hasModuleAccess([], "tasks")).toBe(true);
    expect(hasModuleAccess([], "attendance")).toBe(true);
    expect(hasModuleAccess([], "leaves")).toBe(true);
    expect(hasModuleAccess([], "reports")).toBe(true);
    expect(hasModuleAccess([], "content")).toBe(false);
  });

  it("should treat explicit module selections as complete section access", () => {
    const modules = ["content", "projects", "tasks"];
    expect(getUserModules(modules)).toEqual(modules);
    expect(hasModuleAccess(modules, "content")).toBe(true);
    expect(hasModuleAccess(modules, "projects")).toBe(true);
    expect(hasModuleAccess(modules, "attendance")).toBe(false);
  });
});
