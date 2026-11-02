import { Router } from "express";
import { db } from "@workspace/db";
import {
  attendanceTable,
  employeesTable,
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

function computeEmployeePerformance(emp: {
  totalAssigned: number;
  completed: number;
  completedOnTime: number;
  delayed: number;
  inProgress: number;
  overdue: number;
  todo: number;
  attendance: {
    records: number;
    presentDays: number;
    halfDays: number;
    absentDays: number;
    leaveDays: number;
    lateDays: number;
    overtimeMinutes: number;
    attendanceRate: number | null;
  };
  workReports: {
    total: number;
    submitted: number;
    approved: number;
  };
  trackedMinutes: number;
}) {
  // 1. Work / Task Score (0-100)
  let workScore = 80;
  if (emp.totalAssigned > 0) {
    const completionRate = emp.completed / emp.totalAssigned;
    const completedWithDue = emp.completedOnTime + emp.delayed;
    const onTimeRate = completedWithDue > 0 ? emp.completedOnTime / completedWithDue : 1;
    const overduePenalty = (emp.overdue / emp.totalAssigned) * 0.35;
    workScore = Math.max(0, Math.min(100, Math.round((completionRate * 0.6 + onTimeRate * 0.4 - overduePenalty) * 100)));
  }

  // 2. Attendance & Punctuality Score (0-100)
  let attendanceScore = 85;
  if (emp.attendance.records > 0) {
    const rawRate = emp.attendance.attendanceRate ?? 80;
    const latePenalty = Math.min(25, emp.attendance.lateDays * 3);
    const overtimeBonus = Math.min(10, Math.round(emp.attendance.overtimeMinutes / 60));
    attendanceScore = Math.max(0, Math.min(100, Math.round(rawRate - latePenalty + overtimeBonus)));
  }

  // 3. Work Reports / Operational Discipline (0-100)
  let reportingScore = 80;
  if (emp.workReports.total > 0) {
    const submitRate = emp.workReports.submitted / emp.workReports.total;
    const approveRate = emp.workReports.approved / (emp.workReports.submitted || 1);
    reportingScore = Math.round((submitRate * 0.6 + approveRate * 0.4) * 100);
  }

  // 4. Productivity & Logged Time (0-100)
  const trackedHours = emp.trackedMinutes / 60;
  let productivityScore = 80;
  if (emp.attendance.presentDays > 0) {
    const expectedHours = emp.attendance.presentDays * 7.5;
    productivityScore = Math.max(20, Math.min(100, Math.round((trackedHours / expectedHours) * 100)));
  }

  // Overall Composite Score (0-100)
  const overallScore = Math.round(
    workScore * 0.40 +
    attendanceScore * 0.35 +
    reportingScore * 0.15 +
    productivityScore * 0.10
  );

  let grade = "B";
  let gradeLabel = "Good";
  if (overallScore >= 92) {
    grade = "A+";
    gradeLabel = "Outstanding";
  } else if (overallScore >= 82) {
    grade = "A";
    gradeLabel = "Excellent";
  } else if (overallScore >= 70) {
    grade = "B";
    gradeLabel = "Good";
  } else if (overallScore >= 55) {
    grade = "C";
    gradeLabel = "Satisfactory";
  } else {
    grade = "Needs Attention";
    gradeLabel = "Action Required";
  }

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (emp.totalAssigned > 0 && emp.overdue === 0 && emp.completed >= emp.totalAssigned * 0.7) {
    strengths.push("High task delivery & zero overdue backlog");
  }
  if (emp.completedOnTime > 0 && emp.delayed === 0) {
    strengths.push("100% on-time milestone delivery");
  }
  if (emp.attendance.attendanceRate !== null && emp.attendance.attendanceRate >= 90) {
    strengths.push(`${emp.attendance.attendanceRate}% consistent workplace attendance`);
  }
  if (emp.attendance.lateDays === 0 && emp.attendance.presentDays > 5) {
    strengths.push("Punctual punch-in records");
  }
  if (emp.workReports.approved > 0 && emp.workReports.approved === emp.workReports.total) {
    strengths.push("All monthly activity reports verified & approved");
  }

  if (emp.overdue > 0) {
    improvements.push(`${emp.overdue} task${emp.overdue > 1 ? "s" : ""} currently overdue - prioritize completion`);
  }
  if (emp.attendance.lateDays > 2) {
    improvements.push(`${emp.attendance.lateDays} late check-ins recorded - improve morning punctuality`);
  }
  if (emp.attendance.absentDays > 2) {
    improvements.push(`${emp.attendance.absentDays} unexcused absent days noted`);
  }
  if (emp.workReports.total > 0 && emp.workReports.submitted < emp.workReports.total) {
    improvements.push("Pending draft work reports to be submitted for manager review");
  }
  if (strengths.length === 0) {
    strengths.push("Active team contributor");
  }
  if (improvements.length === 0) {
    improvements.push("Maintain current delivery pace and punctuality");
  }

  let summary = "";
  if (overallScore >= 85) {
    summary = `High performer exhibiting strong consistency. Demonstrates ${emp.totalAssigned > 0 ? `${emp.completed} tasks delivered` : "solid operational support"} with ${emp.attendance.attendanceRate ?? 95}% attendance and disciplined execution.`;
  } else if (overallScore >= 70) {
    summary = `Dependable performance across the month. Maintains steady task progress (${emp.completed}/${emp.totalAssigned || 1} tasks) with reliable attendance (${emp.attendance.presentDays} days active).`;
  } else {
    summary = `Performance review recommended. Attention needed on ${emp.overdue > 0 ? `${emp.overdue} overdue tasks` : "delivery pace"} and attendance punctuality to meet target agency KPIs.`;
  }

  return {
    overallScore,
    grade,
    gradeLabel,
    metrics: {
      workScore,
      attendanceScore,
      reportingScore,
      productivityScore,
    },
    strengths,
    improvements,
    summary,
  };
}

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
    email: usersTable.email,
    role: usersTable.role,
    designation: employeesTable.designation,
    employeeCode: employeesTable.employeeCode,
  })
    .from(usersTable)
    .leftJoin(employeesTable, eq(usersTable.id, employeesTable.userId))
    .where(and(...employeeFilters));

  const employeeIds = employeeRows.map((employee) => employee.id);
  const byEmployee = new Map(employeeRows.map((employee) => [employee.id, {
    employeeId: employee.id,
    employeeName: employee.name || "Unknown",
    email: employee.email || "",
    role: employee.role || "EMPLOYEE",
    designation: employee.designation || employee.role || "Team Member",
    employeeCode: employee.employeeCode || null,
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
    .map((employee) => {
      const evaluation = computeEmployeePerformance(employee);
      return {
        ...employee,
        overallScore: evaluation.overallScore,
        grade: evaluation.grade,
        gradeLabel: evaluation.gradeLabel,
        summary: evaluation.summary,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements,
        metrics: evaluation.metrics,
        tasks: employee.tasks.sort((a, b) => {
          if (a.dueDate && b.dueDate) {
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          }
          if (a.dueDate) return -1;
          if (b.dueDate) return 1;
          return a.title.localeCompare(b.title);
        }),
      };
    })
    .sort((a, b) => b.overallScore - a.overallScore || a.employeeName.localeCompare(b.employeeName));

  return res.json({
    month: monthParam,
    generatedAt: new Date().toISOString(),
    employees: results,
  });
}));

export default router;
