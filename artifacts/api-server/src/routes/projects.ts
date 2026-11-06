import { Router } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  subprojectsTable,
  clientsTable,
  usersTable,
  notifications,
  projectRequestsTable,
  projectMilestonesTable,
} from "@workspace/db/schema";
import { eq, aliasedTable, sql, desc, asc, and } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate } from "../lib/validation";
import { requirePermission, requireAnyPermission, canManageProjectWorkspace } from "../middleware/auth";
import { NotificationService } from "../services/notificationService";

const router = Router();

const assignedUserTable = aliasedTable(usersTable, "assignedUser");

function sanitizeProject(body: any, isUpdate = false) {
  const {
    id,
    createdAt,
    updatedAt,
    createdBy,
    updatedBy,
    deletedAt,
    clientName,
    assignedEmployeeName,
    taskCount,
    completedTaskCount,
    ...rest
  } = body || {};

  if (!isUpdate && (!rest.name || typeof rest.name !== "string" || rest.name.trim() === "")) {
    throw createError("Project name is required", 400, undefined, "name");
  }
  if (isUpdate && rest.name !== undefined) {
    if (typeof rest.name !== "string" || rest.name.trim() === "") {
      throw createError("Project name cannot be empty", 400, undefined, "name");
    }
  }

  if (rest.endDate && !rest.dueDate) {
    rest.dueDate = rest.endDate;
  }

  const result = sanitizeAndValidate(rest, {
    uuids: ["clientId", "assignedTo"],
    dates: ["startDate", "dueDate", "endDate", "assignmentActionAt", "startedAt", "completedAt"],
    enums: {
      status: ["NOT_STARTED", "PLANNING", "IN_PROGRESS", "UNDER_REVIEW", "COMPLETED", "ON_HOLD", "CANCELLED"],
      priority: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      assignmentStatus: ["PENDING", "ACCEPTED", "REJECTED", "pending", "accepted", "rejected"],
    },
  });
  if (rest.coAssignees !== undefined) {
    result.coAssignees = Array.isArray(rest.coAssignees) ? rest.coAssignees : [];
  }
  return result;
}

router.get("/", requirePermission("projects.view"), asyncHandler(async (req, res) => {
  const userId = (req as any).userId;

  const query = db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      status: projectsTable.status,
      priority: projectsTable.priority,
      clientId: projectsTable.clientId,
      clientName: clientsTable.companyName,
      startDate: projectsTable.startDate,
      dueDate: projectsTable.dueDate,
      description: projectsTable.description,
      startedAt: projectsTable.startedAt,
      completedAt: projectsTable.completedAt,
      completionNotes: projectsTable.completionNotes,
      completionPercentage: projectsTable.completionPercentage,
      activityTimeline: projectsTable.activityTimeline,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
      createdBy: projectsTable.createdBy,
      assignedTo: projectsTable.assignedTo,
      coAssignees: projectsTable.coAssignees,
      assignedEmployeeName: assignedUserTable.name,
      assignmentStatus: projectsTable.assignmentStatus,
      assignmentDescription: projectsTable.assignmentDescription,
      rejectionReason: projectsTable.rejectionReason,
      assignmentActionAt: projectsTable.assignmentActionAt,
    })
    .from(projectsTable)
    .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
    .leftJoin(assignedUserTable, eq(projectsTable.assignedTo, assignedUserTable.id))
    .orderBy(
      sql`CASE WHEN ${projectsTable.dueDate} IS NULL THEN 1 ELSE 0 END`,
      projectsTable.dueDate,
      desc(projectsTable.createdAt)
    );

  const rows = await query;
  return res.json(rows);
}));

