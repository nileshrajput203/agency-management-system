import { Router } from "express";
import { db } from "@workspace/db";
import {
  contentPostsTable,
  clientsTable,
  clientCalendarSharesTable,
  tasksTable,
  projectsTable,
} from "@workspace/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate, isValidUUID, isPastDate } from "../lib/validation";
import { requirePermission } from "../middleware/auth";
import { logger } from "../lib/logger";
import { NotificationService } from "../services/notificationService";

const router = Router();

function sanitizeContentPost(body: any, isUpdate = false) {
  return sanitizeAndValidate(body, {
    uuids: ["clientId"],
    textDates: ["scheduledAt", "shootDate"],
    enums: {
      platform: ["INSTAGRAM", "FACEBOOK", "LINKEDIN", "X", "TIKTOK", "YOUTUBE", "PINTEREST", "TWITTER"],
      contentType: ["POST", "REEL", "STORY", "CAROUSEL", "VIDEO", "SHORTS"],
      status: ["IDEA", "SCRIPTING", "DESIGNING", "PRODUCTION", "IN_REVIEW", "ADMIN_APPROVED", "SCHEDULED", "PUBLISHED", "SCHEDULING", "POSTED"],
      approvalStatus: ["PENDING", "APPROVED", "REJECTED", "NEEDS_CHANGES"],
    }
  });
}

const CONTENT_COLUMNS = {
  id: contentPostsTable.id,
  platform: contentPostsTable.platform,
  contentType: contentPostsTable.contentType,
  status: contentPostsTable.status,
  caption: contentPostsTable.caption,
  description: contentPostsTable.description,
  referenceUrl: contentPostsTable.referenceUrl,
  assetsLink: contentPostsTable.assetsLink,
  mediaUrls: contentPostsTable.mediaUrls,
  scheduledAt: contentPostsTable.scheduledAt,
  shootDate: contentPostsTable.shootDate,
  clientId: contentPostsTable.clientId,
  clientName: clientsTable.companyName,
  title: contentPostsTable.title,
  script: contentPostsTable.script,
  ideation: contentPostsTable.ideation,
  format: contentPostsTable.format,
  needsRevision: contentPostsTable.needsRevision,
  approvalStatus: contentPostsTable.approvalStatus,
  approvedBy: contentPostsTable.approvedBy,
  approvedAt: contentPostsTable.approvedAt,
  rejectionNote: contentPostsTable.rejectionNote,
  referenceLinks: contentPostsTable.referenceLinks,
  customProperties: contentPostsTable.customProperties,
  comments: contentPostsTable.comments,
  assigneeId: contentPostsTable.assigneeId,
  linkedTaskId: contentPostsTable.linkedTaskId,
  assetVersions: contentPostsTable.assetVersions,
  createdAt: contentPostsTable.createdAt,
};

router.get("/", requirePermission("content.view"), asyncHandler(async (req, res) => {
  const { clientId, month } = req.query as Record<string, string>;

  // Build WHERE conditions
  const conditions = [];
  if (clientId) conditions.push(eq(contentPostsTable.clientId, clientId));
  // Filter by month (yyyy-MM) — scheduledAt is stored as text "yyyy-MM-dd"
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const { like } = await import("drizzle-orm");
    conditions.push(like(contentPostsTable.scheduledAt, `${month}%`));
  }

  const rows = await db
    .select(CONTENT_COLUMNS)
    .from(contentPostsTable)
    .leftJoin(clientsTable, eq(contentPostsTable.clientId, clientsTable.id))
    .where(conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : (await import("drizzle-orm")).and(...conditions)) : undefined)
    .orderBy(
      sql`CASE WHEN ${contentPostsTable.scheduledAt} IS NULL THEN 1 ELSE 0 END`,
      contentPostsTable.scheduledAt,
      desc(contentPostsTable.createdAt)
    );
  return res.json(rows);
}));

