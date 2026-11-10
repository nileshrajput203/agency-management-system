import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, projectsTable, subprojectsTable, usersTable, contentPostsTable, fileAttachmentsTable } from "@workspace/db/schema";
import { and, eq, or, sql, desc, asc, isNull, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate } from "../lib/validation";
import {
  requirePermission,
  isManagerRole,
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

function checkIsPrivileged(req: any): boolean {
  const requesterSystemRole = req.userSystemRole;
  const requesterUserRole = req.userRoleText;
  const requesterRole = req.userRole || requesterSystemRole;
  return (
    canManageTaskWorkspace(requesterSystemRole, req.userConfiguredModules, requesterUserRole) ||
    isManagerRole(requesterSystemRole) ||
    isManagerRole(requesterRole) ||
    isManagerRole(requesterUserRole) ||
    Boolean(req.userIsDelegatedAdmin)
  );
}

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
    uuids: ["projectId", "subprojectId", "assigneeId", "parentId", "requestedBy", "approvedBy", "managerApprovedBy"],
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
  const isPrivileged = checkIsPrivileged(req);

  const whereClause = !isPrivileged
    ? or(
        eq(tasksTable.assigneeId, requesterId),
        sql`${tasksTable.coAssignees}::text LIKE ${`%"${requesterId}"%`}`,
        and(
          eq(tasksTable.requestedBy, requesterId),
          eq(tasksTable.approvalStatus, "PENDING"),
        ),
      )
    : undefined;

  const rows = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      status: tasksTable.status,
      priority: tasksTable.priority,
      projectId: tasksTable.projectId,
      projectName: projectsTable.name,
      subprojectId: tasksTable.subprojectId,
      subprojectName: subprojectsTable.name,
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
    .leftJoin(subprojectsTable, eq(tasksTable.subprojectId, subprojectsTable.id))
    .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
    .leftJoin(requesterTable, eq(tasksTable.requestedBy, requesterTable.id))
    .leftJoin(approvedByTable, eq(tasksTable.approvedBy, approvedByTable.id))
    .where(whereClause)
    .orderBy(
      sql`CASE WHEN ${tasksTable.dueDate} IS NULL THEN 1 ELSE 0 END`,
      tasksTable.dueDate,
      desc(tasksTable.createdAt)
    );
  const hiddenIds = await getHiddenEntityIds(requesterId, "tasks");
  const canViewProjects =
    isManagerRole(requesterSystemRole) ||
    requesterSystemRole === "SUPER_ADMIN" ||
    Boolean((req as any).userIsDelegatedAdmin) ||
    ((req as any).userConfiguredModules || []).includes("projects");
  const scopedRows = canViewProjects
    ? rows
    : rows.map((row) => ({ ...row, projectId: null, projectName: null, subprojectId: null, subprojectName: null }));
  const visibleRows = hiddenIds.length > 0 ? scopedRows.filter((r) => !hiddenIds.includes(r.id)) : scopedRows;

  // Batch query task attachments (uploaded graphics, designs, files)
  const taskIds = visibleRows.map((r) => r.id);
  const attachments = taskIds.length > 0
    ? await db
        .select({
          id: fileAttachmentsTable.id,
          entityId: fileAttachmentsTable.entityId,
          filename: fileAttachmentsTable.filename,
          url: fileAttachmentsTable.url,
          createdAt: fileAttachmentsTable.createdAt,
        })
        .from(fileAttachmentsTable)
        .where(and(
          inArray(fileAttachmentsTable.entityType, ["task", "tasks"]),
          inArray(fileAttachmentsTable.entityId, taskIds),
        ))
    : [];
  const attMap: Record<string, any[]> = {};
  for (const a of attachments) {
    if (!attMap[a.entityId]) attMap[a.entityId] = [];
    attMap[a.entityId].push(a);
  }
  const rowsWithAttachments = visibleRows.map((r) => ({
    ...r,
    attachments: attMap[r.id] || [],
  }));

  return res.json(rowsWithAttachments);
}));

router.post("/", requirePermission("tasks.create"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeTask(body, false);
  const requesterId = (req as any).userId;
  const requesterSystemRole = (req as any).userSystemRole;
  const requesterUserRole = (req as any).userRoleText || (req as any).userRole;
  const requesterRole = (req as any).userRole || requesterSystemRole;
  const isPrivileged = checkIsPrivileged(req);

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
    } else {
      const notifyUserIds = new Set<string>();
      if (row.assigneeId && row.assigneeId !== requesterId) {
        notifyUserIds.add(row.assigneeId);
      }
      if (Array.isArray(row.coAssignees)) {
        for (const ca of row.coAssignees) {
          if (ca && typeof ca === "string" && ca !== requesterId) {
            notifyUserIds.add(ca);
          }
        }
      }
      for (const targetUid of notifyUserIds) {
        await NotificationService.createNotification({
          userId: targetUid,
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
    }
  } catch (err) {
    notificationLogger.error({ err }, "Error sending task creation notification");
  }

  return res.status(201).json(row);
}));

