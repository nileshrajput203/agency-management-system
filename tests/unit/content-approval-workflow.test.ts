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

  it("blocks regular EMPLOYEE from approving content", () => {
    expect(isManagerOrAdmin("EMPLOYEE", false, "EMPLOYEE")).toBe(false);
    expect(isManagerOrAdminRole({ systemRole: "EMPLOYEE" } as any)).toBe(false);
  });

  it("blocks unauthenticated or empty users", () => {
    expect(isManagerOrAdmin(null, false, "EMPLOYEE")).toBe(false);
    expect(isManagerOrAdminRole(null)).toBe(false);
    expect(isManagerOrAdminRole(undefined)).toBe(false);
  });
});
