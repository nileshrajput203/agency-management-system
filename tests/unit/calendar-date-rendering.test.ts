import { describe, it, expect } from "vitest";
import { getPostDateKey } from "../../artifacts/agency-os/src/components/content/content-constants";

describe("Content Calendar Date Filtering & Key Generation", () => {
  it("extracts exact YYYY-MM-DD from date strings without timezone shifts", () => {
    expect(getPostDateKey("2026-07-20")).toBe("2026-07-20");
    expect(getPostDateKey("2026-07-20T00:00:00.000Z")).toBe("2026-07-20");
    expect(getPostDateKey("2026-07-20T18:30:00.000Z")).toBe("2026-07-20");
    expect(getPostDateKey("2026-08-20T12:00:00.000Z")).toBe("2026-08-20");
  });

  it("handles Date objects correctly", () => {
    const julyPostDate = new Date("2026-07-20T10:00:00.000Z");
    expect(getPostDateKey(julyPostDate)).toBe("2026-07-20");
  });

  it("returns null for invalid or null dates", () => {
    expect(getPostDateKey(null)).toBeNull();
    expect(getPostDateKey(undefined)).toBeNull();
    expect(getPostDateKey("invalid-date")).toBeNull();
  });

  it("ensures a post scheduled on 20 July 2026 ONLY matches 20 July 2026", () => {
    const postScheduledAt = "2026-07-20T00:00:00.000Z";
    const postDateKey = getPostDateKey(postScheduledAt);

    // July 20, 2026
    const july20Key = "2026-07-20";
    // August 20, 2026
    const august20Key = "2026-08-20";
    // September 20, 2026
    const september20Key = "2026-09-20";
    // July 20, 2027
    const july20NextYearKey = "2027-07-20";

    expect(postDateKey).toBe(july20Key);
    expect(postDateKey === july20Key).toBe(true);
    expect(postDateKey === august20Key).toBe(false);
    expect(postDateKey === september20Key).toBe(false);
    expect(postDateKey === july20NextYearKey).toBe(false);
  });

  it("simulates postsByDay grouping and ensures no cross-month leakage", () => {
    const samplePosts = [
      { id: "p1", title: "July Reel", scheduledAt: "2026-07-20T10:00:00.000Z" },
      { id: "p2", title: "August Story", scheduledAt: "2026-08-20T14:00:00.000Z" },
      { id: "p3", title: "July Carousel", scheduledAt: "2026-07-20T16:00:00.000Z" },
    ];

    const postsByDay: Record<string, typeof samplePosts> = {};
    samplePosts.forEach((post) => {
      const key = getPostDateKey(post.scheduledAt);
      if (key) {
        if (!postsByDay[key]) postsByDay[key] = [];
        postsByDay[key]!.push(post);
      }
    });

    // Verify 2026-07-20 has p1 and p3
    expect(postsByDay["2026-07-20"]).toHaveLength(2);
    expect(postsByDay["2026-07-20"]?.map((p) => p.id)).toEqual(["p1", "p3"]);

    // Verify 2026-08-20 has p2 only
    expect(postsByDay["2026-08-20"]).toHaveLength(1);
    expect(postsByDay["2026-08-20"]?.[0]?.id).toBe("p2");

    // Verify September 20, 2026 is completely empty
    expect(postsByDay["2026-09-20"]).toBeUndefined();
  });
});
