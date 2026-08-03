import { Router } from "express";
import { db } from "@workspace/db";
import {
  clientsTable, projectsTable, tasksTable, invoicesTable,
  leaveRequestsTable, usersTable,
} from "@workspace/db/schema";
import { eq, gte, sql, and } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { requirePermission, requireAuth, isPrivilegedRole } from "../middleware/auth";
import { getDashboardStatsService } from "../services/dashboardService";

const router = Router();

router.get("/stats", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).userId;
  try {
    const result = await getDashboardStatsService(userId);
    return res.json(result);
  } catch (err: any) {
    console.error("DEBUG DASHBOARD ERROR STACK:", err?.stack || err);
    return res.status(500).json({ error: err?.message || String(err) });
  }
}));

router.get("/revenue-chart", requirePermission("reports.view"), asyncHandler(async (req, res) => {
  const userId = (req as any).userId;
  const [user] = await db
    .select({ systemRole: usersTable.systemRole })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!isPrivilegedRole(user?.systemRole)) {
    return res.status(403).json({ error: "Forbidden: Employees cannot access financial charts." });
  }

  const now = new Date();
  const range = (req.query.range as string) ?? "6m";

  let monthCount = 6;
  let startDate: Date;

  if (range === "3m") {
    monthCount = 3;
    startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  } else if (range === "12m") {
    monthCount = 12;
    startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  } else if (range === "ytd") {
    startDate = new Date(now.getFullYear(), 0, 1);
    monthCount = now.getMonth() + 1;
  } else {
    monthCount = 6;
    startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  }

  const months: Record<string, number> = {};
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months[d.toLocaleString("default", { month: "short", year: "2-digit" })] = 0;
  }

  const startStr = startDate.toISOString().slice(0, 10);

  const invoices = await db
    .select({ invoiceDate: invoicesTable.invoiceDate, total: invoicesTable.total })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.status, "PAID"), gte(invoicesTable.invoiceDate, startStr)));

  for (const inv of invoices) {
    if (inv.invoiceDate) {
      const key = new Date(inv.invoiceDate).toLocaleString("default", { month: "short", year: "2-digit" });
      if (key in months) months[key] += inv.total ?? 0;
    }
  }
  return res.json(Object.entries(months).map(([month, amount]) => ({ month, amount })));
}));

