import { describe, it, expect } from "vitest";
import { isManagerOrAdmin } from "../../artifacts/api-server/src/routes/content";
import { isManagerOrAdminRole } from "../../artifacts/agency-os/src/lib/permissions";

describe("Content Approval Workflow & Permissions", () => {
  it("allows SUPER_ADMIN to approve content", () => {
    expect(isManagerOrAdmin("SUPER_ADMIN", false, "ADMIN")).toBe(true);
    expect(isManagerOrAdminRole({ systemRole: "SUPER_ADMIN" } as any)).toBe(true);
  });

  it("allows MANAGER to approve content", () => {
    expect(isManagerOrAdmin("MANAGER", false, "EMPLOYEE")).toBe(true);
    expect(isManagerOrAdminRole({ systemRole: "MANAGER" } as any)).toBe(true);
  });

  it("allows DELEGATED_ADMIN to approve content", () => {
    expect(isManagerOrAdmin("EMPLOYEE", true, "EMPLOYEE")).toBe(true);
    expect(isManagerOrAdminRole({ isDelegatedAdmin: true } as any)).toBe(true);
  });

  it("allows coordinator, lead, director, and PC roles to approve content", () => {
    expect(isManagerOrAdmin("PRODUCTION_COORDINATOR", false, "EMPLOYEE")).toBe(true);
    expect(isManagerOrAdmin("PROJECT_COORDINATOR", false, "EMPLOYEE")).toBe(true);
    expect(isManagerOrAdmin("PC", false, "EMPLOYEE")).toBe(true);
    expect(isManagerOrAdmin("CONTENT_LEAD", false, "EMPLOYEE")).toBe(true);
    expect(isManagerOrAdmin("CREATIVE_DIRECTOR", false, "EMPLOYEE")).toBe(true);
    expect(isManagerOrAdminRole({ systemRole: "PRODUCTION_COORDINATOR" } as any)).toBe(true);
    expect(isManagerOrAdminRole({ systemRole: "CONTENT_LEAD" } as any)).toBe(true);
  });

  it("blocks regular EMPLOYEE from approving content", () => {
    expect(isManagerOrAdmin("EMPLOYEE", false, "EMPLOYEE")).toBe(false);
    expect(isManagerOrAdmin("DESIGNER", false, "EMPLOYEE")).toBe(false);
    expect(isManagerOrAdmin("VIDEO_EDITOR", false, "EMPLOYEE")).toBe(false);
    expect(isManagerOrAdminRole({ systemRole: "EMPLOYEE" } as any)).toBe(false);
    expect(isManagerOrAdminRole({ systemRole: "DESIGNER" } as any)).toBe(false);
    expect(isManagerOrAdminRole({ systemRole: "VIDEO_EDITOR" } as any)).toBe(false);
  });

  it("blocks unauthenticated or empty users", () => {
    expect(isManagerOrAdmin(null, false, "EMPLOYEE")).toBe(false);
    expect(isManagerOrAdminRole(null)).toBe(false);
    expect(isManagerOrAdminRole(undefined)).toBe(false);
  });
});
