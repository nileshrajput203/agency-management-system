import { Router } from "express";
import { db } from "@workspace/db";
import {
  leaveRequestsTable as leaveRequests,
  usersTable as users,
  leaveBalancesTable,
  attendanceTable,
  holidaysTable as holidays,
} from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requirePermission } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate, isValidUUID } from "../lib/validation";
import { NotificationService } from "../services/notificationService";
import { notificationLogger, logger } from "../lib/logger";

const router = Router();

function getDateRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return [startStr];
  }
  const curr = new Date(start);
  while (curr <= end) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, "0");
    const dd = String(curr.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
    curr.setDate(curr.getDate() + 1);
  }
  return dates.length > 0 ? dates : [startStr];
}

router.get("/leaves", requirePermission("leave.view"), asyncHandler(async (req, res) => {
  const { userId, status } = req.query as Record<string, string>;
  const requesterId = (req as any).userId;
  const requesterRole = (req as any).userRole;

  const isEmployee = ["EMPLOYEE", "TEAM_MEMBER", "EXTERNAL"].includes(String(requesterRole || "").toUpperCase());
  const conditions = [];
  if (isEmployee) {
    conditions.push(eq(leaveRequests.userId, requesterId));
  } else if (userId) {
    if (!isValidUUID(userId)) {
      throw createError("Invalid userId format", 400);
    }
    conditions.push(eq(leaveRequests.userId, userId));
  }
  if (status) conditions.push(eq(leaveRequests.status, status as any));

  const [allLeaves, allUsers] = await Promise.all([
    db.select().from(leaveRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`created_at desc`),
    db.select({ id: users.id, name: users.name }).from(users),
  ]);

  const userMap = new Map(allUsers.map((u) => [u.id, u.name]));
  return res.json(
    allLeaves.map((l) => ({
      ...l,
      userName: userMap.get(l.userId) ?? "Unknown",
      createdAt: l.createdAt?.toISOString() ?? null,
    }))
  );
}));

router.post("/leaves", requirePermission("leave.apply"), asyncHandler(async (req, res) => {
  const { type, startDate, endDate, reason } = req.body as {
    type?: string;
    startDate?: string;
    endDate?: string;
    reason?: string;
  };
  const sanitized = sanitizeAndValidate(
    { type, startDate, endDate, reason },
    {
      enums: { type: ["CASUAL", "SICK", "EARNED", "UNPAID"] },
      textDates: ["startDate", "endDate"],
    }
  );

  const userId = (req as any).userId;
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw createError("User not found", 404);

  const [leave] = await db.insert(leaveRequests).values({
    userId,
    type: sanitized.type as any,
    startDate: sanitized.startDate,
    endDate: sanitized.endDate,
    reason: sanitized.reason ?? null,
  }).returning();

  // Notify admins and managers
  try {
    await NotificationService.notifyAdminsAndManagers({
      title: "📋 New Leave Request",
      message: `${user.name} submitted a ${sanitized.type} leave request (${sanitized.startDate} to ${sanitized.endDate}).`,
      type: "LEAVE",
      priority: "HIGH",
      referenceId: leave.id,
      referenceType: "LEAVE",
      createdBy: userId,
      action: "Review Leave",
      actionUrl: "/leaves",
    }, userId);
  } catch (e) {
    notificationLogger.warn({ err: e }, "Failed to send notifications for leave request");
  }

  return res.status(201).json({ ...leave, userName: user.name, createdAt: leave.createdAt?.toISOString() ?? null });
}));

