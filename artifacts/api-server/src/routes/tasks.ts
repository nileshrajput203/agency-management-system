import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, projectsTable, usersTable } from "@workspace/db/schema";
import { and, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate } from "../lib/validation";
import {
  requirePermission,
  canManageTaskWorkspace,
  canManageProjectWorkspace,
} from "../middleware/auth";
import { canEmployeeAccessTask } from "../middleware/taskAccess";
import { NotificationService } from "../services/notificationService";
import { logger, notificationLogger } from "../lib/logger";
import { hideItemForUser, getHiddenEntityIds, deleteHiddenItemsForEntity } from "../services/hiddenItemsService";

const requesterTable = alias(usersTable, "requester_users");
const approvedByTable = alias(usersTable, "approved_by_users");

const router = Router();

export const TaskApprovalStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  MODIFIED: "MODIFIED",
} as const;

function sanitizeTask(body: any, isUpdate = false) {
  if (!isUpdate && (!body.title || typeof body.title !== "string" || body.title.trim() === "")) {
    throw createError("Task title is required", 400, undefined, "title");
  }
  if (isUpdate && body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim() === "") {
      throw createError("Task title cannot be empty", 400, undefined, "title");
    }
  }
  const result = sanitizeAndValidate(body, {
    uuids: ["projectId", "assigneeId", "parentId", "requestedBy", "approvedBy", "managerApprovedBy"],
    dates: ["startDate", "dueDate", "approvedAt", "requestedAt", "managerApprovedAt"],
    enums: {
      status: ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED", "COMPLETED"],
      priority: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      approvalStatus: ["PENDING", "APPROVED", "REJECTED", "MODIFIED", "MANAGER_APPROVED"],
    },
  });
  // Pass through non-sensitive string fields not in the validator
  if (body.assignmentNote !== undefined) result.assignmentNote = String(body.assignmentNote || "").slice(0, 2000);
  if (body.coAssignees !== undefined) result.coAssignees = Array.isArray(body.coAssignees) ? body.coAssignees : [];
  return result;
}

router.get("/", requirePermission("tasks.view"), asyncHandler(async (req, res) => {
  const requesterId = (req as any).userId;
  const requesterSystemRole = (req as any).userSystemRole;
  const isPrivileged = canManageTaskWorkspace(requesterSystemRole, (req as any).userConfiguredModules);

  let query = db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      status: tasksTable.status,
      priority: tasksTable.priority,
      projectId: tasksTable.projectId,
      projectName: projectsTable.name,
      assigneeId: tasksTable.assigneeId,
      assigneeName: usersTable.name,
      startDate: tasksTable.startDate,
      dueDate: tasksTable.dueDate,
      description: tasksTable.description,
      objective: tasksTable.objective,
      requirements: tasksTable.requirements,
      deliverables: tasksTable.deliverables,
      notes: tasksTable.notes,
      approvalStatus: tasksTable.approvalStatus,
      requestedBy: tasksTable.requestedBy,
      requestedByName: requesterTable.name,
      requestedByEmail: requesterTable.email,
      approvedBy: tasksTable.approvedBy,
      approvedByName: approvedByTable.name,
      approvedByEmail: approvedByTable.email,
      approvedAt: tasksTable.approvedAt,
      rejectionReason: tasksTable.rejectionReason,
      requestedAt: tasksTable.requestedAt,
      coAssignees: tasksTable.coAssignees,
      assignmentNote: tasksTable.assignmentNote,
      managerApprovedBy: tasksTable.managerApprovedBy,
      managerApprovedAt: tasksTable.managerApprovedAt,
    })
    .from(tasksTable)
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
    .leftJoin(requesterTable, eq(tasksTable.requestedBy, requesterTable.id))
    .leftJoin(approvedByTable, eq(tasksTable.approvedBy, approvedByTable.id));

  if (!isPrivileged) {
    query = query.where(or(
      eq(tasksTable.assigneeId, requesterId),
      and(
        eq(tasksTable.requestedBy, requesterId),
        eq(tasksTable.approvalStatus, "PENDING"),
      ),
    ));
  }

  const rows = await query;
  const hiddenIds = await getHiddenEntityIds(requesterId, "tasks");
  const canViewProjects = requesterSystemRole === "SUPER_ADMIN" ||
    (req as any).userConfiguredModules.includes("projects");
  const scopedRows = canViewProjects
    ? rows
    : rows.map((row) => ({ ...row, projectId: null, projectName: null }));
  const visibleRows = hiddenIds.length > 0 ? scopedRows.filter((r) => !hiddenIds.includes(r.id)) : scopedRows;

  return res.json(visibleRows);
}));