router.post("/", requirePermission("content.create"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeContentPost(body, false);

  if (sanitized.scheduledAt && isPastDate(sanitized.scheduledAt)) {
    throw createError("Post Date cannot be earlier than today's date. Please select today or a future date.", 400);
  }
  if (sanitized.shootDate && isPastDate(sanitized.shootDate)) {
    throw createError("Shoot Date cannot be earlier than today's date. Please select today or a future date.", 400);
  }

  // Preserve initial version in assetVersions if assetsLink is present
  if (sanitized.assetsLink) {
    sanitized.assetVersions = [
      {
        version: 1,
        url: sanitized.assetsLink,
        uploadedAt: new Date().toISOString(),
        uploadedBy: (req as any).userId || "system",
      },
    ];
  }

  // If assigneeId is provided and no linkedTaskId exists, auto-create SOP task in Task Board
  if (sanitized.assigneeId && !sanitized.linkedTaskId) {
    try {
      const [clientProject] = sanitized.clientId
        ? await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.clientId, sanitized.clientId)).limit(1)
        : [];

      const [task] = await db.insert(tasksTable).values({
        title: `[Content] ${sanitized.title || "Social Media Post"}`,
        clientId: sanitized.clientId || null,
        projectId: clientProject?.id || null,
        assigneeId: sanitized.assigneeId,
        dueDate: (sanitized.shootDate || sanitized.scheduledAt)
          ? new Date(sanitized.shootDate || sanitized.scheduledAt)
          : new Date(Date.now() + 5 * 86400000),
        status: ["SCRIPTING", "DESIGNING", "PRODUCTION"].includes(sanitized.status) ? "IN_PROGRESS" : "TODO",
        priority: "MEDIUM",
        description: `Auto-linked from Content Studio: ${sanitized.format || sanitized.contentType || "Post"} for ${sanitized.platform || "Social"}.\n\nCaption/Hook: ${sanitized.caption || "None"}`,
        createdBy: (req as any).userId,
      }).returning();

      sanitized.linkedTaskId = task.id;
    } catch (err: any) {
      logger.warn({ err }, "Could not auto-create linked task for content post");
    }
  }

  const [row] = await db.insert(contentPostsTable).values(sanitized).returning();
  return res.status(201).json(row);
}));