router.post("/", requirePermission("projects.create"), asyncHandler(async (req, res) => {
  const systemRole = (req as any).userSystemRole;
  if (!canManageProjectWorkspace(systemRole, (req as any).userConfiguredModules)) {
    throw createError("Forbidden: Employees cannot create projects", 403);
  }

  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeProject(body, false);

  if (sanitized.assignedTo && !sanitized.assignmentStatus) {
    sanitized.assignmentStatus = "PENDING";
  }

  const requesterId = (req as any).userId;
  const [row] = await db.insert(projectsTable).values({ ...sanitized, createdBy: requesterId }).returning();

  if (row) {
    try {
      const [creator] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, requesterId));
      const creatorName = creator?.name || "A user";

      // 1. Notify assigned user if assignedTo is set and different from creator
      if (row.assignedTo && row.assignedTo !== requesterId) {
        await NotificationService.createNotification({
          userId: row.assignedTo,
          title: "📁 New Project Assigned",
          message: `${creatorName} assigned you to the project "${row.name}".`,
          type: "PROJECT",
          priority: (row.priority as any) || "HIGH",
          referenceId: row.id,
          referenceType: "PROJECT",
          createdBy: requesterId,
          action: "PROJECT_ASSIGNED",
          actionUrl: `/projects/${row.id}`,
        });
      }

      // 2. Notify Admins and Managers about project creation
      await NotificationService.notifyAdminsAndManagers({
        title: "📁 New Project Created",
        message: `${creatorName} created project "${row.name}".`,
        type: "PROJECT",
        priority: (row.priority as any) || "MEDIUM",
        referenceId: row.id,
        referenceType: "PROJECT",
        createdBy: requesterId,
        action: "PROJECT_CREATED",
        actionUrl: `/projects/${row.id}`,
      });
    } catch (e) {
      console.warn("Failed to create project creation notification:", e);
    }
  }

  return res.status(201).json(row);
}));

router.get("/:id", requirePermission("projects.view"), asyncHandler(async (req, res) => {
  const [row] = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      status: projectsTable.status,
      priority: projectsTable.priority,
      clientId: projectsTable.clientId,
      clientName: clientsTable.companyName,
      startDate: projectsTable.startDate,
      dueDate: projectsTable.dueDate,
      description: projectsTable.description,
      startedAt: projectsTable.startedAt,
      completedAt: projectsTable.completedAt,
      completionNotes: projectsTable.completionNotes,
      completionPercentage: projectsTable.completionPercentage,
      activityTimeline: projectsTable.activityTimeline,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
      createdBy: projectsTable.createdBy,
      assignedTo: projectsTable.assignedTo,
      coAssignees: projectsTable.coAssignees,
      assignedEmployeeName: assignedUserTable.name,
      assignmentStatus: projectsTable.assignmentStatus,
      assignmentDescription: projectsTable.assignmentDescription,
      rejectionReason: projectsTable.rejectionReason,
      assignmentActionAt: projectsTable.assignmentActionAt,
    })
    .from(projectsTable)
    .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
    .leftJoin(assignedUserTable, eq(projectsTable.assignedTo, assignedUserTable.id))
    .where(eq(projectsTable.id, (req.params.id as string)));
  if (!row) throw createError("Not found", 404);
  return res.json(row);
}));