router.get("/:id", requirePermission("tasks.view"), asyncHandler(async (req, res) => {
  const requesterId = (req as any).userId;
  const requesterSystemRole = (req as any).userSystemRole;
  const isPrivileged = checkIsPrivileged(req);

  const [row] = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      status: tasksTable.status,
      priority: tasksTable.priority,
      projectId: tasksTable.projectId,
      projectName: projectsTable.name,
      subprojectId: tasksTable.subprojectId,
      subprojectName: subprojectsTable.name,
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
      coAssignees: tasksTable.coAssignees,
      assignmentNote: tasksTable.assignmentNote,
      parentId: tasksTable.parentId,
    })
    .from(tasksTable)
    .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
    .leftJoin(subprojectsTable, eq(tasksTable.subprojectId, subprojectsTable.id))
    .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
    .leftJoin(requesterTable, eq(tasksTable.requestedBy, requesterTable.id))
    .leftJoin(approvedByTable, eq(tasksTable.approvedBy, approvedByTable.id))
    .where(eq(tasksTable.id, (req.params.id as string)));

  if (!row) throw createError("Not found", 404);

  if (!isPrivileged && row.approvalStatus === "PENDING" && !canEmployeeAccessTask(row, requesterId)) {
    throw createError("Forbidden: You do not have permission to view this pending task request", 403);
  }

  const canViewProjects =
    isManagerRole(requesterSystemRole) ||
    requesterSystemRole === "SUPER_ADMIN" ||
    Boolean((req as any).userIsDelegatedAdmin) ||
    ((req as any).userConfiguredModules || []).includes("projects");
  const attachments = await db
    .select({
      id: fileAttachmentsTable.id,
      entityId: fileAttachmentsTable.entityId,
      filename: fileAttachmentsTable.filename,
      url: fileAttachmentsTable.url,
      createdAt: fileAttachmentsTable.createdAt,
    })
    .from(fileAttachmentsTable)
    .where(and(
      inArray(fileAttachmentsTable.entityType, ["task", "tasks"]),
      eq(fileAttachmentsTable.entityId, row.id),
    ));

  const scopedRow = canViewProjects ? row : { ...row, projectId: null, projectName: null, subprojectId: null, subprojectName: null };
  return res.json({ ...scopedRow, attachments });
}));