router.patch("/:id", requirePermission("content.edit"), asyncHandler(async (req, res) => {
  const contentId = req.params.id as string;
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeContentPost(body, true);

  const [existing] = await db
    .select()
    .from(contentPostsTable)
    .where(eq(contentPostsTable.id, contentId));

  if (!existing) {
    throw createError("Not found", 404);
  }

  if (
    sanitized.scheduledAt !== undefined &&
    sanitized.scheduledAt !== existing.scheduledAt &&
    isPastDate(sanitized.scheduledAt)
  ) {
    throw createError("Post Date cannot be earlier than today's date. Please select today or a future date.", 400);
  }

  if (
    sanitized.shootDate !== undefined &&
    sanitized.shootDate !== existing.shootDate &&
    isPastDate(sanitized.shootDate)
  ) {
    throw createError("Shoot Date cannot be earlier than today's date. Please select today or a future date.", 400);
  }

  // Version tracking for Frame.io style proofing
  if (sanitized.assetsLink && sanitized.assetsLink !== existing.assetsLink) {
    const versions = Array.isArray(existing.assetVersions) ? [...(existing.assetVersions as any[])] : [];
    versions.push({
      version: versions.length + 1,
      url: sanitized.assetsLink,
      uploadedAt: new Date().toISOString(),
      uploadedBy: (req as any).userId || "system",
    });
    sanitized.assetVersions = versions;
  }

  // Bi-directional Auto-Sync: create linked task if assignee was just added
  let targetTaskId = existing.linkedTaskId || sanitized.linkedTaskId;
  const effectiveAssignee = sanitized.assigneeId || existing.assigneeId;

  if (!targetTaskId && effectiveAssignee) {
    try {
      const [clientProject] = (sanitized.clientId || existing.clientId)
        ? await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.clientId, sanitized.clientId || existing.clientId)).limit(1)
        : [];

      const [newTask] = await db.insert(tasksTable).values({
        title: `[Content] ${sanitized.title || existing.title || "Social Post"}`,
        clientId: sanitized.clientId || existing.clientId || null,
        projectId: clientProject?.id || null,
        assigneeId: effectiveAssignee,
        dueDate: (sanitized.shootDate || sanitized.scheduledAt || existing.shootDate || existing.scheduledAt)
          ? new Date(sanitized.shootDate || sanitized.scheduledAt || existing.shootDate || existing.scheduledAt)
          : new Date(Date.now() + 5 * 86400000),
        status: "TODO",
        priority: "MEDIUM",
        description: `Auto-linked from Content Studio: ${sanitized.title || existing.title || "Post"}`,
        createdBy: (req as any).userId,
      }).returning();

      targetTaskId = newTask.id;
      sanitized.linkedTaskId = newTask.id;
    } catch (tErr) {
      logger.warn({ tErr }, "Failed to auto-create task for content post");
    }
  }

  // Sync stage to linked task & notifications
  if (targetTaskId && sanitized.status) {
    try {
      if (["SCRIPTING", "DESIGNING", "PRODUCTION"].includes(sanitized.status)) {
        await db.update(tasksTable).set({ status: "IN_PROGRESS" }).where(eq(tasksTable.id, targetTaskId));
        if (effectiveAssignee && effectiveAssignee !== (req as any).userId) {
          await NotificationService.createNotification({
            userId: effectiveAssignee,
            type: "TASK_ASSIGNED",
            title: `🎨 Content Post In Progress: ${sanitized.title || existing.title}`,
            message: `Post moved to ${sanitized.status}. You can work on it directly.`,
            actionUrl: "/tasks",
          }).catch(() => {});
        }
      } else if (sanitized.status === "IN_REVIEW") {
        await db.update(tasksTable).set({ status: "IN_REVIEW" }).where(eq(tasksTable.id, targetTaskId));
        await NotificationService.notifyAdminsAndManagers({
          type: "CONTENT_IN_REVIEW",
          title: `👀 Content In Review: ${sanitized.title || existing.title}`,
          message: `Post submitted for review and approval.`,
          actionUrl: "/content",
        }).catch(() => {});
      } else if (["ADMIN_APPROVED", "SCHEDULED", "PUBLISHED"].includes(sanitized.status)) {
        await db.update(tasksTable).set({
          status: "COMPLETED",
        }).where(eq(tasksTable.id, targetTaskId));
      }
    } catch (syncErr) {
      logger.warn({ syncErr }, "Failed to sync content status to linked task");
    }
  }

  logger.info({
    contentId,
    revisionStatus: sanitized.needsRevision,
    approvalStatus: sanitized.approvalStatus,
    requestPayload: body,
  }, "[Content API] Updating content post revision status / payload");

  try {
    const [row] = await db
      .update(contentPostsTable)
      .set(sanitized)
      .where(eq(contentPostsTable.id, contentId))
      .returning();

    if (!row) {
      logger.error({
        contentId,
        revisionStatus: sanitized.needsRevision,
        requestPayload: body,
        apiResponse: "404 Not Found",
        dbResult: null,
      }, "[Content API] Revision update failed: Content post not found");
      throw createError("Not found", 404);
    }

    logger.info({
      contentId,
      revisionStatus: row.needsRevision,
      approvalStatus: row.approvalStatus,
      dbResult: row,
    }, "[Content API] Content post revision status updated successfully");

    return res.json(row);
  } catch (err: any) {
    logger.error({
      contentId,
      revisionStatus: sanitized.needsRevision,
      requestPayload: body,
      error: err?.message || err,
    }, "[Content API] Revision update database execution failed");
    throw err;
  }
}));

// POST /api/content/:id/comments/pin — Frame.io style visual timestamped media proofing
router.post("/:id/comments/pin", requirePermission("content.edit"), asyncHandler(async (req, res) => {
  const contentId = req.params.id as string;
  const { comment, timestampSec, frameCoordX, frameCoordY, version } = req.body || {};

  if (!comment || typeof comment !== "string") {
    throw createError("Comment text is required", 400);
  }

  const [post] = await db.select().from(contentPostsTable).where(eq(contentPostsTable.id, contentId));
  if (!post) throw createError("Content post not found", 404);

  const existingComments = Array.isArray(post.comments) ? [...(post.comments as any[])] : [];
  const newComment = {
    id: crypto.randomUUID(),
    userId: (req as any).userId,
    comment,
    timestampSec: timestampSec !== undefined && timestampSec !== null ? Number(timestampSec) : null,
    frameCoordX: frameCoordX !== undefined && frameCoordX !== null ? Number(frameCoordX) : null,
    frameCoordY: frameCoordY !== undefined && frameCoordY !== null ? Number(frameCoordY) : null,
    version: version || null,
    createdAt: new Date().toISOString(),
  };

  existingComments.push(newComment);

  const [updated] = await db
    .update(contentPostsTable)
    .set({ comments: existingComments })
    .where(eq(contentPostsTable.id, contentId))
    .returning();

  return res.status(201).json({ success: true, comment: newComment, post: updated });
}));

router.delete("/:id", requirePermission("content.delete"), asyncHandler(async (req, res) => {
  await db.delete(contentPostsTable).where(eq(contentPostsTable.id, (req.params.id as string)));
  return res.status(204).send();
}));

