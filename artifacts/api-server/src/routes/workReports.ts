import { Router } from "express";
import { db } from "@workspace/db";
import {
  workReportsTable,
  workReportVersionsTable,
  workReportAuditLogsTable,
  workReportReopenRequestsTable,
  notificationsTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, desc, and, or, inArray } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";

const router = Router();

// Hydrate req.user from req.userId
router.use(asyncHandler(async (req: any, _res, next) => {
  const userId = req.userId || req.user?.id;
  if (userId) {
    const [u] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        systemRole: usersTable.systemRole,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    req.user = u || {
      id: userId,
      name: "System User",
      role: req.userSystemRole || "ADMIN",
      systemRole: req.userSystemRole || "ADMIN",
    };
  }
  next();
}));

// Helper to check if user is Manager or Admin
function isManagerOrAdmin(user: any): boolean {
  if (!user) return false;
  const role = String(user.role || user.systemRole || "").toUpperCase();
  return ["ADMIN", "SUPER_ADMIN", "MANAGER", "DIRECTOR", "LEAD"].includes(role);
}

// Helper to log audit events
async function logAuditEvent({
  reportId,
  actorId,
  actorName,
  actorRole,
  action,
  fieldsChanged = [],
  managerComments = null,
}: {
  reportId: string;
  actorId: string;
  actorName?: string | null;
  actorRole?: string | null;
  action: string;
  fieldsChanged?: Array<{ field: string; oldValue: any; newValue: any }>;
  managerComments?: string | null;
}) {
  try {
    await db.insert(workReportAuditLogsTable).values({
      id: crypto.randomUUID(),
      reportId,
      actorId,
      actorName: actorName || "System User",
      actorRole: actorRole || "User",
      action,
      fieldsChanged,
      managerComments,
    });
  } catch (err) {
    console.error("[WorkReport AuditLog Error]:", err);
  }
}

// Helper to save report version
async function saveReportVersion({
  reportId,
  versionNumber,
  statusAtVersion,
  snapshot,
  submittedBy,
  submittedByName,
  changeSummary,
}: {
  reportId: string;
  versionNumber: number;
  statusAtVersion: string;
  snapshot: any;
  submittedBy: string;
  submittedByName?: string | null;
  changeSummary?: string | null;
}) {
  try {
    await db.insert(workReportVersionsTable).values({
      id: crypto.randomUUID(),
      reportId,
      versionNumber,
      statusAtVersion,
      snapshot,
      submittedBy,
      submittedByName: submittedByName || "Employee",
      changeSummary: changeSummary || `Version ${versionNumber} - ${statusAtVersion}`,
    });
  } catch (err) {
    console.error("[WorkReport Version Error]:", err);
  }
}

// Helper to send in-app notification
async function sendNotification({
  userId,
  senderId,
  title,
  message,
  reportId,
}: {
  userId: string;
  senderId?: string | null;
  title: string;
  message: string;
  reportId: string;
}) {
  try {
    await db.insert(notificationsTable).values({
      id: crypto.randomUUID(),
      userId,
      senderId: senderId || null,
      type: "SYSTEM",
      priority: "HIGH",
      title,
      message,
      action: "VIEW_WORK_REPORT",
      actionUrl: `/employee/dashboard?reportId=${reportId}`,
      referenceId: reportId,
      referenceType: "WORK_REPORT",
    });
  } catch (err) {
    console.error("[WorkReport Notification Error]:", err);
  }
}

// Helper to notify all Managers/Admins
async function notifyManagers({
  senderId,
  title,
  message,
  reportId,
}: {
  senderId?: string | null;
  title: string;
  message: string;
  reportId: string;
}) {
  try {
    const managers = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(
        or(
          eq(usersTable.role, "SUPER_ADMIN"),
          eq(usersTable.role, "ADMIN"),
          eq(usersTable.role, "MANAGER"),
          eq(usersTable.systemRole, "SUPER_ADMIN"),
          eq(usersTable.systemRole, "ADMIN")
        )
      );

    for (const m of managers) {
      if (m.id !== senderId) {
        await sendNotification({
          userId: m.id,
          senderId,
          title,
          message,
          reportId,
        });
      }
    }
  } catch (err) {
    console.error("[WorkReport Notify Managers Error]:", err);
  }
}

/**
 * GET /api/work-reports
 * Fetch reports accessible to the current user.
 */
router.get(
  "/",
  asyncHandler(async (req: any, res) => {
    const user = req.user;
    const isManager = isManagerOrAdmin(user);

    let rows;
    if (isManager) {
      rows = await db
        .select({
          report: workReportsTable,
          userName: usersTable.name,
          userEmail: usersTable.email,
        })
        .from(workReportsTable)
        .leftJoin(usersTable, eq(workReportsTable.userId, usersTable.id))
        .orderBy(desc(workReportsTable.updatedAt));
    } else {
      rows = await db
        .select({
          report: workReportsTable,
          userName: usersTable.name,
          userEmail: usersTable.email,
        })
        .from(workReportsTable)
        .leftJoin(usersTable, eq(workReportsTable.userId, usersTable.id))
        .where(eq(workReportsTable.userId, user.id))
        .orderBy(desc(workReportsTable.updatedAt));
    }

    const reports = rows.map((r) => ({
      ...r.report,
      employeeName: r.report.employeeName || r.userName || "Employee",
      userEmail: r.userEmail,
    }));

    return res.json(reports);
  })
);