router.patch("/:id", requirePermission("projects.edit"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeProject(body, true);

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.id as string));
  if (!project) throw createError("Not found", 404);

  const requesterId = (req as any).userId;
  const requesterRole = (req as any).userRole;
  const systemRole = (req as any).userSystemRole;
  const isPrivileged = canManageProjectWorkspace(systemRole, (req as any).userConfiguredModules);

  if (!isPrivileged) {
    // Employees can update assignmentStatus, status, completionNotes, completionPercentage, startedAt, completedAt, activityTimeline
    const allowedKeys = [
      "id", "_id", "assignmentStatus", "rejectionReason", "status", "completionNotes",
      "completionPercentage", "startedAt", "completedAt", "activityTimeline"
    ];
    const modifiedKeys = Object.keys(body).filter(k => body[k] !== undefined);
    const hasForbiddenKey = modifiedKeys.some(k => !allowedKeys.includes(k));

    if (hasForbiddenKey) {
      throw createError("Forbidden: Employees cannot directly edit project metadata (client, assigned employee, due dates).", 403);
    }

    const [updaterUserCheck] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, requesterId));
    const isAssigned =
      !project.assignedTo ||
      project.assignedTo === requesterId ||
      (updaterUserCheck?.name && project.assignedTo.toLowerCase() === updaterUserCheck.name.toLowerCase()) ||
      (Array.isArray((project as any).coAssignees) && (project as any).coAssignees.includes(requesterId)) ||
      (Array.isArray((project as any).teamMembers) && (project as any).teamMembers.includes(requesterId));

    if (!isAssigned) {
      throw createError("Forbidden: You are not assigned to this project.", 403);
    }
  }

  const [updaterUser] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, requesterId));
  const updaterName = updaterUser?.name || "User";

  // Build / update activity timeline
  let timeline: any[] = Array.isArray(project.activityTimeline) ? [...(project.activityTimeline as any[])] : [];

  // 1. If project was just created or assigned and has no timeline, add assigned event
  if (timeline.length === 0 && project.createdAt) {
    timeline.push({
      id: crypto.randomUUID(),
      type: "ASSIGNED",
      actorId: project.assignedTo || requesterId,
      actorName: project.assignedTo ? "System" : updaterName,
      message: "Project assigned",
      timestamp: new Date(project.createdAt).toISOString(),
    });
  }

  // Handle status transitions & updates
  if (sanitized.status && sanitized.status !== project.status) {
    if (sanitized.status === "IN_PROGRESS") {
      if (!sanitized.startedAt && !project.startedAt) {
        sanitized.startedAt = new Date();
      }
      if (sanitized.completionPercentage === undefined && (!project.completionPercentage || project.completionPercentage === 0)) {
        sanitized.completionPercentage = 25;
      }
      timeline.push({
        id: crypto.randomUUID(),
        type: "STARTED",
        actorId: requesterId,
        actorName: updaterName,
        message: `${updaterName} started project`,
        timestamp: new Date().toISOString(),
      });
    } else if (sanitized.status === "COMPLETED") {
      sanitized.completedAt = new Date();
      sanitized.completionPercentage = 100;
      if (body.completionNotes !== undefined) {
        sanitized.completionNotes = body.completionNotes;
      }
      timeline.push({
        id: crypto.randomUUID(),
        type: "COMPLETED",
        actorId: requesterId,
        actorName: updaterName,
        message: `${updaterName} marked project as COMPLETED`,
        notes: sanitized.completionNotes || project.completionNotes || "",
        timestamp: new Date().toISOString(),
      });
    } else if (project.status === "COMPLETED" && (sanitized.status === "IN_PROGRESS" || sanitized.status === "PLANNING" || sanitized.status === "NOT_STARTED")) {
      sanitized.completedAt = null;
      if (sanitized.completionPercentage === undefined) {
        sanitized.completionPercentage = 25;
      }
      timeline.push({
        id: crypto.randomUUID(),
        type: "REOPENED",
        actorId: requesterId,
        actorName: updaterName,
        message: `${updaterName} reopened project`,
        timestamp: new Date().toISOString(),
      });
    } else {
      timeline.push({
        id: crypto.randomUUID(),
        type: "STATUS_CHANGED",
        actorId: requesterId,
        actorName: updaterName,
        message: `${updaterName} updated status to ${sanitized.status.replace("_", " ")}`,
        timestamp: new Date().toISOString(),
      });
    }
  } else if (body.completionNotes !== undefined && body.completionNotes !== project.completionNotes) {
    sanitized.completionNotes = body.completionNotes;
    timeline.push({
      id: crypto.randomUUID(),
      type: "NOTES_UPDATED",
      actorId: requesterId,
      actorName: updaterName,
      message: `${updaterName} updated completion notes`,
      notes: body.completionNotes,
      timestamp: new Date().toISOString(),
    });
  } else if (sanitized.completionPercentage !== undefined && sanitized.completionPercentage !== project.completionPercentage) {
    timeline.push({
      id: crypto.randomUUID(),
      type: "PROGRESS_UPDATED",
      actorId: requesterId,
      actorName: updaterName,
      message: `${updaterName} updated progress to ${sanitized.completionPercentage}%`,
      timestamp: new Date().toISOString(),
    });
  }

  sanitized.activityTimeline = timeline;

  // Handle assignment status normalization & mandatory rejection reason validation
  if (sanitized.assignmentStatus) {
    const upperStatus = String(sanitized.assignmentStatus).toUpperCase();
    sanitized.assignmentStatus = upperStatus;
    
    if (upperStatus === "REJECTED") {
      const reason = sanitized.rejectionReason || body.rejectionReason;
      if (!reason || typeof reason !== "string" || reason.trim() === "") {
        throw createError("Rejection reason is mandatory", 400, undefined, "rejectionReason");
      }
      sanitized.rejectionReason = reason.trim();
    }
    sanitized.assignmentActionAt = new Date();
  }

  // If assignedTo is newly set or changed by Admin, set status to PENDING
  if (sanitized.assignedTo !== undefined && sanitized.assignedTo !== project.assignedTo) {
    if (sanitized.assignedTo) {
      sanitized.assignmentStatus = "PENDING";
      sanitized.rejectionReason = null;
      sanitized.assignmentActionAt = new Date();
    }
  }

  const [row] = await db
    .update(projectsTable)
    .set({ ...sanitized, updatedBy: requesterId, updatedAt: new Date() })
    .where(eq(projectsTable.id, (req.params.id as string)))
    .returning();

  if (!row) throw createError("Not found", 404);

  // Handle notifications
  try {
    const [updater] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, requesterId));
    const updaterName = updater?.name || "A user";

    // 1. If assignedTo changed or newly set
    if (sanitized.assignedTo !== undefined && sanitized.assignedTo !== project.assignedTo) {
      if (sanitized.assignedTo && sanitized.assignedTo !== requesterId) {
        await NotificationService.createNotification({
          userId: sanitized.assignedTo,
          title: "📁 Project Assigned",
          message: `${updaterName} assigned you to the project "${row.name}".`,
          type: "PROJECT",
          priority: "HIGH",
          referenceId: row.id,
          referenceType: "PROJECT",
          createdBy: requesterId,
          action: "PROJECT_ASSIGNED",
          actionUrl: `/projects/${row.id}`,
        });
      }

      const [assignedEmp] = sanitized.assignedTo
        ? await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, sanitized.assignedTo))
        : [null];
      const assignedEmpName = assignedEmp?.name || "an employee";

      await NotificationService.notifyAdminsAndManagers({
        title: "📁 Project Assigned",
        message: sanitized.assignedTo
          ? `${updaterName} assigned ${assignedEmpName} to the project "${row.name}".`
          : `${updaterName} unassigned the project "${row.name}".`,
        type: "PROJECT",
        priority: "MEDIUM",
        referenceId: row.id,
        referenceType: "PROJECT",
        createdBy: requesterId,
        action: "PROJECT_ASSIGNED",
        actionUrl: `/projects/${row.id}`,
      });
    }

    // 2. If employee accepted or rejected
    if (sanitized.assignmentStatus && (sanitized.assignmentStatus === "ACCEPTED" || sanitized.assignmentStatus === "REJECTED")) {
      const isAccepted = sanitized.assignmentStatus === "ACCEPTED";
      const title = isAccepted ? "✅ Project Assignment Accepted" : "❌ Project Assignment Rejected";
      const message = isAccepted
        ? `${updaterName} accepted the project assignment for '${row.name}'.`
        : `${updaterName} rejected project '${row.name}'. Reason: ${sanitized.rejectionReason || "No reason specified"}`;

      await NotificationService.notifyAdminsAndManagers({
        title,
        message,
        type: "PROJECT",
        priority: isAccepted ? "MEDIUM" : "HIGH",
        referenceId: row.id,
        referenceType: "PROJECT",
        createdBy: requesterId,
        action: isAccepted ? "PROJECT_APPROVED" : "PROJECT_REJECTED",
        actionUrl: `/projects/${row.id}`,
      });

      if (project.createdBy && project.createdBy !== requesterId) {
        await NotificationService.createNotification({
          userId: project.createdBy,
          title,
          message,
          type: "PROJECT",
          priority: isAccepted ? "MEDIUM" : "HIGH",
          referenceId: row.id,
          referenceType: "PROJECT",
          createdBy: requesterId,
          action: isAccepted ? "PROJECT_APPROVED" : "PROJECT_REJECTED",
          actionUrl: `/projects/${row.id}`,
        });
      }
    }

    // 3. Status Changed
    if (sanitized.status && sanitized.status !== project.status) {
      let statusTitle = "📝 Project Status Changed";
      let statusMsg = `${updaterName} changed status of project "${row.name}" to ${sanitized.status.replace("_", " ")}.`;
      let statusAction = "PROJECT_STATUS_CHANGED";
      let statusPriority: "LOW" | "MEDIUM" | "HIGH" | "URGENT" = "MEDIUM";

      if (sanitized.status === "UNDER_REVIEW") {
        statusTitle = "⏳ Project Submitted for Review";
        statusMsg = `${updaterName} submitted project "${row.name}" for review.`;
        statusAction = "PROJECT_SUBMITTED";
        statusPriority = "HIGH";
      } else if (sanitized.status === "COMPLETED") {
        statusTitle = "🎉 Project Completed";
        statusMsg = `${updaterName} marked project "${row.name}" as COMPLETED.`;
        statusAction = "PROJECT_COMPLETED";
        statusPriority = "HIGH";
      } else if (
        (project.status === "COMPLETED" || project.status === "CANCELLED" || project.status === "ON_HOLD") &&
        (sanitized.status === "IN_PROGRESS" || sanitized.status === "PLANNING" || sanitized.status === "NOT_STARTED")
      ) {
        statusTitle = "🔄 Project Reopened";
        statusMsg = `${updaterName} reopened project "${row.name}".`;
        statusAction = "PROJECT_REOPENED";
        statusPriority = "HIGH";
      } else if (project.status === "UNDER_REVIEW" && (sanitized.status === "IN_PROGRESS" || sanitized.status === "COMPLETED")) {
        statusTitle = "✅ Project Approved";
        statusMsg = `${updaterName} approved project "${row.name}".`;
        statusAction = "PROJECT_APPROVED";
        statusPriority = "HIGH";
      } else if (project.status === "UNDER_REVIEW" && (sanitized.status === "CANCELLED" || sanitized.status === "ON_HOLD")) {
        statusTitle = "❌ Project Rejected";
        statusMsg = `${updaterName} rejected project "${row.name}".`;
        statusAction = "PROJECT_REJECTED";
        statusPriority = "HIGH";
      }

      await NotificationService.notifyAdminsAndManagers({
        title: statusTitle,
        message: statusMsg,
        type: "PROJECT",
        priority: statusPriority,
        referenceId: row.id,
        referenceType: "PROJECT",
        createdBy: requesterId,
        action: statusAction,
        actionUrl: `/projects/${row.id}`,
      });

      const extraNotify = new Set<string>();
      if (row.assignedTo) extraNotify.add(row.assignedTo);
      if (project.createdBy) extraNotify.add(project.createdBy);
      extraNotify.delete(requesterId);

      for (const targetId of extraNotify) {
        await NotificationService.createNotification({
          userId: targetId,
          title: statusTitle,
          message: statusMsg,
          type: "PROJECT",
          priority: statusPriority,
          referenceId: row.id,
          referenceType: "PROJECT",
          createdBy: requesterId,
          action: statusAction,
          actionUrl: `/projects/${row.id}`,
        });
      }
    }

    // 4. Completion notes updated
    if (body.completionNotes !== undefined && body.completionNotes !== project.completionNotes && (!sanitized.status || sanitized.status === project.status)) {
      await NotificationService.notifyAdminsAndManagers({
        title: "📝 Completion Notes Updated",
        message: `${updaterName} updated completion notes for project "${row.name}".`,
        type: "PROJECT",
        priority: "MEDIUM",
        referenceId: row.id,
        referenceType: "PROJECT",
        createdBy: requesterId,
        action: "PROJECT_STATUS_CHANGED",
        actionUrl: `/projects/${row.id}`,
      });
    } else if (
      (requesterRole === "EMPLOYEE" || (sanitized.dueDate && sanitized.dueDate !== project.dueDate)) &&
      !sanitized.assignmentStatus
    ) {
      // 4. Employee updated project or deadline changed without status change
      const isDeadlineChange = sanitized.dueDate && sanitized.dueDate !== project.dueDate;
      const title = isDeadlineChange ? "⏰ Project Deadline Changed" : "📁 Project Updated";
      const message = isDeadlineChange
        ? `${updaterName} updated deadline for project "${row.name}".`
        : `${updaterName} updated project "${row.name}".`;

      await NotificationService.notifyAdminsAndManagers({
        title,
        message,
        type: "PROJECT",
        priority: "MEDIUM",
        referenceId: row.id,
        referenceType: "PROJECT",
        createdBy: requesterId,
        action: "PROJECT_UPDATED",
        actionUrl: `/projects/${row.id}`,
      });

      if (row.assignedTo && row.assignedTo !== requesterId) {
        await NotificationService.createNotification({
          userId: row.assignedTo,
          title,
          message,
          type: "PROJECT",
          priority: "MEDIUM",
          referenceId: row.id,
          referenceType: "PROJECT",
          createdBy: requesterId,
          action: "PROJECT_UPDATED",
          actionUrl: `/projects/${row.id}`,
        });
      }
    }
  } catch (e) {
    console.warn("Error sending project notification:", e);
  }

  return res.json(row);
}));

