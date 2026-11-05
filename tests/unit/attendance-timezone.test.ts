import { describe, it, expect } from "vitest";
import { parseAgencyDateTime, isManagerOrAdmin } from "../../artifacts/api-server/src/routes/attendance";

describe("Attendance Timezone & RBAC Verification", () => {
  it("should accurately parse IST (UTC+05:30) datetime into an unambiguous Date object", () => {
    const dt = parseAgencyDateTime("2026-11-05", "09:00");
    // 09:00 IST is 03:30 UTC
    expect(dt.toISOString()).toBe("2026-11-05T03:30:00.000Z");

    const cutoff = parseAgencyDateTime("2026-11-05", "11:00");
    // 11:00 IST is 05:30 UTC
    expect(cutoff.toISOString()).toBe("2026-11-05T05:30:00.000Z");

    const workEnd = parseAgencyDateTime("2026-11-05", "18:00");
    // 18:00 IST is 12:30 UTC
    expect(workEnd.toISOString()).toBe("2026-11-05T12:30:00.000Z");
  });

  it("should handle single digit hours and minutes with padStart", () => {
    const dt = parseAgencyDateTime("2026-07-01", "9:5");
    expect(dt.toISOString()).toBe("2026-07-01T03:35:00.000Z");
  });

  it("should grant attendance viewing and management to managers and admins", () => {
    expect(isManagerOrAdmin("SUPER_ADMIN", false, "ADMIN")).toBe(true);
    expect(isManagerOrAdmin("ADMIN", false, "ADMIN")).toBe(true);
    expect(isManagerOrAdmin("MANAGER", false, "EMPLOYEE")).toBe(true);
    expect(isManagerOrAdmin("PROJECT_MANAGER", false, "EMPLOYEE")).toBe(true);
    expect(isManagerOrAdmin("ACCOUNT_MANAGER", false, "EMPLOYEE")).toBe(true);
    expect(isManagerOrAdmin("HR", false, "EMPLOYEE")).toBe(true);
    expect(isManagerOrAdmin("DIRECTOR", false, "EMPLOYEE")).toBe(true);
    expect(isManagerOrAdmin("LEAD", false, "EMPLOYEE")).toBe(true);
    expect(isManagerOrAdmin("TEAM_MEMBER", true, "EMPLOYEE")).toBe(true); // Delegated admin
  });

  it("should deny team members without manager role or delegation from viewing others' records", () => {
    expect(isManagerOrAdmin("TEAM_MEMBER", false, "EMPLOYEE")).toBe(false);
    expect(isManagerOrAdmin("EMPLOYEE", false, "EMPLOYEE")).toBe(false);
    expect(isManagerOrAdmin(null, false, null)).toBe(false);
    expect(isManagerOrAdmin("", false, "")).toBe(false);
  });
});
