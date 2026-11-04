import { Router } from "express";
import { db, timeEntriesTable } from "@workspace/db";
import { eq, and, gte, lte, desc, isNull } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { sanitizeAndValidate, isValidUUID } from "../lib/validation";
import { createError } from "../middleware/errorHandler";
import { requirePermission } from "../middleware/auth";

const router = Router();

// POST /api/time/timer — save a completed time entry from the frontend widget
router.post("/timer", requirePermission("time.log"), asyncHandler(async (req, res) => {
  const { description, projectId, minutes, billable, startedAt, endedAt } =
    req.body as {
      description?: string;
      projectId?: string;
      minutes?: number | string;
      billable?: boolean;
      startedAt?: string;
      endedAt?: string;
    };

  const sanitized = sanitizeAndValidate(
    { description, projectId, minutes, billable, startedAt, endedAt },
    {
      uuids: projectId ? ["projectId"] : [],
      numbers: minutes !== undefined && minutes !== null && minutes !== "" ? ["minutes"] : [],
      dates: startedAt ? ["startedAt"] : [],
    }
  );

  // Validate endedAt separately as a date if provided
  if (endedAt) {
    const d = new Date(endedAt);
    if (isNaN(d.getTime())) {
      throw createError("Invalid date syntax for field: endedAt", 400);
    }
  }

  const userId = (req as any).userId ?? null;

  const [row] = await db
    .insert(timeEntriesTable)
    .values({
      projectId: sanitized.projectId ?? null,
      userId,
      startedAt: sanitized.startedAt ? new Date(sanitized.startedAt) : new Date(),
      endedAt: endedAt ? new Date(endedAt) : new Date(),
      durationMin: sanitized.minutes !== undefined && sanitized.minutes !== null ? Number(sanitized.minutes) : null,
      note: sanitized.description ?? null,
      isBillable: sanitized.billable ?? true,
    })
    .returning();

  return res.status(201).json(row);
}));

// GET /api/time — list entries, optionally filtered
router.get("/", requirePermission("time.view"), asyncHandler(async (req, res) => {
  const { projectId, userId, from, to } = req.query as Record<string, string>;
  const requesterId = (req as any).userId;
  const requesterRole = (req as any).userRole;

  const isEmployeeRole = ["EMPLOYEE", "TEAM_MEMBER", "EXTERNAL"].includes(String(requesterRole || "").toUpperCase());
  const targetUserId = isEmployeeRole ? requesterId : (userId || null);

  const conditions = [isNull(timeEntriesTable.deletedAt)];

  if (projectId) {
    conditions.push(eq(timeEntriesTable.projectId, projectId));
  }
  if (targetUserId) {
    if (!isValidUUID(targetUserId)) {
      throw createError("Invalid userId format", 400);
    }
    conditions.push(eq(timeEntriesTable.userId, targetUserId));
  }
  if (from) {
    const fDate = new Date(from);
    if (!isNaN(fDate.getTime())) {
      conditions.push(gte(timeEntriesTable.startedAt, fDate));
    }
  }
  if (to) {
    const tDate = new Date(to);
    if (!isNaN(tDate.getTime())) {
      conditions.push(lte(timeEntriesTable.startedAt, tDate));
    }
  }

  const rows = await db
    .select()
    .from(timeEntriesTable)
    .where(and(...conditions))
    .orderBy(desc(timeEntriesTable.startedAt))
    .limit(200);

  return res.json(rows);
}));

// GET /api/time/active — get currently running timer for the authenticated user
router.get("/active", requirePermission("time.view"), asyncHandler(async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) return res.json(null);

  const [active] = await db
    .select()
    .from(timeEntriesTable)
    .where(and(eq(timeEntriesTable.userId, userId), isNull(timeEntriesTable.endedAt)))
    .orderBy(desc(timeEntriesTable.startedAt))
    .limit(1);

  return res.json(active || null);
}));

// POST /api/time/start — 1-click start live task timer
router.post("/start", requirePermission("time.log"), asyncHandler(async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) throw createError("Unauthorized", 401);

  const { taskId, projectId, note, billable = true } = req.body || {};

  // Auto-stop any active timer first
  const now = new Date();
  const existingActive = await db
    .select()
    .from(timeEntriesTable)
    .where(and(eq(timeEntriesTable.userId, userId), isNull(timeEntriesTable.endedAt)));

  for (const t of existingActive) {
    const durMin = Math.max(1, Math.round((now.getTime() - new Date(t.startedAt).getTime()) / 60000));
    await db.update(timeEntriesTable).set({
      endedAt: now,
      durationMin: durMin,
    }).where(eq(timeEntriesTable.id, t.id));
  }

  const [created] = await db
    .insert(timeEntriesTable)
    .values({
      userId,
      taskId: taskId || null,
      projectId: projectId || null,
      note: note || "Task work session",
      startedAt: now,
      endedAt: null,
      isBillable: Boolean(billable),
    })
    .returning();

  return res.status(201).json(created);
}));

// POST /api/time/stop — stop active timer and compute duration
router.post("/stop", requirePermission("time.log"), asyncHandler(async (req, res) => {
  const userId = (req as any).userId;
  if (!userId) throw createError("Unauthorized", 401);

  const now = new Date();
  const [active] = await db
    .select()
    .from(timeEntriesTable)
    .where(and(eq(timeEntriesTable.userId, userId), isNull(timeEntriesTable.endedAt)))
    .orderBy(desc(timeEntriesTable.startedAt))
    .limit(1);

  if (!active) {
    return res.json({ message: "No active timer running", stopped: null });
  }

  const durMin = Math.max(1, Math.round((now.getTime() - new Date(active.startedAt).getTime()) / 60000));
  const [stopped] = await db
    .update(timeEntriesTable)
    .set({
      endedAt: now,
      durationMin: durMin,
    })
    .where(eq(timeEntriesTable.id, active.id))
    .returning();

  return res.json({ message: "Timer stopped", stopped });
}));

export default router;