router.delete("/:id", requirePermission("projects.delete"), asyncHandler(async (req, res) => {
  const systemRole = (req as any).userSystemRole;
  if (!canManageProjectWorkspace(systemRole, (req as any).userConfiguredModules)) {
    throw createError("Forbidden: Employees cannot delete projects", 403);
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, req.params.id as string));
  const requesterId = (req as any).userId;

  await db.delete(projectsTable).where(eq(projectsTable.id, (req.params.id as string)));

  if (project) {
    try {
      const [deleter] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, requesterId));
      const deleterName = deleter?.name || "A user";

      await NotificationService.notifyAdminsAndManagers({
        title: "🗑️ Project Deleted",
        message: `${deleterName} deleted project "${project.name}".`,
        type: "PROJECT",
        priority: "HIGH",
        referenceId: project.id,
        referenceType: "PROJECT",
        createdBy: requesterId,
        action: "PROJECT_UPDATED",
        actionUrl: "/projects",
      });

      if (project.assignedTo && project.assignedTo !== requesterId) {
        await NotificationService.createNotification({
          userId: project.assignedTo,
          title: "🗑️ Project Deleted",
          message: `${deleterName} deleted project "${project.name}".`,
          type: "PROJECT",
          priority: "HIGH",
          referenceId: project.id,
          referenceType: "PROJECT",
          createdBy: requesterId,
          action: "PROJECT_UPDATED",
          actionUrl: "/projects",
        });
      }
    } catch (e) {
      console.warn("Failed to send project deletion notification:", e);
    }
  }

  return res.status(204).send();
}));