router.post("/", requirePermission("tasks.create"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeTask(body, false);
  const requesterId = (req as any).userId;
  const requesterSystemRole = (req as any).userSystemRole;
  const requesterRole = (req as any).userRole || requesterSystemRole;
  const isPrivileged = canManageTaskWorkspace(requesterSystemRole, (req as any).userConfiguredModules);

  if (!isPrivileged) {
    if (
      !canManageProjectWorkspace(requesterSystemRole, (req as any).userConfiguredModules) &&
      sanitized.projectId
    ) {
      throw createError("Enable the Projects section before linking a task to a project", 403);
    }
    // Employees create a task request for themselves
    sanitized.approvalStatus = "PENDING";
    // A request always starts as work to be done. Completion must happen
    // after approval and then go through IN_REVIEW for manager review.
    sanitized.status = "TODO";
    sanitized.requestedBy = requesterId;
    sanitized.requestedAt = new Date();
    sanitized.assigneeId = requesterId; // Employees request tasks for themselves
  } else {
    // Admin / Manager created tasks are immediately active and approved
    sanitized.approvalStatus = "APPROVED";
    sanitized.requestedBy = requesterId;
    sanitized.requestedAt = new Date();
    sanitized.approvedBy = requesterId;
    sanitized.approvedAt = new Date();
    if (!sanitized.assigneeId) {
      sanitized.assigneeId = requesterId;
    }
  }

  const [row] = await db.insert(tasksTable).values({ ...sanitized, createdBy: requesterId }).returning();

  logger.info({
    taskId: row.id,
    assigneeId: row.assigneeId,
    creatorId: row.requestedBy || row.createdBy,
    approverId: row.approvedBy,
    currentStatus: null,
    nextStatus: row.status,
    approvalDecision: row.approvalStatus,
  }, "[Task Workflow] Task created");

  // Send Notification
  try {
    if (requesterRole === "EMPLOYEE") {
      const [emp] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, requesterId));
      const empName = emp?.name || "An employee";
      await NotificationService.notifyAdminsAndManagers({
        title: "📋 Task Approval Requested",
        message: `${empName} requested approval for task "${row.title}"`,
        type: "TASK",
        priority: "HIGH",
        referenceId: row.id,
        referenceType: "TASK",
        createdBy: requesterId,
        action: "Review Task",
        actionUrl: "/tasks",
      }, requesterId);
    } else if (row.assigneeId && row.assigneeId !== requesterId) {
      await NotificationService.createNotification({
        userId: row.assigneeId,
        title: "📋 New Task Assigned",
        message: `You have been assigned task "${row.title}"`,
        type: "TASK",
        priority: (row.priority as any) || "MEDIUM",
        referenceId: row.id,
        referenceType: "TASK",
        createdBy: requesterId,
        action: "View Task",
        actionUrl: "/tasks",
      });
    }
  } catch (err) {
    notificationLogger.error({ err }, "Error sending task creation notification");
  }

  return res.status(201).json(row);
}));

router.get("/:id", requirePermission("tasks.view"), asyncHandler(async (req, res) => {
  const requesterId = (req as any).userId;
  const requesterSystemRole = (req as any).userSystemRole;
  const isPrivileged = canManageTaskWorkspace(requesterSystemRole, (req as any).userConfiguredModules);

  const [row] = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      status: tasksTable.status,
      priority: tasksTable.priority,
      projectId: tasksTable.projectId,
      projectName: projectsTable.name,
      assigneeId: tasksTable.assigneeId,
      assigneeName: usersTable.name,
      startDate: tasksTable.startDate,
      dueDate: tasksTable.dueDate,
      description: tasksTable.description,
      objective: tasksTable.objective,
      requirements: tasksTable.requirements,
      deliverables: tasksTable.deliverables,
      notes: tasksTable.notes,
      createdBy: tasksTable.createdBy,
      approvalStatus: tasksTable.approvalStatus,
      requestedBy: tasksTable.requestedBy,
      requestedByName: requesterTable.name,
      requestedByEmail: requesterTable.email,
      approvedBy: tasksTable.approvedBy,
      approvedByName: approvedByTable.name,
      approvedByEmail: approvedByTable.email,
      approvedAt: tasksTable.approvedAt,
      rejectionReason: tasksTable.rejectionReason,
      requestedAt: tasksTable.requestedAt,
    })
    .from(tasksTable)
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
    .leftJoin(requesterTable, eq(tasksTable.requestedBy, requesterTable.id))
    .leftJoin(approvedByTable, eq(tasksTable.approvedBy, approvedByTable.id))
    .where(eq(tasksTable.id, (req.params.id as string)));

  if (!row) throw createError("Not found", 404);

  if (!isPrivileged && !canEmployeeAccessTask(row, requesterId)) {
    throw createError("Forbidden: You can only view tasks assigned to you", 403);
  }

  const canViewProjects = requesterSystemRole === "SUPER_ADMIN" ||
    (req as any).userConfiguredModules.includes("projects");
  return res.json(canViewProjects ? row : { ...row, projectId: null, projectName: null });
}));

