import { describe, it, expect } from "vitest";
import { db } from "../../lib/db/src";
import { usersTable, notifications } from "../../lib/db/src/schema";
import { eq } from "drizzle-orm";

describe("Database CRUD & Mock DB Tests", () => {
  it("should query existing users from database or mock fallback", async () => {
    const allUsers = await db.select().from(usersTable);
    expect(Array.isArray(allUsers)).toBe(true);
    expect(allUsers.length).toBeGreaterThan(0);

    const firstUser = allUsers[0];
    expect(firstUser).toHaveProperty("id");
    expect(firstUser).toHaveProperty("email");
  });

  it("should perform insert, select, and delete operations on database", async () => {
    const testId = `test-notification-${Date.now()}`;
    const allUsers = await db.select().from(usersTable);
    const userId = allUsers[0]?.id || "admin";

    // Insert
    await db.insert(notifications).values({
      id: testId,
      userId,
      title: "Test Notification",
      message: "Testing database CRUD operation",
      type: "SYSTEM",
      isRead: false,
    });

    // Query
    const fetched = await db.select().from(notifications).where(eq(notifications.id, testId));
    expect(fetched.length).toBe(1);
    expect(fetched[0].title).toBe("Test Notification");

    // Delete
    await db.delete(notifications).where(eq(notifications.id, testId));

    // Verify deletion
    const reFetched = await db.select().from(notifications).where(eq(notifications.id, testId));
    expect(reFetched.length).toBe(0);
  });
});