// ─── Subprojects API Endpoints ─────────────────────────────────

function sanitizeSubproject(body: any, isUpdate = false) {
  const { id, createdAt, updatedAt, createdBy, updatedBy, ...rest } = body || {};

  if (!isUpdate && (!rest.name || typeof rest.name !== "string" || rest.name.trim() === "")) {
    throw createError("Subproject name is required", 400, undefined, "name");
  }
  if (isUpdate && rest.name !== undefined) {
    if (typeof rest.name !== "string" || rest.name.trim() === "") {
      throw createError("Subproject name cannot be empty", 400, undefined, "name");
    }
  }

  return sanitizeAndValidate(rest, {
    uuids: ["assignedTo"],
    dates: ["startDate", "dueDate"],
    enums: {
      status: ["NOT_STARTED", "PLANNING", "IN_PROGRESS", "UNDER_REVIEW", "COMPLETED", "ON_HOLD", "CANCELLED"],
      priority: ["LOW", "MEDIUM", "HIGH", "URGENT"],
    },
  });
}

// Get all subprojects across all projects
router.get("/subprojects", requireAnyPermission("projects.view", "tasks.view", "tasks.create", "tasks.edit"), asyncHandler(async (req, res) => {
  const { projectId } = req.query as { projectId?: string };
  const conditions = projectId && projectId !== "all" && projectId !== "none"
    ? [eq(subprojectsTable.projectId, projectId)]
    : [];

  const subprojects = await db
    .select({
      id: subprojectsTable.id,
      projectId: subprojectsTable.projectId,
      projectName: projectsTable.name,
      name: subprojectsTable.name,
      status: subprojectsTable.status,
      priority: subprojectsTable.priority,
      description: subprojectsTable.description,
      objective: subprojectsTable.objective,
      requirements: subprojectsTable.requirements,
      deliverables: subprojectsTable.deliverables,
      notes: subprojectsTable.notes,
      startDate: subprojectsTable.startDate,
      dueDate: subprojectsTable.dueDate,
      assignedTo: subprojectsTable.assignedTo,
      assignedEmployeeName: assignedUserTable.name,
      createdAt: subprojectsTable.createdAt,
      updatedAt: subprojectsTable.updatedAt,
      createdBy: subprojectsTable.createdBy,
    })
    .from(subprojectsTable)
    .leftJoin(projectsTable, eq(subprojectsTable.projectId, projectsTable.id))
    .leftJoin(assignedUserTable, eq(subprojectsTable.assignedTo, assignedUserTable.id))
    .where(conditions.length > 0 ? conditions[0] : undefined);

  return res.json(subprojects);
}));