router.post("/leaves/:id/approve", requirePermission("leave.approve"), asyncHandler(async (req, res) => {
  if (!isValidUUID(req.params.id as string)) {
    throw createError("Invalid leave request ID format", 400);
  }
  const userId = (req as any).userId;
  const [updated] = await db.update(leaveRequests)
    .set({ status: "APPROVED", reviewedBy: userId })
    .where(eq(leaveRequests.id, (req.params.id as string)))
    .returning();
  if (!updated) throw createError("Not found", 404);

  const allDays = getDateRange(updated.startDate, updated.endDate);
  
  // Exclude Sundays and declared holidays from deducted leave count
  let holidaySet = new Set<string>();
  try {
    const holidayRows = await db.select({ date: holidays.date }).from(holidays);
    holidaySet = new Set(holidayRows.map(h => h.date));
  } catch (_) {}

  const workingDays = allDays.filter((dStr) => {
    const d = new Date(dStr + "T00:00:00");
    if (d.getDay() === 0) return false; // Sunday
    if (holidaySet.has(dStr)) return false; // Declared Company/National Holiday
    return true;
  });

  const numDays = workingDays.length > 0 ? workingDays.length : allDays.length;
  const startYear = parseInt(updated.startDate.slice(0, 4), 10) || new Date().getFullYear();

  // 1. Update/Upsert leave balances
  try {
    const [existingBal] = await db
      .select()
      .from(leaveBalancesTable)
      .where(and(eq(leaveBalancesTable.userId, updated.userId), eq(leaveBalancesTable.year, startYear)))
      .limit(1);

    const typeKey =
      updated.type === "CASUAL"
        ? "casualUsed"
        : updated.type === "SICK"
        ? "sickUsed"
        : updated.type === "EARNED"
        ? "earnedUsed"
        : null;

    if (existingBal) {
      if (typeKey) {
        await db
          .update(leaveBalancesTable)
          .set({
            [typeKey]: (Number(existingBal[typeKey]) || 0) + numDays,
            updatedAt: new Date(),
          })
          .where(eq(leaveBalancesTable.id, existingBal.id));
      }
    } else {
      await db.insert(leaveBalancesTable).values({
        id: crypto.randomUUID(),
        userId: updated.userId,
        year: startYear,
        casualTotal: 12,
        casualUsed: typeKey === "casualUsed" ? numDays : 0,
        sickTotal: 6,
        sickUsed: typeKey === "sickUsed" ? numDays : 0,
        earnedTotal: 15,
        earnedUsed: typeKey === "earnedUsed" ? numDays : 0,
        updatedAt: new Date(),
      });
    }
  } catch (err) {
    logger.warn({ err }, "Error updating leave balance for approved leave");
  }

  // 2. Mark attendance as ON_LEAVE for all days in range
  try {
    for (const dStr of (workingDays.length > 0 ? workingDays : allDays)) {
      const [existingAtt] = await db
        .select()
        .from(attendanceTable)
        .where(and(eq(attendanceTable.userId, updated.userId), eq(attendanceTable.date, dStr)))
        .limit(1);

      if (existingAtt) {
        await db
          .update(attendanceTable)
          .set({ status: "ON_LEAVE" })
          .where(eq(attendanceTable.id, existingAtt.id));
      } else {
        await db.insert(attendanceTable).values({
          id: crypto.randomUUID(),
          userId: updated.userId,
          date: dStr,
          status: "ON_LEAVE",
        });
      }
    }
  } catch (err) {
    logger.warn({ err }, "Error updating attendance for approved leave");
  }

  // Notify employee
  try {
    if (updated.userId !== userId) {
      await NotificationService.createNotification({
        userId: updated.userId,
        title: "✅ Leave Request Approved",
        message: `Your ${updated.type} leave request (${updated.startDate} to ${updated.endDate}) was APPROVED.`,
        type: "LEAVE",
        priority: "HIGH",
        referenceId: updated.id,
        referenceType: "LEAVE",
        createdBy: userId,
      });
    }
  } catch (e) {
    notificationLogger.warn({ err: e }, "Failed to notify user on leave approval");
  }

  return res.json({ ...updated, createdAt: updated.createdAt?.toISOString() ?? null });
}));

router.post("/leaves/:id/reject", requirePermission("leave.approve"), asyncHandler(async (req, res) => {
  if (!isValidUUID(req.params.id as string)) {
    throw createError("Invalid leave request ID format", 400);
  }
  const userId = (req as any).userId;
  const [updated] = await db.update(leaveRequests)
    .set({ status: "REJECTED", reviewedBy: userId })
    .where(eq(leaveRequests.id, (req.params.id as string)))
    .returning();
  if (!updated) throw createError("Not found", 404);

  // Notify employee
  try {
    if (updated.userId !== userId) {
      await NotificationService.createNotification({
        userId: updated.userId,
        title: "❌ Leave Request Rejected",
        message: `Your ${updated.type} leave request (${updated.startDate} to ${updated.endDate}) was REJECTED.`,
        type: "LEAVE",
        priority: "HIGH",
        referenceId: updated.id,
        referenceType: "LEAVE",
        createdBy: userId,
      });
    }
  } catch (e) {
    notificationLogger.warn({ err: e }, "Failed to notify user on leave rejection");
  }

  return res.json({ ...updated, createdAt: updated.createdAt?.toISOString() ?? null });
}));

// GET /api/leaves/balance?userId=&year=
router.get("/leaves/balance", requirePermission("leave.view"), asyncHandler(async (req, res) => {
  const { userId, year } = req.query as Record<string, string>;
  const requesterId = (req as any).userId;
  const requesterRole = (req as any).userRole;
  
  if (year) {
    const parsedYear = parseInt(year, 10);
    if (isNaN(parsedYear) || !Number.isFinite(parsedYear)) {
      throw createError("Invalid year format", 400);
    }
  }
  const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
  const targetUserId = requesterRole === "EMPLOYEE" ? requesterId : (userId || requesterId);
  if (!targetUserId) throw createError("userId is required", 400);
  if (!isValidUUID(targetUserId)) {
    throw createError("Invalid userId format", 400);
  }

  const [bal] = await db
    .select()
    .from(leaveBalancesTable)
    .where(and(eq(leaveBalancesTable.userId, targetUserId), eq(leaveBalancesTable.year, targetYear)))
    .limit(1);

  if (!bal) {
    // Return default balance if no row exists yet
    return res.json({
      userId: targetUserId,
      year: targetYear,
      casualTotal: 12,
      casualUsed: 0,
      sickTotal: 6,
      sickUsed: 0,
      earnedTotal: 15,
      earnedUsed: 0,
    });
  }
  return res.json(bal);
}));

export default router;