// ─── Approval Routes ─────────────────────────────────────────

router.post("/:id/approve", requirePermission("content.edit"), asyncHandler(async (req, res) => {
  const userId = (req as any).userId ?? null;
  const [row] = await db
    .update(contentPostsTable)
    .set({ approvalStatus: "APPROVED", approvedBy: userId, approvedAt: new Date() } as any)
    .where(eq(contentPostsTable.id, req.params.id as string))
    .returning();
  if (!row) throw createError("Not found", 404);
  return res.json(row);
}));

router.post("/:id/reject", requirePermission("content.edit"), asyncHandler(async (req, res) => {
  const { note } = req.body as { note?: string };
  const [row] = await db
    .update(contentPostsTable)
    .set({ approvalStatus: "REJECTED", rejectionNote: note ?? null } as any)
    .where(eq(contentPostsTable.id, req.params.id as string))
    .returning();
  if (!row) throw createError("Not found", 404);
  return res.json(row);
}));

// ─── Share Calendar Routes ────────────────────────────────────

router.post("/shares", requirePermission("content.create"), asyncHandler(async (req, res) => {
  const { clientId, label, expiresAt } = req.body;
  if (!clientId) throw createError("clientId is required", 400);
  if (!isValidUUID(clientId)) {
    throw createError("Invalid clientId format", 400);
  }

  const sanitized = sanitizeAndValidate({ clientId, label, expiresAt }, {
    uuids: ["clientId"],
    dates: ["expiresAt"],
  });

  const { randomUUID } = await import("crypto");

  // Check if an existing share record exists for this client
  const [existingShare] = await db
    .select()
    .from(clientCalendarSharesTable)
    .where(eq(clientCalendarSharesTable.clientId, sanitized.clientId))
    .limit(1);

  if (existingShare) {
    // Reuse existing record, update with new token, label, expiry and unrevoke
    const newShareToken = randomUUID();
    const [updatedShare] = await db
      .update(clientCalendarSharesTable)
      .set({
        shareToken: newShareToken,
        label: sanitized.label ?? existingShare.label ?? null,
        expiresAt: sanitized.expiresAt ?? null,
        isRevoked: "false",
        createdAt: new Date(),
      })
      .where(eq(clientCalendarSharesTable.id, existingShare.id))
      .returning();

    return res.status(200).json(updatedShare);
  }

  // First time creation if no share link exists for this client
  const shareId = randomUUID();
  const shareToken = randomUUID();

  const [share] = await db
    .insert(clientCalendarSharesTable)
    .values({
      id: shareId,
      clientId: sanitized.clientId,
      shareToken,
      label: sanitized.label ?? null,
      expiresAt: sanitized.expiresAt ?? null,
      isRevoked: "false",
    })
    .returning();

  return res.status(201).json(share);
}));

router.get("/shares", requirePermission("content.view"), asyncHandler(async (req, res) => {
  const { clientId } = req.query;
  const shares = await db
    .select()
    .from(clientCalendarSharesTable)
    .where(clientId ? eq(clientCalendarSharesTable.clientId, clientId as string) : undefined);
  return res.json(shares);
}));

router.post("/shares/:id/regenerate", requirePermission("content.create"), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { randomUUID } = await import("crypto");
  const newShareToken = randomUUID();

  const [updated] = await db
    .update(clientCalendarSharesTable)
    .set({
      shareToken: newShareToken,
      isRevoked: "false",
    })
    .where(eq(clientCalendarSharesTable.id, id))
    .returning();

  if (!updated) throw createError("Share link not found", 404);
  return res.json(updated);
}));

router.patch("/shares/:id", requirePermission("content.edit"), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { label, expiresAt, isRevoked } = req.body;

  const updateData: any = {};
  if (label !== undefined) updateData.label = label;
  if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
  if (isRevoked !== undefined) updateData.isRevoked = String(isRevoked);

  const [updated] = await db
    .update(clientCalendarSharesTable)
    .set(updateData)
    .where(eq(clientCalendarSharesTable.id, id))
    .returning();

  if (!updated) throw createError("Share link not found", 404);
  return res.json(updated);
}));

router.delete("/shares/:id", requirePermission("content.delete"), asyncHandler(async (req, res) => {
  const { id } = req.params;
  await db.delete(clientCalendarSharesTable).where(eq(clientCalendarSharesTable.id, id));
  return res.status(204).send();
}));

export default router;