// Get subprojects for a project
router.get("/:id/subprojects", requireAnyPermission("projects.view", "tasks.view", "tasks.create", "tasks.edit"), asyncHandler(async (req, res) => {
  const projectId = req.params.id as string;
  const conditions = projectId === "all" ? [] : [eq(subprojectsTable.projectId, projectId)];

  const subprojects = await db
    .select({
      id: subprojectsTable.id,
      projectId: subprojectsTable.projectId,
      projectName: projectsTable.name,
      name: subprojectsTable.name,
      status: subprojectsTable.status,
      priority: subprojectsTable.priority,
      description: subprojectsTable.description,
      objective: subprojectsTable.objective,
      requirements: subprojectsTable.requirements,
      deliverables: subprojectsTable.deliverables,
      notes: subprojectsTable.notes,
      startDate: subprojectsTable.startDate,
      dueDate: subprojectsTable.dueDate,
      assignedTo: subprojectsTable.assignedTo,
      assignedEmployeeName: assignedUserTable.name,
      createdAt: subprojectsTable.createdAt,
      updatedAt: subprojectsTable.updatedAt,
      createdBy: subprojectsTable.createdBy,
    })
    .from(subprojectsTable)
    .leftJoin(projectsTable, eq(subprojectsTable.projectId, projectsTable.id))
    .leftJoin(assignedUserTable, eq(subprojectsTable.assignedTo, assignedUserTable.id))
    .where(conditions.length > 0 ? conditions[0] : undefined);

  return res.json(subprojects);
}));