router.get("/project-health", asyncHandler(async (req, res) => {
  const userId = (req as any).userId;
  const [user] = await db
    .select({ systemRole: usersTable.systemRole })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!isPrivilegedRole(user?.systemRole)) {
    const employeeTasks = await db
      .select({ projectId: tasksTable.projectId })
      .from(tasksTable)
      .where(eq(tasksTable.assigneeId, userId));

    const assignedProjectIds = Array.from(new Set(employeeTasks.map((t) => t.projectId).filter(Boolean))) as string[];

    const projects = await db
      .select({
        id: projectsTable.id,
        status: projectsTable.status,
        dueDate: projectsTable.dueDate,
        createdBy: projectsTable.createdBy,
      })
      .from(projectsTable);

    const myProjects = projects.filter((p) => p.createdBy === userId || assignedProjectIds.includes(p.id));
    const myProjectIds = myProjects.map((p) => p.id);

    const tasks = await db
      .select({
        projectId: tasksTable.projectId,
        status: tasksTable.status,
      })
      .from(tasksTable)
      .where(sql`${tasksTable.projectId} is not null`);

    const myTasks = tasks.filter((t) => t.projectId && myProjectIds.includes(t.projectId));

    const projectTasksMap: Record<string, { total: number; incomplete: number }> = {};
    for (const t of myTasks) {
      if (t.projectId) {
        if (!projectTasksMap[t.projectId]) {
          projectTasksMap[t.projectId] = { total: 0, incomplete: 0 };
        }
        projectTasksMap[t.projectId].total++;
        if (t.status !== "COMPLETED") {
          projectTasksMap[t.projectId].incomplete++;
        }
      }
    }

    let onTrack = 0;
    let atRisk = 0;
    let delayed = 0;
    let completed = 0;

    const now = new Date();

    for (const p of myProjects) {
      const status = p.status ?? "";
      if (status === "COMPLETED") {
        completed++;
        continue;
      }
      if (status === "CANCELLED" || status === "ON_HOLD") {
        delayed++;
        continue;
      }

      const dueDate = p.dueDate ? new Date(p.dueDate) : null;
      const taskInfo = projectTasksMap[p.id] || { total: 0, incomplete: 0 };
      const hasIncompleteTasks = taskInfo.incomplete > 0;

      if (dueDate) {
        const diffTime = dueDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
          atRisk++;
        } else if (diffDays <= 7 && hasIncompleteTasks) {
          atRisk++;
        } else {
          onTrack++;
        }
      } else {
        onTrack++;
      }
    }

    return res.json({ onTrack, atRisk, delayed, completed, total: myProjects.length });
  }

  const [projects, tasks] = await Promise.all([
    db
      .select({
        id: projectsTable.id,
        status: projectsTable.status,
        dueDate: projectsTable.dueDate,
      })
      .from(projectsTable),
    db
      .select({
        projectId: tasksTable.projectId,
        status: tasksTable.status,
      })
      .from(tasksTable),
  ]);

  const projectTasksMap: Record<string, { total: number; incomplete: number }> = {};
  for (const t of tasks) {
    if (t.projectId) {
      if (!projectTasksMap[t.projectId]) {
        projectTasksMap[t.projectId] = { total: 0, incomplete: 0 };
      }
      projectTasksMap[t.projectId].total++;
      if (t.status !== "COMPLETED") {
        projectTasksMap[t.projectId].incomplete++;
      }
    }
  }

  let onTrack = 0;
  let atRisk = 0;
  let delayed = 0;
  let completed = 0;

  const now = new Date();

  for (const p of projects) {
    const status = p.status ?? "";
    if (status === "COMPLETED") {
      completed++;
      continue;
    }
    if (status === "CANCELLED" || status === "ON_HOLD") {
      delayed++;
      continue;
    }

    const dueDate = p.dueDate ? new Date(p.dueDate) : null;
    const taskInfo = projectTasksMap[p.id] || { total: 0, incomplete: 0 };
    const hasIncompleteTasks = taskInfo.incomplete > 0;

    if (dueDate) {
      const diffTime = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        atRisk++;
      } else if (diffDays <= 7 && hasIncompleteTasks) {
        atRisk++;
      } else {
        onTrack++;
      }
    } else {
      onTrack++;
    }
  }

  return res.json({ onTrack, atRisk, delayed, completed, total: projects.length });
}));

