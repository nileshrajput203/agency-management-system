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

  const targetUserId = requesterRole === "EMPLOYEE" ? requesterId : (userId || null);

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

export default router;