router.patch("/:id", requirePermission("tasks.edit"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeTask(body, true);

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, req.params.id as string));
  if (!task) throw createError("Not found", 404);

  const requesterId = (req as any).userId;
  const requesterSystemRole = (req as any).userSystemRole;
  const requesterRole = (req as any).userRole || requesterSystemRole;
  const isPrivileged = canManageTaskWorkspace(requesterSystemRole, (req as any).userConfiguredModules);
  const canManageProjects = canManageProjectWorkspace(
    requesterSystemRole,
    (req as any).userConfiguredModules,
  );

  if (!isPrivileged) {
    const isPending = task.approvalStatus === "PENDING";

    // Pending requests belong to their requester, even if a legacy row has
    // no assignee yet. Active work remains limited to the assigned employee.
    if (!canEmployeeAccessTask(task, requesterId)) {
      throw createError("Forbidden: You do not have permission to access or modify this task", 403);
    }

    const isApprovedOrModified = task.approvalStatus === "APPROVED" || task.approvalStatus === "MODIFIED" || !task.approvalStatus;

    if (isPending) {
      if (task.requestedBy !== requesterId) {
        throw createError("Forbidden: You can only edit your own pending requests", 403);
      }
      // Pending requests allow only request fields; project assignment requires
      // access to the Projects section.
      const allowedKeys = new Set(["title", "description", "priority", "dueDate"]);
      if (canManageProjects) allowedKeys.add("projectId");
      const updateKeys = Object.keys(sanitized).filter((key) => sanitized[key] !== undefined);
      if (updateKeys.some((key) => !allowedKeys.has(key))) {
        throw createError("Forbidden: Pending requests allow edits to title, description, priority, due date, and enabled project assignment only", 403);
      }
    } else if (isApprovedOrModified) {
      if (task.assigneeId !== requesterId) {
        throw createError("Forbidden: You can only update the status of tasks assigned to you", 403);
      }
      // Active task: employees can only update status or description.
      // Completing a task is a manager decision; employees submit it for review.
      const updateKeys = Object.keys(sanitized).filter((key) => sanitized[key] !== undefined);
      if (updateKeys.some((key) => key !== "status" && key !== "description")) {
        throw createError("Forbidden: Active tasks allow status and description updates only", 403);
      }
      if (sanitized.status === "DONE" || sanitized.status === "COMPLETED") {
        sanitized.status = "IN_REVIEW";
      }
    } else {
      throw createError("Forbidden: Cannot modify a rejected task request", 403);
    }
  } else {
    // Admin / Manager is modifying/approving
    // Completion is only valid for a task that has already been approved.
    // This keeps a manager's approval action and completion action separate,
    // so a pending request can never jump directly to Done.
    if ((sanitized.status === "DONE" || sanitized.status === "COMPLETED") &&
        task.approvalStatus !== "APPROVED" &&
        task.approvalStatus !== "MODIFIED") {
      throw createError("Approve this task request before marking it as done", 409, undefined, "status");
    }

    if (sanitized.approvalStatus !== "REJECTED") {
      if (
        task.approvalStatus === "PENDING" ||
        sanitized.status === "DONE" ||
        sanitized.status === "COMPLETED" ||
        sanitized.approvalStatus === "APPROVED" ||
        sanitized.approvalStatus === "MODIFIED" ||
        !sanitized.approvalStatus
      ) {
        // Any task manager can approve a request. Do not leave legacy DONE
        // values in place when an old request is approved.
        sanitized.approvalStatus = sanitized.approvalStatus || "APPROVED";
        sanitized.approvedBy = requesterId;
        sanitized.approvedAt = new Date();
        // A request submitted as Done/In Review is still awaiting approval.
        // Approval activates it as To Do; otherwise it is counted as completed
        // immediately even though the manager has only just approved it.
        if (task.approvalStatus === "PENDING" &&
            (task.status === "DONE" || task.status === "COMPLETED" || task.status === "IN_REVIEW" ||
             sanitized.status === "DONE" || sanitized.status === "COMPLETED" || sanitized.status === "IN_REVIEW")) {
          sanitized.status = "TODO";
        }
      }

      if (!sanitized.assigneeId && !task.assigneeId) {
        sanitized.assigneeId = task.requestedBy || task.createdBy || requesterId;
      }
    }
  }

  const [row] = await db
    .update(tasksTable)
    .set({ ...sanitized, updatedAt: new Date(), updatedBy: requesterId })
    .where(eq(tasksTable.id, (req.params.id as string)))
    .returning();
  if (!row) throw createError("Not found", 404);

  logger.info({
    taskId: row.id,
    assigneeId: row.assigneeId,
    creatorId: row.requestedBy || row.createdBy,
    approverId: row.approvedBy,
    currentStatus: task.status,
    nextStatus: row.status,
    approvalDecision: row.approvalStatus,
  }, "[Task Workflow] Task status/approval updated");

  // Process task notifications
  try {
    const [emp] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, requesterId));
    const empName = emp?.name || "An employee";

    // 1. Assignee changed — notify even if self-assigned (manager assigning to themselves)
    if (row.assigneeId && row.assigneeId !== task.assigneeId) {
      await NotificationService.createNotification({
        userId: row.assigneeId,
        title: "📋 Task Assigned",
        message: `You have been assigned task "${row.title}"`,
        type: "TASK",
        priority: (row.priority as any) || "MEDIUM",
        referenceId: row.id,
        referenceType: "TASK",
        createdBy: requesterId,
        action: "View Task",
        actionUrl: "/tasks",
      });
    }

    // 2. Approval status changed
    if (sanitized.approvalStatus && sanitized.approvalStatus !== task.approvalStatus && task.requestedBy) {
      if (sanitized.approvalStatus === "MANAGER_APPROVED" && task.requestedBy !== requesterId) {
        await NotificationService.createNotification({
          userId: task.requestedBy,
          title: "⏳ Task Awaiting Final Approval",
          message: `Your task "${row.title}" was approved by your manager and is pending final approval`,
          type: "TASK",
          priority: "MEDIUM",
          referenceId: row.id,
          referenceType: "TASK",
          createdBy: requesterId,
          action: "View Task",
          actionUrl: "/tasks",
        });
      } else if (sanitized.approvalStatus === "APPROVED" && task.requestedBy !== requesterId) {
        await NotificationService.createNotification({
          userId: task.requestedBy,
          title: "✅ Task Approved",
          message: `Your requested task "${row.title}" was approved`,
          type: "TASK",
          priority: "HIGH",
          referenceId: row.id,
          referenceType: "TASK",
          createdBy: requesterId,
          action: "View Task",
          actionUrl: "/tasks",
        });
      } else if (sanitized.approvalStatus === "REJECTED" && task.requestedBy !== requesterId) {
        await NotificationService.createNotification({
          userId: task.requestedBy,
          title: "❌ Task Request Rejected",
          message: `Your requested task "${row.title}" was rejected${sanitized.rejectionReason ? `. Reason: ${sanitized.rejectionReason}` : ""}`,
          type: "TASK",
          priority: "HIGH",
          referenceId: row.id,
          referenceType: "TASK",
          createdBy: requesterId,
          action: "View Task",
          actionUrl: "/tasks",
        });
      }
    }

    // 3. Status changed
    if (sanitized.status && sanitized.status !== task.status) {
      if (sanitized.status === "IN_REVIEW") {
        // Task submitted for review -> Notify Admins/Managers and creator
        await NotificationService.notifyAdminsAndManagers({
          title: "⏳ Task Submitted for Review",
          message: `${empName} submitted task "${row.title}" for review`,
          type: "TASK",
          priority: "HIGH",
          referenceId: row.id,
          referenceType: "TASK",
          createdBy: requesterId,
          action: "Review Task",
          actionUrl: "/tasks",
        }, requesterId);

        if (task.createdBy && task.createdBy !== requesterId) {
          await NotificationService.createNotification({
            userId: task.createdBy,
            title: "⏳ Task Submitted for Review",
            message: `${empName} submitted task "${row.title}" for review`,
            type: "TASK",
            priority: "HIGH",
            referenceId: row.id,
            referenceType: "TASK",
            createdBy: requesterId,
            action: "Review Task",
            actionUrl: "/tasks",
          });
        }
      } else if (sanitized.status === "DONE" || sanitized.status === "COMPLETED") {
        // Task completed -> Notify Admins/Managers and creator
        await NotificationService.notifyAdminsAndManagers({
          title: "🎉 Task Completed",
          message: `${empName} completed task "${row.title}"`,
          type: "TASK",
          priority: "MEDIUM",
          referenceId: row.id,
          referenceType: "TASK",
          createdBy: requesterId,
          action: "View Task",
          actionUrl: "/tasks",
        }, requesterId);

        if (task.createdBy && task.createdBy !== requesterId) {
          await NotificationService.createNotification({
            userId: task.createdBy,
            title: "🎉 Task Completed",
            message: `${empName} completed task "${row.title}"`,
            type: "TASK",
            priority: "MEDIUM",
            referenceId: row.id,
            referenceType: "TASK",
            createdBy: requesterId,
            action: "View Task",
            actionUrl: "/tasks",
          });
        }
      } else if (!canManageTaskWorkspace(requesterSystemRole, (req as any).userConfiguredModules)) {
        // Employee updated status to something else (e.g., IN_PROGRESS, BLOCKED)
        await NotificationService.notifyAdminsAndManagers({
          title: "📝 Task Status Updated",
          message: `${empName} updated status of task "${row.title}" to ${sanitized.status}`,
          type: "TASK",
          priority: "LOW",
          referenceId: row.id,
          referenceType: "TASK",
          createdBy: requesterId,
          action: "View Task",
          actionUrl: "/tasks",
        }, requesterId);
      }
    }

    // 4. Due date changed
    if (sanitized.dueDate && sanitized.dueDate !== task.dueDate && row.assigneeId && row.assigneeId !== requesterId) {
      await NotificationService.createNotification({
        userId: row.assigneeId,
        title: "⏰ Task Deadline Changed",
        message: `Deadline for task "${row.title}" changed to ${sanitized.dueDate}`,
        type: "TASK",
        priority: "MEDIUM",
        referenceId: row.id,
        referenceType: "TASK",
        createdBy: requesterId,
        action: "View Task",
        actionUrl: "/tasks",
      });
    }

    // 5. Priority changed
    if (sanitized.priority && sanitized.priority !== task.priority && row.assigneeId && row.assigneeId !== requesterId) {
      await NotificationService.createNotification({
        userId: row.assigneeId,
        title: "⚡ Task Priority Updated",
        message: `Priority for task "${row.title}" was updated to ${sanitized.priority}`,
        type: "TASK",
        priority: (sanitized.priority as any) || "MEDIUM",
        referenceId: row.id,
        referenceType: "TASK",
        createdBy: requesterId,
        action: "View Task",
        actionUrl: "/tasks",
      });
    }
  } catch (err) {
    notificationLogger.error({ err }, "Error triggering task notification");
  }

  return res.json(row);
}));

