import { Router } from "express";
import { db } from "@workspace/db";
import { attendance, users } from "@workspace/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { createId } from "@paralleldrive/cuid2";

const router = Router();

router.get("/attendance", requireAuth, async (req, res) => {
  try {
    const { userId, month } = req.query as Record<string, string>;
    let conditions = [];
    if (userId) conditions.push(eq(attendance.userId, userId));
    if (month) {
      const [year, mo] = month.split("-").map(Number);
      const start = new Date(year, mo - 1, 1).toISOString().slice(0, 10);
      const end = new Date(year, mo, 0).toISOString().slice(0, 10);
      conditions.push(sql`date >= ${start} AND date <= ${end}`);
    }

    const records = await db.select().from(attendance)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`check_in_at desc`);

    const allUsers = await db.select({ id: users.id, name: users.name }).from(users);
    const userMap: Record<string, string> = {};
    for (const u of allUsers) userMap[u.id] = u.name;

    res.json(records.map((r) => ({
      ...r,
      userName: userMap[r.userId] ?? null,
      checkInAt: r.checkInAt.toISOString(),
      checkOutAt: r.checkOutAt?.toISOString() ?? null,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/attendance/check-in", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const today = new Date().toISOString().slice(0, 10);

    const existing = await db.query.attendance.findFirst({
      where: and(eq(attendance.userId, userId), eq(attendance.date, today)),
    });

    if (existing) {
      res.status(400).json({ error: "Already checked in today" });
      return;
    }

    const now = new Date();
    const workStart = new Date();
    workStart.setHours(9, 0, 0, 0);
    const isLate = now > workStart;

    const [record] = await db.insert(attendance).values({
      id: createId(),
      userId,
      checkInAt: now,
      isLate,
      date: today,
    }).returning();

    res.json({ ...record, userName: req.user!.name, checkInAt: record.checkInAt.toISOString(), checkOutAt: null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/attendance/check-out", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const today = new Date().toISOString().slice(0, 10);

    const existing = await db.query.attendance.findFirst({
      where: and(eq(attendance.userId, userId), eq(attendance.date, today)),
    });

    if (!existing) {
      res.status(400).json({ error: "No check-in found for today" });
      return;
    }

    if (existing.checkOutAt) {
      res.status(400).json({ error: "Already checked out" });
      return;
    }

    const now = new Date();
    const workEnd = new Date();
    workEnd.setHours(18, 0, 0, 0);
    const overtimeMin = Math.max(0, Math.floor((now.getTime() - workEnd.getTime()) / 60000));

    const [updated] = await db.update(attendance)
      .set({ checkOutAt: now, overtimeMin })
      .where(eq(attendance.id, existing.id))
      .returning();

    res.json({ ...updated, userName: req.user!.name, checkInAt: updated.checkInAt.toISOString(), checkOutAt: updated.checkOutAt?.toISOString() ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/attendance/today", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const today = new Date().toISOString().slice(0, 10);

    const record = await db.query.attendance.findFirst({
      where: and(eq(attendance.userId, userId), eq(attendance.date, today)),
    });

    res.json({
      checkedIn: !!record,
      checkInAt: record?.checkInAt?.toISOString() ?? null,
      checkOutAt: record?.checkOutAt?.toISOString() ?? null,
      attendanceId: record?.id ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
