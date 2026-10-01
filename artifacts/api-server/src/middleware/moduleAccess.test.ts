import { describe, expect, it } from "vitest";
import {
  canManageModuleSection,
  canManageTaskWorkspace,
  DEFAULT_EMPLOYEE_MODULES,
  getEffectiveModules,
  getModulePermissions,
  parseConfiguredModules,
} from "./moduleAccess";
import { canEmployeeAccessTask } from "./taskAccess";

describe("module access policy", () => {
  it("uses the employee workspace defaults for accounts with no configured modules", () => {
    expect(getEffectiveModules([])).toEqual([...DEFAULT_EMPLOYEE_MODULES]);
    expect(getModulePermissions([])).toEqual(expect.arrayContaining([
      "tasks.view",
      "tasks.create",
      "tasks.edit",
      "attendance.view",
      "leave.view",
      "leave.apply",
      "reports.view",
    ]));
    expect(getModulePermissions([])).not.toContain("invoices.view");
    expect(getModulePermissions([])).not.toContain("projects.view");
  });

  it("keeps every non-root role limited to its configured modules", () => {
    const managerModules = ["reports"];
    expect(getModulePermissions(managerModules)).toContain("reports.view");
    expect(getModulePermissions(managerModules)).not.toContain("invoices.view");
    expect(getModulePermissions(managerModules)).not.toContain("clients.view");
    expect(canManageModuleSection("MANAGER", "finance", managerModules)).toBe(false);
    expect(canManageModuleSection("ADMIN", "finance", managerModules)).toBe(false);
  });

  it("grants finance permissions only when finance is selected (or for the root account)", () => {
    expect(getModulePermissions(["finance"])).toEqual(expect.arrayContaining([
      "invoices.view",
      "quotations.view",
      "proposals.view",
      "purchase_orders.view",
    ]));
    expect(canManageModuleSection("SUPER_ADMIN", "finance", [])).toBe(true);
    expect(canManageModuleSection("MANAGER", "finance", [])).toBe(false);
  });

  it("requires both Projects and Tasks for company-wide task workspace access", () => {
    expect(canManageTaskWorkspace("MANAGER", ["tasks"])).toBe(false);
    expect(canManageTaskWorkspace("MANAGER", [])).toBe(false);
    expect(canManageTaskWorkspace("MANAGER", ["projects", "tasks"])).toBe(true);
    expect(canManageTaskWorkspace("SUPER_ADMIN", [])).toBe(true);
  });

  it("parses legacy module encodings consistently", () => {
    expect(parseConfiguredModules('["tasks","finance"]')).toEqual(["tasks", "finance"]);
    expect(parseConfiguredModules("tasks, finance")).toEqual(["tasks", "finance"]);
  });
});

describe("employee task ownership", () => {
  it("allows an employee to access their own pending request without an assignee", () => {
    expect(canEmployeeAccessTask({
      assigneeId: null,
      requestedBy: "employee-1",
      approvalStatus: "PENDING",
    }, "employee-1")).toBe(true);
  });

  it("does not grant pending-request access to a different requester", () => {
    expect(canEmployeeAccessTask({
      assigneeId: null,
      requestedBy: "employee-1",
      approvalStatus: "PENDING",
    }, "employee-2")).toBe(false);
  });

  it("allows assigned work but does not grant access to another employee's work", () => {
    expect(canEmployeeAccessTask({
      assigneeId: "employee-1",
      requestedBy: "manager",
      approvalStatus: "APPROVED",
    }, "employee-1")).toBe(true);
    expect(canEmployeeAccessTask({
      assigneeId: "employee-1",
      requestedBy: "manager",
      approvalStatus: "APPROVED",
    }, "employee-2")).toBe(false);
  });
});