router.delete("/:id", requirePermission("tasks.delete"), asyncHandler(async (req, res) => {
  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, req.params.id as string));
  if (!task) throw createError("Not found", 404);

  const requesterId = (req as any).userId;
  const requesterSystemRole = (req as any).userSystemRole;
  const isPrivileged = canManageTaskWorkspace(requesterSystemRole, (req as any).userConfiguredModules);

  if (!isPrivileged) {
    if (!canEmployeeAccessTask(task, requesterId)) {
      throw createError("Forbidden: You do not have permission to delete this task", 403);
    }
    // Only allow deletion when PENDING
    if (task.approvalStatus && task.approvalStatus !== "PENDING") {
      throw createError("Forbidden: Cannot delete task request after admin review", 403);
    }
  }

  await db.delete(tasksTable).where(eq(tasksTable.id, (req.params.id as string)));
  return res.status(204).send();
}));

// ─── Subtasks ─────────────────────────────────────────────────

router.get("/:id/subtasks", requirePermission("tasks.view"), asyncHandler(async (req, res) => {
  const requesterId = (req as any).userId;
  const requesterSystemRole = (req as any).userSystemRole;
  const isPrivileged = canManageTaskWorkspace(requesterSystemRole, (req as any).userConfiguredModules);

  if (!isPrivileged) {
    const [parentTask] = await db.select().from(tasksTable).where(eq(tasksTable.id, req.params.id as string));
    if (!parentTask || !canEmployeeAccessTask(parentTask, requesterId)) {
      throw createError("Forbidden: You do not have permission to view subtasks for this task", 403);
    }
  }

  const result = await db.execute(
    `SELECT t.*, u.name as assignee_name FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     WHERE t.parent_id = $1 ORDER BY t.created_at ASC`,
    [req.params.id]
  );
  return res.json(result.rows ?? result);
}));

export default router;
