import { Router } from "express";
import { db } from "@workspace/db";
import { leaveRequests, users } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { createId } from "@paralleldrive/cuid2";

const router = Router();

router.get("/leaves", requireAuth, async (req, res) => {
  try {
    const { userId, status } = req.query as Record<string, string>;
    let conditions = [];
    if (userId) conditions.push(eq(leaveRequests.userId, userId));
    if (status) conditions.push(eq(leaveRequests.status, status as any));

    const allLeaves = await db.select().from(leaveRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`created_at desc`);

    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const userMap: Record<string, string> = {};
    for (const u of allUsers) userMap[u.id] = u.name;

    res.json(allLeaves.map((l) => ({
      ...l,
      userName: userMap[l.userId] ?? null,
      createdAt: l.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/leaves", requireAuth, async (req, res) => {
  try {
    const data = req.body;
    const [leave] = await db.insert(leaveRequests).values({
      id: createId(),
      userId: req.user!.id,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason ?? null,
      status: "PENDING",
    }).returning();
    res.status(201).json({ ...leave, userName: req.user!.name, createdAt: leave.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/leaves/:id/approve", requireAuth, async (req, res) => {
  try {
    const [updated] = await db.update(leaveRequests)
      .set({ status: "APPROVED", reviewedBy: req.user!.id })
      .where(eq(leaveRequests.id, (req.params.id as string)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...updated, userName: null, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/leaves/:id/reject", requireAuth, async (req, res) => {
  try {
    const [updated] = await db.update(leaveRequests)
      .set({ status: "REJECTED", reviewedBy: req.user!.id })
      .where(eq(leaveRequests.id, (req.params.id as string)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...updated, userName: null, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