// Create subproject inside a project
router.post("/:id/subprojects", requirePermission("projects.create"), asyncHandler(async (req, res) => {
  const projectId = req.params.id as string;
  
  // Verify project exists
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) throw createError("Parent project not found", 404);

  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeSubproject(body, false);
  const requesterId = (req as any).userId;

  const [row] = await db
    .insert(subprojectsTable)
    .values({ ...sanitized, projectId, createdBy: requesterId })
    .returning();

  return res.status(201).json(row);
}));

// Update subproject
router.patch("/:projectId/subprojects/:subprojectId", requirePermission("projects.edit"), asyncHandler(async (req, res) => {
  const { subprojectId } = req.params;
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeSubproject(body, true);
  const requesterId = (req as any).userId;

  const [existing] = await db.select().from(subprojectsTable).where(eq(subprojectsTable.id, subprojectId as string));
  if (!existing) throw createError("Subproject not found", 404);

  const [row] = await db
    .update(subprojectsTable)
    .set({ ...sanitized, updatedBy: requesterId, updatedAt: new Date() })
    .where(eq(subprojectsTable.id, subprojectId as string))
    .returning();

  return res.json(row);
}));

// Delete subproject
router.delete("/:projectId/subprojects/:subprojectId", requirePermission("projects.delete"), asyncHandler(async (req, res) => {
  const { subprojectId } = req.params;

  const [existing] = await db.select().from(subprojectsTable).where(eq(subprojectsTable.id, subprojectId as string));
  if (!existing) throw createError("Subproject not found", 404);

  await db.delete(subprojectsTable).where(eq(subprojectsTable.id, subprojectId as string));

  return res.status(204).send();
}));

// ==========================================
// PROJECT MILESTONES (PROGRESS & DELIVERABLE GATES)
// ==========================================

// GET /api/projects/:id/milestones — get milestones for project
router.get("/:id/milestones", requirePermission("projects.view"), asyncHandler(async (req, res) => {
  const projectId = req.params.id as string;
  const rows = await db
    .select()
    .from(projectMilestonesTable)
    .where(eq(projectMilestonesTable.projectId, projectId))
    .orderBy(asc(projectMilestonesTable.orderIndex), asc(projectMilestonesTable.createdAt));

  return res.json(rows);
}));

// POST /api/projects/:id/milestones — create milestone
router.post("/:id/milestones", requirePermission("projects.edit"), asyncHandler(async (req, res) => {
  const projectId = req.params.id as string;
  const { title, description, dueDate, orderIndex = 0 } = req.body || {};

  if (!title || typeof title !== "string" || !title.trim()) {
    throw createError("Milestone title is required", 400);
  }

  const [milestone] = await db
    .insert(projectMilestonesTable)
    .values({
      projectId,
      title: title.trim(),
      description: description || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      orderIndex: Number(orderIndex) || 0,
      status: "PENDING",
    })
    .returning();

  return res.status(201).json(milestone);
}));

// PATCH /api/projects/:projectId/milestones/:milestoneId — update milestone
router.patch("/:projectId/milestones/:milestoneId", requirePermission("projects.edit"), asyncHandler(async (req, res) => {
  const milestoneId = req.params.milestoneId as string;
  const { title, description, dueDate, status, orderIndex } = req.body || {};

  const completedAt = status === "COMPLETED" ? new Date() : null;

  const [updated] = await db
    .update(projectMilestonesTable)
    .set({
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(status !== undefined && { status }),
      ...(status !== undefined && { completedAt }),
      ...(orderIndex !== undefined && { orderIndex: Number(orderIndex) }),
      updatedAt: new Date(),
    })
    .where(eq(projectMilestonesTable.id, milestoneId))
    .returning();

  if (!updated) throw createError("Milestone not found", 404);
  return res.json(updated);
}));

// DELETE /api/projects/:projectId/milestones/:milestoneId — delete milestone
router.delete("/:projectId/milestones/:milestoneId", requirePermission("projects.edit"), asyncHandler(async (req, res) => {
  const milestoneId = req.params.milestoneId as string;
  const [deleted] = await db
    .delete(projectMilestonesTable)
    .where(eq(projectMilestonesTable.id, milestoneId))
    .returning({ id: projectMilestonesTable.id });

  if (!deleted) throw createError("Milestone not found", 404);
  return res.status(204).send();
}));

// ==========================================
// PROJECT REQUEST FEATURE (RESOURCE/MODIFICATION REQUESTS)
// ==========================================

