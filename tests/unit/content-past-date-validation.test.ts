import { describe, it, expect } from "vitest";
import { isPastDate, getTodayDateString } from "../../artifacts/agency-os/src/components/content/content-constants";
import { isPastDate as isPastDateBackend } from "../../artifacts/api-server/src/lib/validation";

describe("Content Post Date Validation Rules", () => {
  it("getTodayDateString returns YYYY-MM-DD for today", () => {
    const todayStr = getTodayDateString();
    expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("identifies today's date as NOT in the past (allowed)", () => {
    const todayStr = getTodayDateString();
    expect(isPastDate(todayStr)).toBe(false);
    expect(isPastDateBackend(todayStr)).toBe(false);
  });

  it("identifies future dates as NOT in the past (allowed)", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

    expect(isPastDate(tomorrowStr)).toBe(false);
    expect(isPastDateBackend(tomorrowStr)).toBe(false);

    const nextYearStr = `${tomorrow.getFullYear() + 1}-01-01`;
    expect(isPastDate(nextYearStr)).toBe(false);
    expect(isPastDateBackend(nextYearStr)).toBe(false);
  });

  it("identifies past dates as in the past (rejected)", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    expect(isPastDate(yesterdayStr)).toBe(true);
    expect(isPastDateBackend(yesterdayStr)).toBe(true);

    expect(isPastDate("2020-01-01")).toBe(true);
    expect(isPastDateBackend("2020-01-01")).toBe(true);
  });

  it("handles null, undefined, and empty string safely", () => {
    expect(isPastDate(null)).toBe(false);
    expect(isPastDate(undefined)).toBe(false);
    expect(isPastDate("")).toBe(false);

    expect(isPastDateBackend(null)).toBe(false);
    expect(isPastDateBackend(undefined)).toBe(false);
    expect(isPastDateBackend("")).toBe(false);
  });
});
