import { Router } from "express";
import { db } from "@workspace/db";
import {
  attendanceTable,
  projectsTable,
  tasksTable,
  timeEntriesTable,
  usersTable,
  workReportsTable,
} from "@workspace/db/schema";
import { and, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { requirePermission } from "../middleware/auth";
import { createError } from "../middleware/errorHandler";

const router = Router();

/**
 * GET /api/performance/monthly?month=YYYY-MM
 * Returns per-employee performance metrics for the given calendar month.
 * Falls back to the current month if no param supplied.
 */
router.get("/monthly", requirePermission("reports.view"), asyncHandler(async (req, res) => {
  const monthParam = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
    throw createError("month must use YYYY-MM format", 400);
  }
  const [year, month] = monthParam.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const monthStart = `${monthParam}-01`;
  const nextMonth = `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const monthLastDay = new Date(end.getTime() - 1).toISOString().slice(0, 10);
  const configuredModules: string[] = (req as any).userConfiguredModules ?? [];
  const canViewAllReports =
    (req as any).userSystemRole === "SUPER_ADMIN" || configuredModules.includes("reports");
  const canViewProjects =
    (req as any).userSystemRole === "SUPER_ADMIN" || configuredModules.includes("projects");
  const employeeFilters = [or(eq(usersTable.isActive, true), isNull(usersTable.isActive))!];
  if (!canViewAllReports) employeeFilters.push(eq(usersTable.id, (req as any).userId));
  const employeeRows = await db.select({
    id: usersTable.id,
    name: usersTable.name,
  }).from(usersTable).where(and(...employeeFilters));
  const employeeIds = employeeRows.map((employee) => employee.id);
  const byEmployee = new Map(employeeRows.map((employee) => [employee.id, {
    employeeId: employee.id,
    employeeName: employee.name || "Unknown",
    totalAssigned: 0,
    completed: 0,
    completedOnTime: 0,
    delayed: 0,
    inProgress: 0,
    overdue: 0,
    todo: 0,
    tasks: [] as Array<{
      id: string;
      title: string;
      status: string;
      priority: string | null;
      dueDate: string | null;
      projectName: string | null;
      isOverdue: boolean;
      isDelayed: boolean;
    }>,
    attendance: {
      records: 0,
      presentDays: 0,
      halfDays: 0,
      absentDays: 0,
      leaveDays: 0,
      lateDays: 0,
      overtimeMinutes: 0,
      attendanceRate: null as number | null,
    },
    workReports: {
      total: 0,
      submitted: 0,
      approved: 0,
    },
    trackedMinutes: 0,
  }]));

  if (employeeIds.length > 0) {
    const [taskRows, attendanceRows, timeRows, reportRows] = await Promise.all([
      db.select({
        employeeId: tasksTable.assigneeId,
        taskId: tasksTable.id,
        title: tasksTable.title,
        status: tasksTable.status,
        priority: tasksTable.priority,
        dueDate: tasksTable.dueDate,
        projectName: projectsTable.name,
        createdAt: tasksTable.createdAt,
        updatedAt: tasksTable.updatedAt,
      })
        .from(tasksTable)
        .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
        .where(and(
          isNull(tasksTable.deletedAt),
          inArray(tasksTable.assigneeId, employeeIds),
          or(
            and(gte(tasksTable.dueDate, start), lt(tasksTable.dueDate, end)),
            and(gte(tasksTable.createdAt, start), lt(tasksTable.createdAt, end)),
            and(gte(tasksTable.updatedAt, start), lt(tasksTable.updatedAt, end)),
          ),
        )),
      db.select({
        userId: attendanceTable.userId,
        status: attendanceTable.status,
        isLate: attendanceTable.isLate,
        overtimeMin: attendanceTable.overtimeMin,
      }).from(attendanceTable).where(and(
        inArray(attendanceTable.userId, employeeIds),
        gte(attendanceTable.date, monthStart),
        lt(attendanceTable.date, nextMonth),
      )),
      db.select({
        userId: timeEntriesTable.userId,
        startedAt: timeEntriesTable.startedAt,
        endedAt: timeEntriesTable.endedAt,
        durationMin: timeEntriesTable.durationMin,
      }).from(timeEntriesTable).where(and(
        inArray(timeEntriesTable.userId, employeeIds),
        gte(timeEntriesTable.startedAt, start),
        lt(timeEntriesTable.startedAt, end),
        isNull(timeEntriesTable.deletedAt),
      )),
      db.select({
        userId: workReportsTable.userId,
        status: workReportsTable.status,
        startDate: workReportsTable.startDate,
        endDate: workReportsTable.endDate,
        createdAt: workReportsTable.createdAt,
      }).from(workReportsTable).where(inArray(workReportsTable.userId, employeeIds)),
    ]);

    const now = new Date();
    for (const row of taskRows) {
      if (!row.employeeId) continue;
      const employee = byEmployee.get(row.employeeId);
      if (!employee) continue;
      employee.totalAssigned++;
      const due = row.dueDate ? new Date(row.dueDate) : null;
      const isDone = ["DONE", "COMPLETED"].includes((row.status ?? "").toUpperCase());
      const isLate = Boolean(isDone && due && row.updatedAt &&
        new Date(row.updatedAt).toISOString().slice(0, 10) > due.toISOString().slice(0, 10));
      const isOverdue = Boolean(!isDone && due && due.getTime() < now.getTime());

      if (isDone) {
        employee.completed++;
        if (isLate) employee.delayed++;
        else employee.completedOnTime++;
      } else if ((row.status ?? "").toUpperCase() === "IN_PROGRESS") {
        employee.inProgress++;
      } else {
        employee.todo++;
      }
      if (isOverdue) employee.overdue++;
      employee.tasks.push({
        id: row.taskId,
        title: row.title,
        status: row.status ?? "TODO",
        priority: row.priority ?? null,
        dueDate: row.dueDate?.toISOString() ?? null,
        projectName: canViewProjects ? row.projectName : null,
        isOverdue,
        isDelayed: isLate,
      });
    }

    for (const row of attendanceRows) {
      const employee = byEmployee.get(row.userId);
      if (!employee) continue;
      employee.attendance.records++;
      const status = (row.status ?? "").toUpperCase();
      if (status === "PRESENT") employee.attendance.presentDays++;
      else if (status === "HALF_DAY") employee.attendance.halfDays++;
      else if (status === "ABSENT") employee.attendance.absentDays++;
      else if (status === "ON_LEAVE") employee.attendance.leaveDays++;
      if (row.isLate) employee.attendance.lateDays++;
      employee.attendance.overtimeMinutes += Math.max(0, row.overtimeMin ?? 0);
    }
    for (const employee of byEmployee.values()) {
      const attendance = employee.attendance;
      if (attendance.records > 0) {
        const scheduledDays = attendance.records - attendance.leaveDays;
        attendance.attendanceRate = Math.round(
          scheduledDays > 0
            ? ((attendance.presentDays + attendance.halfDays * 0.5) / scheduledDays) * 100
            : 0,
        );
      }
    }

    for (const row of timeRows) {
      const employee = row.userId ? byEmployee.get(row.userId) : undefined;
      if (!employee) continue;
      const derivedMinutes = row.endedAt
        ? Math.max(0, Math.round((row.endedAt.getTime() - row.startedAt.getTime()) / 60000))
        : Math.max(0, Math.round((now.getTime() - row.startedAt.getTime()) / 60000));
      employee.trackedMinutes += Math.max(0, row.durationMin && row.durationMin > 0 ? row.durationMin : derivedMinutes);
    }

    for (const row of reportRows) {
      const employee = byEmployee.get(row.userId);
      if (!employee) continue;
      const startsInMonth = row.startDate ? row.startDate <= monthLastDay : false;
      const endsInMonth = row.endDate ? row.endDate >= monthStart : false;
      const createdInMonth = row.createdAt >= start && row.createdAt < end;
      if (!createdInMonth && !(startsInMonth && endsInMonth)) continue;
      employee.workReports.total++;
      const normalizedStatus = (row.status ?? "").toLowerCase();
      if (normalizedStatus !== "draft") employee.workReports.submitted++;
      if (normalizedStatus === "approved") employee.workReports.approved++;
    }
  }

  const results = Array.from(byEmployee.values())
    .map((employee) => ({
      ...employee,
      tasks: employee.tasks.sort((a, b) => {
        if (!a.dueDate) return b.dueDate ? 1 : a.title.localeCompare(b.title);
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }),
    }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  return res.json({
    month: monthParam,
    generatedAt: new Date().toISOString(),
    employees: results,
  });
}));

export default router;