// Get all project requests (for Admins / Managers) or filtered
router.get("/requests/all", requirePermission("projects.view"), asyncHandler(async (req, res) => {
  const requesterId = (req as any).userId;
  const isPrivileged = canManageProjectWorkspace(
    (req as any).userSystemRole,
    (req as any).userConfiguredModules,
  );

  const requesterUserTable = aliasedTable(usersTable, "requesterUser");

  let query = db
    .select({
      id: projectRequestsTable.id,
      projectId: projectRequestsTable.projectId,
      projectName: projectsTable.name,
      requestedBy: projectRequestsTable.requestedBy,
      requesterName: requesterUserTable.name,
      requesterEmail: requesterUserTable.email,
      requestType: projectRequestsTable.requestType,
      title: projectRequestsTable.title,
      description: projectRequestsTable.description,
      status: projectRequestsTable.status,
      adminNotes: projectRequestsTable.adminNotes,
      createdAt: projectRequestsTable.createdAt,
      updatedAt: projectRequestsTable.updatedAt,
    })
    .from(projectRequestsTable)
    .innerJoin(projectsTable, eq(projectRequestsTable.projectId, projectsTable.id))
    .innerJoin(requesterUserTable, eq(projectRequestsTable.requestedBy, requesterUserTable.id));

  let requests;
  if (isPrivileged) {
    requests = await query;
  } else {
    requests = await query.where(eq(projectRequestsTable.requestedBy, requesterId));
  }

  return res.json(requests);
}));

// Submit project request (Employee or Admin)
router.post("/:id/requests", requirePermission("projects.view"), asyncHandler(async (req, res) => {
  const projectId = req.params.id as string;
  const requesterId = (req as any).userId;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) throw createError("Project not found", 404);

  const { requestType, title, description } = req.body || {};
  if (!requestType || !description) {
    throw createError("Request type and description are required", 400);
  }

  const [newRequest] = await db
    .insert(projectRequestsTable)
    .values({
      projectId,
      requestedBy: requesterId,
      requestType,
      title: title || "Project Modification / Resource Request",
      description,
      status: "PENDING",
    })
    .returning();

  // Notify super admins and managers
  await NotificationService.notifyAdminsAndManagers({
    title: "New Project Request",
    message: `New project request submitted for "${project.name}": ${title || requestType}`,
    type: "PROJECT",
    priority: "MEDIUM",
    referenceId: projectId,
    referenceType: "PROJECT",
    action: "PROJECT_REQUEST",
    actionUrl: `/projects?tab=requests`,
    createdBy: requesterId,
  }).catch(() => {});

  return res.status(201).json(newRequest);
}));

// Get requests for a specific project
router.get("/:id/requests", requirePermission("projects.view"), asyncHandler(async (req, res) => {
  const projectId = req.params.id as string;
  const requesterUserTable = aliasedTable(usersTable, "requesterUser");

  const requests = await db
    .select({
      id: projectRequestsTable.id,
      projectId: projectRequestsTable.projectId,
      requestedBy: projectRequestsTable.requestedBy,
      requesterName: requesterUserTable.name,
      requestType: projectRequestsTable.requestType,
      title: projectRequestsTable.title,
      description: projectRequestsTable.description,
      status: projectRequestsTable.status,
      adminNotes: projectRequestsTable.adminNotes,
      createdAt: projectRequestsTable.createdAt,
      updatedAt: projectRequestsTable.updatedAt,
    })
    .from(projectRequestsTable)
    .innerJoin(requesterUserTable, eq(projectRequestsTable.requestedBy, requesterUserTable.id))
    .where(eq(projectRequestsTable.projectId, projectId));

  return res.json(requests);
}));

// Approve or Reject a project request (Admin or Super Admin only)
router.patch("/requests/:requestId/status", requirePermission("projects.view"), asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { status, adminNotes } = req.body || {};
  const systemRole = (req as any).userSystemRole;
  const isPrivileged = canManageProjectWorkspace(systemRole, (req as any).userConfiguredModules);

  if (!isPrivileged) {
    throw createError("Forbidden: Only administrators can approve or reject project requests", 403);
  }

  if (!["APPROVED", "REJECTED"].includes(status)) {
    throw createError("Status must be APPROVED or REJECTED", 400);
  }

  const [existing] = await db.select().from(projectRequestsTable).where(eq(projectRequestsTable.id, requestId as string));
  if (!existing) throw createError("Project request not found", 404);

  const [updated] = await db
    .update(projectRequestsTable)
    .set({
      status,
      adminNotes: adminNotes || null,
      updatedAt: new Date(),
    })
    .where(eq(projectRequestsTable.id, requestId as string))
    .returning();

  return res.json(updated);
}));

export default router;