router.patch("/:id", requirePermission("tasks.edit"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeTask(body, true);

  const [task] = await db.select().from(tasksTable).where(eq(tasksTable.id, req.params.id as string));
  if (!task) throw createError("Not found", 404);

  const requesterId = (req as any).userId;
  const requesterSystemRole = (req as any).userSystemRole;
  const requesterUserRole = (req as any).userRoleText;
  const requesterRole = (req as any).userRole || requesterSystemRole;
  const isPrivileged = checkIsPrivileged(req);
  const canManageProjects = canManageProjectWorkspace(
    requesterSystemRole,
    (req as any).userConfiguredModules,
    requesterUserRole,
  );

  if (!isPrivileged) {
    const isPending = task.approvalStatus === "PENDING";
    const isApprovedOrModified =
      task.approvalStatus === "APPROVED" ||
      task.approvalStatus === "MODIFIED" ||
      !task.approvalStatus;

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
      // Active task: allow employee & team to update status, notes, deliverables, etc.
      // Rule 1: Done can only be selected by manager. If employee sets status to DONE/COMPLETED, redirect to IN_REVIEW
      if (sanitized.status === "DONE" || sanitized.status === "COMPLETED") {
        sanitized.status = "IN_REVIEW";
      }

      // Rule 2: If task has no assignee yet, assign to the updating team member
      if (!task.assigneeId) {
        sanitized.assigneeId = requesterId;
      }

      // Rule 3: Strip fields that employees are not allowed to change (e.g. title, priority, project, dates)
      // rather than throwing a 403 Forbidden error!
      const employeeAllowedKeys = new Set([
        "status",
        "description",
        "notes",
        "deliverables",
        "assignmentNote",
        "objective",
        "requirements",
        "assigneeId",
      ]);
      for (const key of Object.keys(sanitized)) {
        if (!employeeAllowedKeys.has(key)) {
          delete sanitized[key];
        }
      }
    } else {
      throw createError("Forbidden: Cannot modify a rejected task request", 403);
    }
  } else {
    // Admin / Manager is modifying/approving
    if (sanitized.status === "DONE" || sanitized.status === "COMPLETED") {
      if (task.approvalStatus === "PENDING" || task.approvalStatus === "MANAGER_APPROVED") {
        sanitized.approvalStatus = "APPROVED";
        sanitized.approvedBy = requesterId;
        sanitized.approvedAt = new Date();
      } else if (!task.approvalStatus) {
        sanitized.approvalStatus = "APPROVED";
      }
    }

    if (sanitized.approvalStatus !== "REJECTED") {
      if (sanitized.approvalStatus === "APPROVED" || sanitized.approvalStatus === "MODIFIED") {
        sanitized.approvedBy = requesterId;
        sanitized.approvedAt = new Date();
      } else if (sanitized.approvalStatus === "MANAGER_APPROVED") {
        sanitized.managerApprovedBy = requesterId;
        sanitized.managerApprovedAt = new Date();
      } else if (task.approvalStatus === "PENDING" && (sanitized.status === "TODO" || sanitized.status === "IN_PROGRESS")) {
        sanitized.approvalStatus = "APPROVED";
        sanitized.approvedBy = requesterId;
        sanitized.approvedAt = new Date();
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

  // Bi-directional Auto-Sync with Content Studio
  try {
    const [linkedPost] = await db
      .select({ id: contentPostsTable.id, status: contentPostsTable.status })
      .from(contentPostsTable)
      .where(eq(contentPostsTable.linkedTaskId, row.id));

    if (linkedPost) {
      if (row.status === "IN_REVIEW" && linkedPost.status !== "IN_REVIEW") {
        await db.update(contentPostsTable).set({ status: "IN_REVIEW" }).where(eq(contentPostsTable.id, linkedPost.id));
      } else if ((row.status === "DONE" || row.status === "COMPLETED") && linkedPost.status !== "ADMIN_APPROVED" && linkedPost.status !== "PUBLISHED") {
        await db.update(contentPostsTable).set({ status: "ADMIN_APPROVED" }).where(eq(contentPostsTable.id, linkedPost.id));
      } else if (row.status === "IN_PROGRESS" && linkedPost.status === "IN_REVIEW") {
        await db.update(contentPostsTable).set({ status: "PRODUCTION" }).where(eq(contentPostsTable.id, linkedPost.id));
      }
    }
  } catch (syncPostErr) {
    logger.warn({ syncPostErr }, "Failed to sync task status back to linked content post");
  }

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

    // 1. Assignee or co-assignees changed — notify team members
    const notifyAssignees = new Set<string>();
    if (row.assigneeId && row.assigneeId !== task.assigneeId && row.assigneeId !== requesterId) {
      notifyAssignees.add(row.assigneeId);
    }
    const oldCo = new Set(Array.isArray(task.coAssignees) ? (task.coAssignees as string[]) : []);
    const newCo = Array.isArray(row.coAssignees) ? (row.coAssignees as string[]) : [];
    for (const ca of newCo) {
      if (ca && typeof ca === "string" && !oldCo.has(ca) && ca !== requesterId) {
        notifyAssignees.add(ca);
      }
    }
    for (const uid of notifyAssignees) {
      await NotificationService.createNotification({
        userId: uid,
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
      } else if (task.status === "IN_REVIEW" && sanitized.status === "IN_PROGRESS") {
        // Manager requested revisions / rejected work from review
        if (row.assigneeId && row.assigneeId !== requesterId) {
          const reasonText = sanitized.rejectionReason || sanitized.notes || sanitized.assignmentNote;
          await NotificationService.createNotification({
            userId: row.assigneeId,
            title: "⚠️ Task Revisions Requested",
            message: `${empName} requested changes on "${row.title}"${reasonText ? `: "${reasonText}"` : ". Please review the feedback and resubmit."}`,
            type: "TASK",
            priority: "HIGH",
            referenceId: row.id,
            referenceType: "TASK",
            createdBy: requesterId,
            action: "Update Task",
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

        // Notify assignee if approved/completed by manager/admin
        if (row.assigneeId && row.assigneeId !== requesterId) {
          await NotificationService.createNotification({
            userId: row.assigneeId,
            title: "✅ Task Approved & Completed",
            message: `Your task "${row.title}" has been approved by ${empName} and marked as completed`,
            type: "TASK",
            priority: "HIGH",
            referenceId: row.id,
            referenceType: "TASK",
            createdBy: requesterId,
            action: "View Task",
            actionUrl: "/tasks",
          });
        }

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
      } else if (sanitized.status === "IN_PROGRESS" && task.status === "IN_REVIEW") {
        // Manager requested changes / sent back to In Progress
        if (row.assigneeId && row.assigneeId !== requesterId) {
          await NotificationService.createNotification({
            userId: row.assigneeId,
            title: "🔄 Changes Requested on Task",
            message: `${empName} requested changes on your task "${row.title}". Please review and update.`,
            type: "TASK",
            priority: "HIGH",
            referenceId: row.id,
            referenceType: "TASK",
            createdBy: requesterId,
            action: "View Task",
            actionUrl: "/tasks",
          });
        }
      } else if (!canManageTaskWorkspace(requesterSystemRole, (req as any).userConfiguredModules, requesterUserRole)) {
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
  const isPrivileged = checkIsPrivileged(req);

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
  const isPrivileged = checkIsPrivileged(req);

  if (!isPrivileged) {
    const [parentTask] = await db.select().from(tasksTable).where(eq(tasksTable.id, req.params.id as string));
    if (!parentTask || !canEmployeeAccessTask(parentTask, requesterId)) {
      throw createError("Forbidden: You do not have permission to view subtasks for this task", 403);
    }
  }

  const subtasks = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      description: tasksTable.description,
      status: tasksTable.status,
      priority: tasksTable.priority,
      projectId: tasksTable.projectId,
      assigneeId: tasksTable.assigneeId,
      assigneeName: usersTable.name,
      parentId: tasksTable.parentId,
      coAssignees: tasksTable.coAssignees,
      startDate: tasksTable.startDate,
      dueDate: tasksTable.dueDate,
      approvalStatus: tasksTable.approvalStatus,
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt,
    })
    .from(tasksTable)
    .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
    .where(and(eq(tasksTable.parentId, req.params.id as string), isNull(tasksTable.deletedAt)))
    .orderBy(asc(tasksTable.createdAt));

  return res.json(subtasks);
}));

// ─── POST /api/tasks/notify-daily-summary ────────────────────────
// Dispatches notification of all today's tasks and pending workload to Admins & Managers
router.post("/notify-daily-summary", requirePermission("tasks.view"), asyncHandler(async (_req, res) => {
  const allTasks = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      status: tasksTable.status,
      dueDate: tasksTable.dueDate,
      assigneeId: tasksTable.assigneeId,
      assigneeName: usersTable.name,
    })
    .from(tasksTable)
    .leftJoin(usersTable, eq(tasksTable.assigneeId, usersTable.id))
    .where(isNull(tasksTable.deletedAt));

  const todayStr = new Date().toISOString().split("T")[0];
  const todaysTasks = allTasks.filter((t) => {
    if (t.status === "DONE" || t.status === "COMPLETED") return false;
    if (!t.dueDate) return false;
    const dueStr = t.dueDate instanceof Date ? t.dueDate.toISOString().split("T")[0] : String(t.dueDate).split("T")[0];
    return dueStr === todayStr;
  });

  const pendingOverdueTasks = allTasks.filter((t) => {
    if (t.status === "DONE" || t.status === "COMPLETED") return false;
    if (!t.dueDate) return false;
    const dueStr = t.dueDate instanceof Date ? t.dueDate.toISOString().split("T")[0] : String(t.dueDate).split("T")[0];
    return dueStr < todayStr;
  });

  // Group by employee
  const employeeCountMap: Record<string, number> = {};
  todaysTasks.forEach((t) => {
    const name = t.assigneeName || "Unassigned";
    employeeCountMap[name] = (employeeCountMap[name] || 0) + 1;
  });

  const breakdown = Object.entries(employeeCountMap)
    .map(([emp, count]) => `${emp}: ${count}`)
    .join(", ");

  await NotificationService.notifyAdminsAndManagers({
    type: "DAILY_TASKS_ALERT",
    priority: "HIGH",
    title: `📋 Daily Tasks Briefing (${todaysTasks.length} tasks today)`,
    message: todaysTasks.length > 0
      ? `Today's Tasks: ${breakdown || `${todaysTasks.length} total`}. ${pendingOverdueTasks.length > 0 ? `(${pendingOverdueTasks.length} overdue tasks require attention).` : ""}`
      : `No tasks due today. ${pendingOverdueTasks.length} pending/overdue task(s) in queue.`,
    actionUrl: "/tasks",
  });

  return res.json({
    success: true,
    totalToday: todaysTasks.length,
    totalOverdue: pendingOverdueTasks.length,
    todaysTasks,
  });
}));

export default router;