/**
 * GET /api/work-reports/:id
 * Get single report with versions, audit logs, and reopen requests.
 */
router.get(
  "/:id",
  asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const user = req.user;

    const [report] = await db
      .select({
        report: workReportsTable,
        userName: usersTable.name,
        userEmail: usersTable.email,
      })
      .from(workReportsTable)
      .leftJoin(usersTable, eq(workReportsTable.userId, usersTable.id))
      .where(eq(workReportsTable.id, id));

    if (!report) {
      throw createError(404, "Work report not found");
    }

    const isManager = isManagerOrAdmin(user);
    if (!isManager && report.report.userId !== user.id) {
      throw createError(403, "You do not have permission to view this report.");
    }

    const versions = await db
      .select()
      .from(workReportVersionsTable)
      .where(eq(workReportVersionsTable.reportId, id))
      .orderBy(desc(workReportVersionsTable.versionNumber));

    const auditLogs = await db
      .select()
      .from(workReportAuditLogsTable)
      .where(eq(workReportAuditLogsTable.reportId, id))
      .orderBy(desc(workReportAuditLogsTable.createdAt));

    const reopenRequests = await db
      .select()
      .from(workReportReopenRequestsTable)
      .where(eq(workReportReopenRequestsTable.reportId, id))
      .orderBy(desc(workReportReopenRequestsTable.createdAt));

    return res.json({
      ...report.report,
      employeeName: report.report.employeeName || report.userName || "Employee",
      userEmail: report.userEmail,
      versions,
      auditLogs,
      reopenRequests,
    });
  })
);

/**
 * POST /api/work-reports
 * Create a new draft report.
 */
