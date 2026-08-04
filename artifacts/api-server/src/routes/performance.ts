import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, usersTable, projectsTable } from "@workspace/db/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { requirePermission } from "../middleware/auth";

const router = Router();

/**
 * GET /api/performance/monthly?month=YYYY-MM
 * Returns per-employee performance metrics for the given calendar month.
 * Falls back to the current month if no param supplied.
 */
router.get("/monthly", requirePermission("projects.view"), asyncHandler(async (req, res) => {
  const monthParam = (req.query.month as string) || new Date().toISOString().slice(0, 7);
  const [year, month] = monthParam.split("-").map(Number);

  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 1); // exclusive upper bound

  // All tasks assigned to an employee that fall within the month
  // (tasks due in the month OR updated/completed in the month)
  const rows = await db
    .select({
      employeeId:   tasksTable.assigneeId,
      employeeName: usersTable.name,
      taskId:       tasksTable.id,
      title:        tasksTable.title,
      status:       tasksTable.status,
      priority:     tasksTable.priority,
      dueDate:      tasksTable.dueDate,
      projectName:  projectsTable.name,
      createdAt:    tasksTable.createdAt,
      updatedAt:    tasksTable.updatedAt,
    })
    .from(tasksTable)
    .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .where(
      and(
        isNotNull(tasksTable.assigneeId),
        // include tasks that were due in this month OR created in this month
        sql`(
          (${tasksTable.dueDate} >= ${start.toISOString()} AND ${tasksTable.dueDate} < ${end.toISOString()})
          OR
          (${tasksTable.createdAt} >= ${start.toISOString()} AND ${tasksTable.createdAt} < ${end.toISOString()})
        )`
      )
    );

  // Aggregate per employee
  const byEmployee: Record<string, {
    employeeId: string;
    employeeName: string;
    totalAssigned: number;
    completed: number;
    completedOnTime: number;
    delayed: number;        // done but past due date
    inProgress: number;
    overdue: number;        // not done and past due date
    todo: number;
    tasks: any[];
  }> = {};

  const now = new Date();

  for (const r of rows) {
    if (!r.employeeId) continue;
    if (!byEmployee[r.employeeId]) {
      byEmployee[r.employeeId] = {
        employeeId:    r.employeeId,
        employeeName:  r.employeeName ?? "Unknown",
        totalAssigned: 0,
        completed:     0,
        completedOnTime: 0,
        delayed:       0,
        inProgress:    0,
        overdue:       0,
        todo:          0,
        tasks:         [],
      };
    }

    const emp = byEmployee[r.employeeId];
    emp.totalAssigned++;

    const due   = r.dueDate ? new Date(r.dueDate) : null;
    const done  = r.status === "DONE";

    if (done) {
      emp.completed++;
      if (due && new Date(r.updatedAt) > due) {
        emp.delayed++;
      } else {
        emp.completedOnTime++;
      }
    } else if (r.status === "IN_PROGRESS") {
      emp.inProgress++;
      if (due && due < now) emp.overdue++;
    } else {
      emp.todo++;
      if (due && due < now) emp.overdue++;
    }

    emp.tasks.push({
      id:          r.taskId,
      title:       r.title,
      status:      r.status,
      priority:    r.priority,
      dueDate:     r.dueDate,
      projectName: r.projectName,
      isOverdue:   !done && due && due < now,
      isDelayed:   done && due && new Date(r.updatedAt) > due,
    });
  }

  const results = Object.values(byEmployee).sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName)
  );

  return res.json({
    month: monthParam,
    generatedAt: new Date().toISOString(),
    employees: results,
  });
}));

export default router;