router.get("/recent-activity", asyncHandler(async (req, res) => {
  const userId = (req as any).userId;
  const [user] = await db
    .select({ systemRole: usersTable.systemRole })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!isPrivilegedRole(user?.systemRole)) {
    const employeeTasks = await db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        status: tasksTable.status,
        projectId: tasksTable.projectId,
        approvalStatus: tasksTable.approvalStatus,
        createdAt: tasksTable.createdAt,
        updatedAt: tasksTable.updatedAt,
        approvedAt: tasksTable.approvedAt,
      })
      .from(tasksTable)
      .where(eq(tasksTable.assigneeId, userId));

    const employeeTaskRequests = await db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        approvalStatus: tasksTable.approvalStatus,
        createdAt: tasksTable.createdAt,
        updatedAt: tasksTable.updatedAt,
        requestedAt: tasksTable.requestedAt,
        approvedAt: tasksTable.approvedAt,
      })
      .from(tasksTable)
      .where(eq(tasksTable.requestedBy, userId));

    const myLeaves = await db
      .select()
      .from(leaveRequestsTable)
      .where(eq(leaveRequestsTable.userId, userId));

    const allProjects = await db
      .select({
        id: projectsTable.id,
        name: projectsTable.name,
        createdBy: projectsTable.createdBy,
        createdAt: projectsTable.createdAt,
      })
      .from(projectsTable);

    const assignedProjectIds = Array.from(new Set(employeeTasks.map((t) => t.projectId).filter(Boolean))) as string[];
    const myProjects = allProjects.filter((p) => p.createdBy === userId || assignedProjectIds.includes(p.id));

    const activities: any[] = [];
    for (const t of employeeTasks) {
      const tCreatedAt = t.createdAt ? new Date(t.createdAt) : new Date();
      const tUpdatedAt = t.updatedAt ? new Date(t.updatedAt) : new Date();

      if (t.approvalStatus === "APPROVED") {
        const approvedDate = t.approvedAt ? new Date(t.approvedAt) : tCreatedAt;
        activities.push({
          id: `task-assigned-${t.id}`,
          type: "task",
          message: `Task assigned: "${t.title}"`,
          createdAt: approvedDate.toISOString(),
        });

        if (t.status === "IN_PROGRESS" || t.status === "COMPLETED") {
          activities.push({
            id: `task-status-${t.id}`,
            type: "task",
            message: `Task status updated to ${t.status.replace("_", " ")}: "${t.title}"`,
            createdAt: tUpdatedAt.toISOString(),
          });
        }
      }
    }

    for (const tr of employeeTaskRequests) {
      const trCreatedAt = tr.requestedAt ? new Date(tr.requestedAt) : (tr.createdAt ? new Date(tr.createdAt) : new Date());
      const trUpdatedAt = tr.updatedAt ? new Date(tr.updatedAt) : new Date();

      activities.push({
        id: `task-req-submitted-${tr.id}`,
        type: "task",
        message: `Submitted task request: "${tr.title}"`,
        createdAt: trCreatedAt.toISOString(),
      });

      if (tr.approvalStatus === "APPROVED") {
        const approvedDate = tr.approvedAt ? new Date(tr.approvedAt) : trUpdatedAt;
        activities.push({
          id: `task-req-approved-${tr.id}`,
          type: "task",
          message: `Task request approved: "${tr.title}"`,
          createdAt: approvedDate.toISOString(),
        });
      } else if (tr.approvalStatus === "REJECTED") {
        activities.push({
          id: `task-req-rejected-${tr.id}`,
          type: "task",
          message: `Task request rejected: "${tr.title}"`,
          createdAt: trUpdatedAt.toISOString(),
        });
      }
    }

    for (const lv of myLeaves) {
      const lvCreatedAt = lv.createdAt ? new Date(lv.createdAt) : new Date();
      activities.push({
        id: `leave-submitted-${lv.id}`,
        type: "leave",
        message: `Leave request submitted: ${lv.type} (${lv.startDate} to ${lv.endDate})`,
        createdAt: lvCreatedAt.toISOString(),
      });
    }

    for (const p of myProjects) {
      const pCreatedAt = p.createdAt ? new Date(p.createdAt) : new Date();
      activities.push({
        id: `project-assigned-${p.id}`,
        type: "project",
        message: `Project assigned: "${p.name}"`,
        createdAt: pCreatedAt.toISOString(),
      });
    }

    activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return res.json(activities.slice(0, 10));
  }

  const [clients, projects, invoices] = await Promise.all([
    db.select({ id: clientsTable.id, companyName: clientsTable.companyName, createdAt: clientsTable.createdAt }).from(clientsTable).orderBy(sql`created_at desc`).limit(3),
    db.select({ id: projectsTable.id, name: projectsTable.name, createdAt: projectsTable.createdAt }).from(projectsTable).orderBy(sql`created_at desc`).limit(3),
    db.select({ id: invoicesTable.id, number: invoicesTable.number, status: invoicesTable.status, createdAt: invoicesTable.createdAt }).from(invoicesTable).orderBy(sql`created_at desc`).limit(3),
  ]);

  const activity = [
    ...clients.map((c) => ({ id: `client-${c.id}`, type: "client", message: `Client ${c.companyName} added`, createdAt: c.createdAt?.toISOString() ?? new Date().toISOString() })),
    ...projects.map((p) => ({ id: `project-${p.id}`, type: "project", message: `Project "${p.name}" created`, createdAt: p.createdAt?.toISOString() ?? new Date().toISOString() })),
    ...invoices.map((i) => ({ id: `invoice-${i.id}`, type: "invoice", message: `Invoice ${i.number ?? ""} ${i.status?.toLowerCase()}`, createdAt: i.createdAt?.toISOString() ?? new Date().toISOString() })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

  return res.json(activity);
}));

export default router;