router.post(
  "/",
  asyncHandler(async (req: any, res) => {
    const user = req.user;
    const body = req.body;

    const newReportId = crypto.randomUUID();
    const title = body.title || `Work Report - ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;

    const [newReport] = await db
      .insert(workReportsTable)
      .values({
        id: newReportId,
        userId: user.id,
        employeeName: user.name || body.employeeName || "Employee",
        employeeDesignation: body.employeeDesignation || user.role || "Team Member",
        title,
        period: body.period || "Monthly",
        startDate: body.startDate || new Date().toISOString().slice(0, 10),
        endDate: body.endDate || new Date().toISOString().slice(0, 10),
        status: "Draft",
        clientHandled: body.clientHandled || "",
        projects: body.projects || [],
        selfAssessment: body.selfAssessment || "",
        summary: body.summary || "",
        currentVersion: 1,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning();

    await logAuditEvent({
      reportId: newReportId,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role || "Employee",
      action: "CREATED_DRAFT",
    });

    return res.status(201).json(newReport);
  })
);

/**
 * PUT /api/work-reports/:id
 * Edit report (Draft or Needs Changes).
 * SECURITY RULE: Non-managers CANNOT edit Submitted, Under Review, Approved, or Archived.
 */
router.put(
  "/:id",
  asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const user = req.user;
    const body = req.body;

    const [existing] = await db
      .select()
      .from(workReportsTable)
      .where(eq(workReportsTable.id, id));

    if (!existing) {
      throw createError(404, "Work report not found");
    }

    const isManager = isManagerOrAdmin(user);

    // Security Permission Enforcement
    if (!isManager) {
      if (existing.userId !== user.id) {
        throw createError(403, "You do not have permission to edit this report.");
      }

      const forbiddenStatuses = ["Submitted", "Under Review", "Approved", "Archived"];
      if (forbiddenStatuses.includes(existing.status)) {
        throw createError(
          403,
          `Employees cannot edit reports in ${existing.status} status. Only Draft and Needs Changes reports are editable.`
        );
      }
    }

    // Compute changed fields for Audit Logging
    const fieldsChanged: Array<{ field: string; oldValue: any; newValue: any }> = [];
    const watchFields: Array<keyof typeof existing> = [
      "title",
      "period",
      "startDate",
      "endDate",
      "clientHandled",
      "selfAssessment",
      "summary",
      "projects",
    ];

    for (const f of watchFields) {
      if (body[f] !== undefined) {
        const oldVal = existing[f];
        const newVal = body[f];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          fieldsChanged.push({ field: String(f), oldValue: oldVal, newValue: newVal });
        }
      }
    }

    const updatePayload: any = {
      updatedAt: new Date(),
      updatedBy: user.id,
    };

    if (body.title !== undefined) updatePayload.title = body.title;
    if (body.period !== undefined) updatePayload.period = body.period;
    if (body.startDate !== undefined) updatePayload.startDate = body.startDate;
    if (body.endDate !== undefined) updatePayload.endDate = body.endDate;
    if (body.clientHandled !== undefined) updatePayload.clientHandled = body.clientHandled;
    if (body.projects !== undefined) updatePayload.projects = body.projects;
    if (body.selfAssessment !== undefined) updatePayload.selfAssessment = body.selfAssessment;
    if (body.summary !== undefined) updatePayload.summary = body.summary;
    if (body.employeeName !== undefined) updatePayload.employeeName = body.employeeName;
    if (body.employeeDesignation !== undefined) updatePayload.employeeDesignation = body.employeeDesignation;

    // Manager corrections override
    if (isManager && body.managerFeedback !== undefined) {
      updatePayload.managerFeedback = body.managerFeedback;
    }
    if (isManager && body.managerCommentSections !== undefined) {
      updatePayload.managerCommentSections = body.managerCommentSections;
    }

    const [updated] = await db
      .update(workReportsTable)
      .set(updatePayload)
      .where(eq(workReportsTable.id, id))
      .returning();

    await logAuditEvent({
      reportId: id,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role || (isManager ? "Manager" : "Employee"),
      action: isManager ? "MANAGER_EDIT" : "UPDATED_DRAFT",
      fieldsChanged,
    });

    return res.json(updated);
  })
);

/**
 * POST /api/work-reports/:id/submit
 * Submit or Resubmit report.
 */
router.post(
  "/:id/submit",
  asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const user = req.user;

    const [existing] = await db
      .select()
      .from(workReportsTable)
      .where(eq(workReportsTable.id, id));

    if (!existing) {
      throw createError(404, "Work report not found");
    }

    const isManager = isManagerOrAdmin(user);
    if (!isManager && existing.userId !== user.id) {
      throw createError(403, "You do not have permission to submit this report.");
    }

    const isResubmission = existing.status === "Needs Changes" || existing.currentVersion > 1;
    const newStatus = isResubmission ? "Resubmitted" : "Submitted";
    const nextVersion = existing.currentVersion + (existing.status !== "Draft" ? 1 : 0);

    const [updated] = await db
      .update(workReportsTable)
      .set({
        status: newStatus,
        currentVersion: nextVersion,
        submittedAt: new Date(),
        reopenRequested: false,
        reopenStatus: "None",
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(workReportsTable.id, id))
      .returning();

    // Create snapshot version
    await saveReportVersion({
      reportId: id,
      versionNumber: nextVersion,
      statusAtVersion: newStatus,
      snapshot: updated,
      submittedBy: user.id,
      submittedByName: user.name || updated.employeeName,
      changeSummary: isResubmission
        ? `Resubmitted Version ${nextVersion} by ${user.name}`
        : `Initial Submission Version ${nextVersion} by ${user.name}`,
    });

    // Log audit event
    await logAuditEvent({
      reportId: id,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role || "Employee",
      action: isResubmission ? "RESUBMITTED" : "SUBMITTED",
    });

    // Notify Managers
    const empName = updated.employeeName || user.name || "An employee";
    const notifyMsg = isResubmission
      ? `${empName} resubmitted Monthly Report.`
      : `${empName} submitted Monthly Report for review.`;

    await notifyManagers({
      senderId: user.id,
      title: isResubmission ? "Report Resubmitted" : "New Work Report Submitted",
      message: notifyMsg,
      reportId: id,
    });

    return res.json(updated);
  })
);

/**
 * POST /api/work-reports/:id/review-status (Manager endpoint)
 * Mark report as Under Review.
 */
router.post(
  "/:id/review-status",
  asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const user = req.user;

    if (!isManagerOrAdmin(user)) {
      throw createError(403, "Only Managers or Admins can mark a report under review.");
    }

    const [existing] = await db
      .select()
      .from(workReportsTable)
      .where(eq(workReportsTable.id, id));

    if (!existing) {
      throw createError(404, "Work report not found");
    }

    const [updated] = await db
      .update(workReportsTable)
      .set({
        status: "Under Review",
        reviewedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(workReportsTable.id, id))
      .returning();

    await logAuditEvent({
      reportId: id,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role || "Manager",
      action: "UNDER_REVIEW",
    });

    return res.json(updated);
  })
);

/**
 * POST /api/work-reports/:id/request-changes (Manager endpoint)
 * Request modifications on a report.
 */
router.post(
  "/:id/request-changes",
  asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const user = req.user;
    const { managerFeedback, managerCommentSections, projectComments } = req.body;

    if (!isManagerOrAdmin(user)) {
      throw createError(403, "Only Managers or Admins can request changes.");
    }

    const [existing] = await db
      .select()
      .from(workReportsTable)
      .where(eq(workReportsTable.id, id));

    if (!existing) {
      throw createError(404, "Work report not found");
    }

    // Attach project specific comments if provided
    let updatedProjects = existing.projects || [];
    if (projectComments && Array.isArray(projectComments) && Array.isArray(updatedProjects)) {
      updatedProjects = (updatedProjects as any[]).map((p: any) => {
        const pComm = projectComments.find((pc: any) => pc.projectId === p.id || pc.projectName === p.projectName);
        if (pComm) {
          return { ...p, managerComment: pComm.comment };
        }
        return p;
      });
    }

    const [updated] = await db
      .update(workReportsTable)
      .set({
        status: "Needs Changes",
        managerFeedback: managerFeedback || "Modifications requested by manager.",
        managerCommentSections: managerCommentSections || {},
        projects: updatedProjects,
        reviewedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(workReportsTable.id, id))
      .returning();

    await logAuditEvent({
      reportId: id,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role || "Manager",
      action: "REQUESTED_CHANGES",
      managerComments: managerFeedback || "Manager requested changes.",
    });

    // Notify Employee
    await sendNotification({
      userId: existing.userId,
      senderId: user.id,
      title: "Work Report Needs Changes",
      message: "Your report requires changes. Click to view manager comments.",
      reportId: id,
    });

    return res.json(updated);
  })
);

/**
 * POST /api/work-reports/:id/approve (Manager endpoint)
 * Approve report.
 */
router.post(
  "/:id/approve",
  asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const user = req.user;

    if (!isManagerOrAdmin(user)) {
      throw createError(403, "Only Managers or Admins can approve reports.");
    }

    const [existing] = await db
      .select()
      .from(workReportsTable)
      .where(eq(workReportsTable.id, id));

    if (!existing) {
      throw createError(404, "Work report not found");
    }

    const [updated] = await db
      .update(workReportsTable)
      .set({
        status: "Approved",
        approvedAt: new Date(),
        reopenRequested: false,
        reopenStatus: "None",
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(workReportsTable.id, id))
      .returning();

    await logAuditEvent({
      reportId: id,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role || "Manager",
      action: "APPROVED",
    });

    // Notify Employee
    await sendNotification({
      userId: existing.userId,
      senderId: user.id,
      title: "Work Report Approved",
      message: "Your report has been approved.",
      reportId: id,
    });

    return res.json(updated);
  })
);

/**
 * POST /api/work-reports/:id/request-reopen (Employee endpoint)
 * Request reopening an Approved report.
 */
router.post(
  "/:id/request-reopen",
  asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const user = req.user;
    const { reason } = req.body;

    const [existing] = await db
      .select()
      .from(workReportsTable)
      .where(eq(workReportsTable.id, id));

    if (!existing) {
      throw createError(404, "Work report not found");
    }

    if (existing.userId !== user.id && !isManagerOrAdmin(user)) {
      throw createError(403, "You can only request reopening for your own reports.");
    }

    if (existing.status !== "Approved") {
      throw createError(400, "Only Approved reports can be requested for reopening.");
    }

    if (!reason || !reason.trim()) {
      throw createError(400, "A valid reason for reopening the report is required.");
    }

    await db.insert(workReportReopenRequestsTable).values({
      id: crypto.randomUUID(),
      reportId: id,
      requestedBy: user.id,
      requestedByName: user.name || "Employee",
      reason: reason.trim(),
      status: "Pending",
    });

    const [updated] = await db
      .update(workReportsTable)
      .set({
        reopenRequested: true,
        reopenReason: reason.trim(),
        reopenStatus: "Pending",
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(workReportsTable.id, id))
      .returning();

    await logAuditEvent({
      reportId: id,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role || "Employee",
      action: "REOPEN_REQUESTED",
      managerComments: `Reopen reason: ${reason}`,
    });

    await notifyManagers({
      senderId: user.id,
      title: "Report Reopening Requested",
      message: `${user.name || "An employee"} requested report reopening. Reason: ${reason}`,
      reportId: id,
    });

    return res.json(updated);
  })
);

/**
 * POST /api/work-reports/:id/review-reopen (Manager endpoint)
 * Approve or Reject a Reopen Request.
 */
router.post(
  "/:id/review-reopen",
  asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const user = req.user;
    const { action, reviewComment } = req.body; // action: 'approve' | 'reject'

    if (!isManagerOrAdmin(user)) {
      throw createError(403, "Only Managers or Admins can review reopen requests.");
    }

    const [existing] = await db
      .select()
      .from(workReportsTable)
      .where(eq(workReportsTable.id, id));

    if (!existing) {
      throw createError(404, "Work report not found");
    }

    const isApprove = action === "approve";
    const newStatus = isApprove ? "Needs Changes" : existing.status;
    const reopenStatus = isApprove ? "Approved" : "Rejected";

    // Update Reopen Request table record
    await db
      .update(workReportReopenRequestsTable)
      .set({
        status: reopenStatus,
        reviewedBy: user.id,
        reviewedByName: user.name || "Manager",
        reviewComment: reviewComment || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workReportReopenRequestsTable.reportId, id),
          eq(workReportReopenRequestsTable.status, "Pending")
        )
      );

    const [updated] = await db
      .update(workReportsTable)
      .set({
        status: newStatus,
        reopenRequested: false,
        reopenStatus,
        managerFeedback: isApprove
          ? `Report reopened by Manager. ${reviewComment || ""}`.trim()
          : existing.managerFeedback,
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(workReportsTable.id, id))
      .returning();

    await logAuditEvent({
      reportId: id,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role || "Manager",
      action: isApprove ? "REOPEN_APPROVED" : "REOPEN_REJECTED",
      managerComments: reviewComment || null,
    });

    // Notify Employee
    await sendNotification({
      userId: existing.userId,
      senderId: user.id,
      title: isApprove ? "Report Reopening Approved" : "Report Reopening Rejected",
      message: isApprove
        ? "Your request to reopen report was approved. You may now edit and resubmit."
        : `Your request to reopen report was rejected. Comment: ${reviewComment || "No comment."}`,
      reportId: id,
    });

    return res.json(updated);
  })
);

/**
 * POST /api/work-reports/:id/archive
 * Archive report.
 */
router.post(
  "/:id/archive",
  asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const user = req.user;

    const [existing] = await db
      .select()
      .from(workReportsTable)
      .where(eq(workReportsTable.id, id));

    if (!existing) {
      throw createError(404, "Work report not found");
    }

    const [updated] = await db
      .update(workReportsTable)
      .set({
        status: "Archived",
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(workReportsTable.id, id))
      .returning();

    await logAuditEvent({
      reportId: id,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role || "Employee",
      action: "ARCHIVED",
    });

    return res.json(updated);
  })
);

/**
 * POST /api/work-reports/:id/restore
 * Restore archived report back to workspace.
 */
router.post(
  "/:id/restore",
  asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const user = req.user;

    const [existing] = await db
      .select()
      .from(workReportsTable)
      .where(eq(workReportsTable.id, id));

    if (!existing) {
      throw createError(404, "Work report not found");
    }

    const restoredStatus = existing.approvedAt ? "Approved" : "Draft";

    const [updated] = await db
      .update(workReportsTable)
      .set({
        status: restoredStatus,
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(workReportsTable.id, id))
      .returning();

    await logAuditEvent({
      reportId: id,
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role || "Employee",
      action: "RESTORED",
    });

    return res.json(updated);
  })
);

/**
 * DELETE /api/work-reports/:id
 * Delete a draft report.
 */
router.delete(
  "/:id",
  asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const user = req.user;

    const [existing] = await db
      .select()
      .from(workReportsTable)
      .where(eq(workReportsTable.id, id));

    if (!existing) {
      throw createError(404, "Work report not found");
    }

    const isManager = isManagerOrAdmin(user);
    if (!isManager && existing.status !== "Draft") {
      throw createError(400, "Only Draft reports can be deleted by employees.");
    }

    await db.delete(workReportsTable).where(eq(workReportsTable.id, id));

    return res.json({ message: "Work report deleted successfully." });
  })
);

/**
 * GET /api/work-reports/:id/pdf
 * Render printable PDF HTML view with Blink Beyond branding letterhead.
 */
router.get(
  "/:id/pdf",
  asyncHandler(async (req: any, res) => {
    const { id } = req.params;

    const [report] = await db
      .select({
        report: workReportsTable,
        userName: usersTable.name,
        userEmail: usersTable.email,
      })
      .from(workReportsTable)
      .leftJoin(usersTable, eq(workReportsTable.userId, usersTable.id))
      .where(eq(workReportsTable.id, id));

    if (!report) {
      return res.status(404).send("Work report not found");
    }

    const r = report.report;
    const projects = Array.isArray(r.projects) ? (r.projects as any[]) : [];
    const empName = r.employeeName || report.userName || "Employee";
    const empEmail = report.userEmail || "N/A";

    const totalHours = projects.reduce((acc: number, p: any) => acc + (Number(p.hoursSpent) || 0), 0);
    const completedProjects = projects.filter((p: any) => p.status === "Completed" || Number(p.completionPercentage) === 100);
    const pendingProjects = projects.filter((p: any) => p.status !== "Completed" && Number(p.completionPercentage) < 100);
    const completedCount = completedProjects.length;
    const pendingCount = pendingProjects.length;
    const completionRate = projects.length > 0 ? Math.round(projects.reduce((acc: number, p: any) => acc + (Number(p.completionPercentage) || 0), 0) / projects.length) : 0;
    const uniqueClients = Array.from(new Set(projects.map((p: any) => p.clientName).filter(Boolean)));
    const clientsListStr = uniqueClients.length > 0 ? uniqueClients.join(", ") : (r.clientHandled || "N/A");
    const clientCount = uniqueClients.length > 0 ? uniqueClients.length : (r.clientHandled && r.clientHandled !== "N/A" ? r.clientHandled.split(',').filter(Boolean).length : 0);

    function esc(str: any): string {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    const logoSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><circle cx='256' cy='256' r='256' fill='%231D1037'/><g transform='translate(48, 168)'><path d='M 0 32 Q 0 20 12 20 L 48 20 Q 56 20 62 27 L 102 78 Q 108 85 102 92 L 62 143 Q 56 150 48 150 L 12 150 Q 0 150 0 138 Z' fill='%23FFFFFF'/><path d='M 68 32 Q 68 20 80 20 L 116 20 Q 124 20 130 27 L 170 78 Q 176 85 170 92 L 130 143 Q 124 150 116 150 L 80 150 Q 68 150 68 138 Z' fill='%23FFFFFF'/><text x='188' y='72' fill='%23FFFFFF' font-family='sans-serif' font-weight='800' font-size='70'>Blink</text><text x='188' y='140' fill='%23FFFFFF' font-family='sans-serif' font-weight='800' font-size='70'>Beyond</text><text x='328' y='172' fill='%23FFFFFF' font-family='sans-serif' font-weight='500' font-size='26'>media.</text></g></svg>";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${esc(empName)}_Work_Report_${esc((r.period || 'Period').replace(/\s+/g, '_'))}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      font-size: 12px;
      color: #1f2937;
      background: #f3f4f6;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    @page {
      size: A4 portrait;
      margin: 0;
    }

    @media print {
      html, body {
        background: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .page-container {
        box-shadow: none !important;
        margin: 0 !important;
        max-width: 100% !important;
        width: 100% !important;
        border-radius: 0 !important;
        min-height: 100vh !important;
      }
      .no-print {
        display: none !important;
      }
      thead.document-header-group {
        display: table-header-group !important;
      }
      tfoot.document-footer-group {
        display: table-footer-group !important;
      }
      tr {
        page-break-inside: avoid !important;
      }
    }

    .page-container {
      max-width: 820px;
      margin: 20px auto;
      background: #ffffff;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05);
      position: relative;
      overflow: hidden;
      min-height: 1120px;
    }

    table.document-layout-table {
      width: 100%;
      border-collapse: collapse;
      border: none;
    }

    td.layout-cell {
      padding: 0;
      border: none;
    }

    .letterhead-header {
      padding: 24px 32px 14px 32px;
      background: #ffffff;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 14px;
      border-bottom: 2px solid #e0e7ff;
      box-shadow: 0 4px 6px -2px rgba(52, 81, 255, 0.12);
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-title {
      font-size: 22px;
      font-weight: 900;
      color: #3451FF;
      letter-spacing: -0.5px;
      line-height: 1;
    }

    .brand-subtitle {
      font-size: 10px;
      font-weight: 600;
      color: #374151;
      margin-top: 3px;
      letter-spacing: 0.2px;
      text-transform: uppercase;
    }

    .contact-details {
      text-align: right;
      font-size: 10px;
      font-weight: 700;
      color: #111827;
      line-height: 1.45;
      letter-spacing: 0.2px;
    }

    .document-body {
      padding: 20px 32px 28px 32px;
    }

    .letterhead-footer {
      width: 100%;
      background: #ffffff;
      padding: 12px 0 0 0;
    }

    .footer-bar {
      width: 100%;
      background: #3451FF;
      padding: 10px 16px;
      text-align: center;
      color: #ffffff;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }

    .thank-you-note {
      text-align: center;
      font-size: 11px;
      color: #64748b;
      font-style: italic;
      margin-bottom: 10px;
    }

    .letterhead-watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-25deg);
      font-size: 78px;
      font-weight: 900;
      color: #3451FF;
      opacity: 0.08;
      letter-spacing: 12px;
      z-index: 0;
      pointer-events: none;
      white-space: nowrap;
      text-transform: uppercase;
      user-select: none;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
      font-size: 11px;
      border: 1px solid #cbd5e1;
    }

    .items-table th {
      background-color: #3451FF;
      color: #ffffff;
      padding: 9px 8px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      border: 1px solid #2840d8;
    }

    .items-table td {
      padding: 8px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }

    .items-table tr:nth-child(even) {
      background-color: #f8fafc;
    }

    .section-box {
      background: #f8fafc;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      padding: 14px 18px;
      margin-bottom: 20px;
    }

    .section-box-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #3451FF;
      margin-bottom: 8px;
    }

    .section-header {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
      border-bottom: 2px solid #3451FF;
      padding-bottom: 4px;
      margin-top: 22px;
      margin-bottom: 12px;
    }

    .badge {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .badge-Approved { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-Submitted { background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .badge-Draft { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
    .badge-NeedsChanges { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .badge-UnderReview { background: #f3e8ff; color: #7e22ce; border: 1px solid #e9d5ff; }
    .badge-Archived { background: #e2e8f0; color: #475569; border: 1px solid #cbd5e1; }

    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }

    .stat-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 12px;
      text-align: center;
    }

    .stat-value {
      font-size: 16px;
      font-weight: 800;
      color: #3451FF;
    }

    .stat-label {
      font-size: 9.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-top: 2px;
    }

    .text-content {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
      font-size: 11.5px;
      line-height: 1.6;
      color: #334155;
      white-space: pre-wrap;
    }

    .signature-grid {
      display: flex;
      justify-content: space-between;
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
    }

    .signature-box {
      width: 45%;
      text-align: center;
    }

    .signature-line {
      border-top: 1.5px solid #0f172a;
      margin-top: 40px;
      padding-top: 6px;
      font-weight: 700;
      font-size: 11px;
      color: #0f172a;
    }

    .signature-sub {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }

    .toolbar {
      max-width: 820px;
      margin: 16px auto 0 auto;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .btn-print {
      background: #3451FF;
      color: #ffffff;
      border: none;
      padding: 10px 18px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(52, 81, 255, 0.2);
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button class="btn-print" onclick="window.print()">🖨 Download PDF</button>
  </div>

  <div class="page-container">
    <div class="letterhead-watermark">BLINK BEYOND</div>

    <table class="document-layout-table">
      <thead class="document-header-group">
        <tr>
          <td class="layout-cell">
            <div class="letterhead-header">
              <div class="header-content">
                <div class="brand-group">
                  <img src="${logoSvg}" alt="Blink Beyond" style="height: 44px; width: 44px; object-fit: contain; display: block;" />
                  <div>
                    <div class="brand-title">BLINK BEYOND</div>
                    <div class="brand-subtitle">Website | Social Media | Marketing</div>
                  </div>
                </div>
                <div class="contact-details">
                  <div>HO–PALGHAR, 401404, MUMBAI, MAHARASTRA</div>
                  <div>+91 95455 56009 | SUPPORT@BLINKBEYOND.CO.IN</div>
                  <div>WWW.BLINKBEYOND.CO.IN</div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      </thead>

      <tfoot class="document-footer-group">
        <tr>
          <td class="layout-cell">
            <div class="letterhead-footer">
              <div class="thank-you-note">Official Employee Work Performance &amp; Activity Report</div>
              <div class="footer-bar">
                BLINK BEYOND | SUPPORT@BLINKBEYOND.CO.IN | WWW.BLINKBEYOND.CO.IN | +91 95455 56009
              </div>
            </div>
          </td>
        </tr>
      </tfoot>

      <tbody>
        <tr>
          <td class="layout-cell">
            <div class="document-body">
              <!-- Document Title & Main Meta Header -->
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
                <div>
                  <div style="font-size:24px;font-weight:900;color:#3451FF;letter-spacing:1px;line-height:1">EMPLOYEE WORK REPORT</div>
                  <div style="font-size:14px;font-weight:700;color:#0f172a;margin-top:4px">${esc(r.title)}</div>
                  <div style="font-size:11.5px;color:#64748b;margin-top:3px">
                    Reporting Period: <strong style="color:#334155">${esc(r.period)}</strong> (${esc(r.startDate || "N/A")} to ${esc(r.endDate || "N/A")})
                  </div>
                </div>
                <div style="text-align:right">
                  <span class="badge badge-${r.status.replace(/\s+/g, '')}">${esc(r.status)}</span>
                  <div style="font-size:11px;font-family:monospace;color:#64748b;margin-top:6px">Report ID: #${esc(r.id.slice(0, 8).toUpperCase())}</div>
                  <div style="font-size:11px;color:#64748b;margin-top:2px">Version v${r.currentVersion}</div>
                </div>
              </div>

              <!-- 1. Employee Information -->
              <div class="section-box">
                <div class="section-box-title">Employee Information</div>
                <div class="grid-3" style="font-size:11.5px">
                  <div>
                    <span style="color:#64748b">Employee Name:</span>
                    <div style="font-weight:700;color:#0f172a;margin-top:2px">${esc(empName)}</div>
                  </div>
                  <div>
                    <span style="color:#64748b">Employee ID / Email:</span>
                    <div style="font-weight:700;color:#0f172a;margin-top:2px">${esc(r.employeeId || empEmail)}</div>
                  </div>
                  <div>
                    <span style="color:#64748b">Department / Role:</span>
                    <div style="font-weight:700;color:#0f172a;margin-top:2px">${esc(r.department || "Engineering")} / ${esc(r.employeeDesignation || r.role || "Team Member")}</div>
                  </div>
                  <div>
                    <span style="color:#64748b">Reporting Manager:</span>
                    <div style="font-weight:600;color:#334155;margin-top:2px">${esc(r.managerName || "Reporting Manager")}</div>
                  </div>
                  <div>
                    <span style="color:#64748b">Reporting Period:</span>
                    <div style="font-weight:600;color:#334155;margin-top:2px">${esc(r.period)}</div>
                  </div>
                  <div>
                    <span style="color:#64748b">Submission Date:</span>
                    <div style="font-weight:600;color:#334155;margin-top:2px">${r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not Submitted'}</div>
                  </div>
                </div>
              </div>

              <!-- 2. Client Summary -->
              <div class="section-box">
                <div class="section-box-title">Client Summary</div>
                <div class="grid-3" style="font-size:11.5px">
                  <div>
                    <span style="color:#64748b">Clients Handled This Month:</span>
                    <div style="font-weight:700;color:#0f172a;margin-top:2px">${esc(r.clientHandled || "N/A")}</div>
                  </div>
                  <div>
                    <span style="color:#64748b">Client Names:</span>
                    <div style="font-weight:600;color:#334155;margin-top:2px">${esc(clientsListStr)}</div>
                  </div>
                  <div>
                    <span style="color:#64748b">Number of Clients:</span>
                    <div style="font-weight:700;color:#3451FF;margin-top:2px">${clientCount}</div>
                  </div>
                </div>
              </div>

              <!-- 3. Projects & Deliverables -->
              <div class="section-header">Projects &amp; Deliverables</div>
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="width:28px;text-align:center">#</th>
                    <th style="text-align:left">Project</th>
                    <th style="text-align:left">Client</th>
                    <th style="text-align:left">Description / Deliverables</th>
                    <th style="text-align:right">Hours</th>
                    <th style="text-align:center">Completion %</th>
                    <th style="text-align:center">Status</th>
                    <th style="text-align:left">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    projects.length > 0
                      ? projects.map((p: any, idx: number) => {
                          const pStatus = p.status || "In Progress";
                          const stBadgeClass = pStatus === "Completed" ? "badge-Approved" : (pStatus === "In Progress" ? "badge-Submitted" : "badge-Draft");
                          return `
                        <tr>
                          <td style="color:#64748b;text-align:center">${idx + 1}</td>
                          <td style="font-weight:700;color:#0f172a">${esc(p.projectName || "Unassigned")}</td>
                          <td style="color:#475569">${esc(p.clientName || "—")}</td>
                          <td style="color:#334155">${esc(p.taskDescription || "—")}</td>
                          <td style="text-align:right;font-weight:600">${Number(p.hoursSpent || 0)} hrs</td>
                          <td style="text-align:center;font-weight:700;color:#3451FF">${Number(p.completionPercentage || 0)}%</td>
                          <td style="text-align:center"><span class="badge ${stBadgeClass}">${esc(pStatus)}</span></td>
                          <td style="color:#64748b;font-size:10.5px">${esc(p.managerComment || p.remarks || "—")}</td>
                        </tr>`;
                        }).join("")
                      : `<tr><td colspan="8" style="text-align:center;color:#64748b;font-style:italic">No projects or deliverables recorded.</td></tr>`
                  }
                </tbody>
              </table>

              <!-- 4. Attendance Summary -->
              <div class="section-box">
                <div class="section-box-title">Attendance Summary</div>
                <div class="grid-3" style="font-size:11.5px">
                  <div>
                    <span style="color:#64748b">Active Reporting Window:</span>
                    <div style="font-weight:600;color:#0f172a;margin-top:2px">${esc(r.startDate || "N/A")} to ${esc(r.endDate || "N/A")}</div>
                  </div>
                  <div>
                    <span style="color:#64748b">Logged Work Hours:</span>
                    <div style="font-weight:700;color:#3451FF;margin-top:2px">${totalHours} Hours</div>
                  </div>
                  <div>
                    <span style="color:#64748b">Attendance Status:</span>
                    <div style="font-weight:600;color:#059669;margin-top:2px">Present &amp; Active Logged</div>
                  </div>
                </div>
              </div>

              <!-- 5. Performance Summary -->
              <div class="section-header">Performance Summary</div>
              <div class="grid-4" style="margin-bottom:20px">
                <div class="stat-card">
                  <div class="stat-value">${projects.length}</div>
                  <div class="stat-label">Total Projects</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value" style="color:#059669">${completedCount}</div>
                  <div class="stat-label">Projects Completed</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value" style="color:#d97706">${pendingCount}</div>
                  <div class="stat-label">Projects Pending</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">${completionRate}%</div>
                  <div class="stat-label">Completion Rate</div>
                </div>
              </div>

              <!-- 6. Self Assessment -->
              <div class="section-header">Self Assessment</div>
              <div class="text-content" style="margin-bottom:20px">
                ${esc(r.selfAssessment) || "<span style='color:#94a3b8;font-style:italic'>No self assessment notes provided for this period.</span>"}
              </div>

              <!-- 7. Manager Feedback (CONDITIONAL: Hidden if empty) -->
              ${
                r.managerFeedback && r.managerFeedback.trim() !== ""
                  ? `
              <div class="section-header">Manager Feedback</div>
              <div class="text-content" style="background:#eff6ff;border-color:#bfdbfe;color:#1e3a8a;margin-bottom:20px">
                <div style="font-weight:700;color:#1d4ed8;margin-bottom:4px">Manager Remarks:</div>
                ${esc(r.managerFeedback)}
              </div>
              `
                  : ""
              }

              <!-- 8. Approval Information -->
              <div class="section-box">
                <div class="section-box-title">Approval Information</div>
                <div class="grid-4" style="font-size:11px">
                  <div>
                    <span style="color:#64748b">Approved By:</span>
                    <div style="font-weight:700;color:#0f172a;margin-top:2px">${esc(r.approvedByName || (r.status === 'Approved' ? 'Blink Beyond Management' : 'N/A'))}</div>
                  </div>
                  <div>
                    <span style="color:#64748b">Approval Date:</span>
                    <div style="font-weight:600;color:#334155;margin-top:2px">${r.approvedAt ? new Date(r.approvedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pending Approval'}</div>
                  </div>
                  <div>
                    <span style="color:#64748b">Report Status:</span>
                    <div style="margin-top:2px"><span class="badge badge-${r.status.replace(/\s+/g, '')}">${esc(r.status)}</span></div>
                  </div>
                  <div>
                    <span style="color:#64748b">Manager Remarks:</span>
                    <div style="font-weight:600;color:#334155;margin-top:2px">${esc(r.managerFeedback || "None")}</div>
                  </div>
                </div>
              </div>

              <!-- 9. Signatures -->
              <div class="signature-grid">
                <div class="signature-box">
                  <div class="signature-line">${esc(empName)}</div>
                  <div style="font-weight:600;color:#334155;font-size:10.5px;margin-top:2px">Employee Signature</div>
                  <div class="signature-sub">${esc(r.employeeDesignation || "Team Member")}</div>
                  <div class="signature-sub">Date: ${r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '________________'}</div>
                </div>

                <div class="signature-box">
                  <div class="signature-line">Blink Beyond Management</div>
                  <div style="font-weight:600;color:#334155;font-size:10.5px;margin-top:2px">Manager Signature</div>
                  <div class="signature-sub">Authorised Signatory</div>
                  <div class="signature-sub">Date: ${r.approvedAt ? new Date(r.approvedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pending Approval'}</div>
                </div>
              </div>

            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    return res.send(html);
  })
);

export default router;
