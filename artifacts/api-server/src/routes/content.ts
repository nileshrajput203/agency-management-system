import { Router } from "express";
import { db } from "@workspace/db";
import {
  contentPostsTable,
  clientsTable,
  clientCalendarSharesTable,
  tasksTable,
  projectsTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
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
      status: ["IDEA", "SCRIPTING", "SHOOTING", "DESIGNING", "PRODUCTION", "IN_REVIEW", "ADMIN_APPROVED", "SCHEDULED", "PUBLISHED", "SCHEDULING", "POSTED"],
      approvalStatus: ["PENDING", "APPROVED", "REJECTED", "NEEDS_CHANGES"],
      internalApprovalStatus: ["PENDING", "APPROVED", "CHANGES_REQUESTED", "REJECTED"],
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

  // Multi-Role Handoff & Coordination
  ideationAssignedTo: contentPostsTable.ideationAssignedTo,
  videographerId: contentPostsTable.videographerId,
  editorId: contentPostsTable.editorId,
  approverId: contentPostsTable.approverId,
  currentOwnerId: contentPostsTable.currentOwnerId,

  // Ideation, Script & On-Set Reference Pack
  conceptHook: contentPostsTable.conceptHook,
  scriptBody: contentPostsTable.scriptBody,
  scriptScenes: contentPostsTable.scriptScenes,
  trendingAudioUrl: contentPostsTable.trendingAudioUrl,
  shotList: contentPostsTable.shotList,
  shootLocation: contentPostsTable.shootLocation,
  shootTimeSlot: contentPostsTable.shootTimeSlot,
  shootEquipmentProps: contentPostsTable.shootEquipmentProps,

  // Production Handoff & Versioning
  rawFootageUrl: contentPostsTable.rawFootageUrl,
  shootCompletedAt: contentPostsTable.shootCompletedAt,
  videographerNotes: contentPostsTable.videographerNotes,
  mediaFiles: contentPostsTable.mediaFiles,
  coverImageUrl: contentPostsTable.coverImageUrl,
  qcChecklist: contentPostsTable.qcChecklist,
  internalApprovalStatus: contentPostsTable.internalApprovalStatus,
  internalApprovedBy: contentPostsTable.internalApprovedBy,
  internalApprovedAt: contentPostsTable.internalApprovedAt,
  isFastTrack: contentPostsTable.isFastTrack,

  createdAt: contentPostsTable.createdAt,
};

// ─── GET /api/content ─────────────────────────────────────────
router.get("/", requirePermission("content.view"), asyncHandler(async (req, res) => {
  const { clientId, month, status, currentOwnerId, internalApprovalStatus } = req.query as Record<string, string>;

  // Build WHERE conditions
  const conditions = [];
  if (clientId) conditions.push(eq(contentPostsTable.clientId, clientId));
  if (status) conditions.push(eq(contentPostsTable.status, status));
  if (currentOwnerId) conditions.push(eq(contentPostsTable.currentOwnerId, currentOwnerId));
  if (internalApprovalStatus) conditions.push(eq(contentPostsTable.internalApprovalStatus, internalApprovalStatus));

  // Filter by month (yyyy-MM)
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const { like } = await import("drizzle-orm");
    conditions.push(like(contentPostsTable.scheduledAt, `${month}%`));
  }

  const rows = await db
    .select(CONTENT_COLUMNS)
    .from(contentPostsTable)
    .leftJoin(clientsTable, eq(contentPostsTable.clientId, clientsTable.id))
    .where(conditions.length > 0 ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined)
    .orderBy(
      sql`CASE WHEN ${contentPostsTable.scheduledAt} IS NULL THEN 1 ELSE 0 END`,
      contentPostsTable.scheduledAt,
      desc(contentPostsTable.createdAt)
    );
  return res.json(rows);
}));

// ─── POST /api/content ────────────────────────────────────────
router.post("/", requirePermission("content.create"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, ...body } = req.body;
  const sanitized = sanitizeContentPost(body, false);

  if (sanitized.scheduledAt && isPastDate(sanitized.scheduledAt)) {
    throw createError("Post Date cannot be earlier than today's date. Please select today or a future date.", 400);
  }
  if (sanitized.shootDate && isPastDate(sanitized.shootDate)) {
    throw createError("Shoot Date cannot be earlier than today's date. Please select today or a future date.", 400);
  }

  // Preserve initial version in assetVersions if assetsLink or mediaFiles present
  if (sanitized.assetsLink || (Array.isArray(sanitized.mediaFiles) && sanitized.mediaFiles.length > 0)) {
    sanitized.assetVersions = [
      {
        version: 1,
        url: sanitized.assetsLink || sanitized.mediaFiles?.[0] || "",
        mediaFiles: sanitized.mediaFiles || [],
        uploadedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        uploadedBy: (req as any).userId || "system",
        uploadedByName: (req as any).userName || "Team Member",
        note: "Initial version upload",
      },
    ];
  }

  // Determine current active stage owner
  if (!sanitized.currentOwnerId) {
    if (["IDEA", "SCRIPTING"].includes(sanitized.status || "IDEA")) {
      sanitized.currentOwnerId = sanitized.ideationAssignedTo || sanitized.assigneeId;
    } else if (sanitized.status === "SHOOTING") {
      sanitized.currentOwnerId = sanitized.videographerId || sanitized.assigneeId;
    } else if (["PRODUCTION", "DESIGNING"].includes(sanitized.status)) {
      sanitized.currentOwnerId = sanitized.editorId || sanitized.assigneeId;
    } else if (sanitized.status === "IN_REVIEW") {
      sanitized.currentOwnerId = sanitized.approverId;
    }
  }

  // If assigneeId or role assignee is provided and no linkedTaskId exists, auto-create SOP task in Task Board
  const effectiveAssignee = sanitized.assigneeId || sanitized.ideationAssignedTo || sanitized.editorId || sanitized.videographerId;
  if (effectiveAssignee && !sanitized.linkedTaskId) {
    try {
      const [clientProject] = sanitized.clientId
        ? await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.clientId, sanitized.clientId)).limit(1)
        : [];

      const [task] = await db.insert(tasksTable).values({
        title: `[Content] ${sanitized.title || "Social Media Post"}`,
        projectId: clientProject?.id || null,
        assigneeId: effectiveAssignee,
        dueDate: (sanitized.shootDate || sanitized.scheduledAt)
          ? new Date(sanitized.shootDate || sanitized.scheduledAt)
          : new Date(Date.now() + 5 * 86400000),
        status: ["SCRIPTING", "DESIGNING", "PRODUCTION", "SHOOTING"].includes(sanitized.status) ? "IN_PROGRESS" : "TODO",
        priority: "MEDIUM",
        description: `Auto-linked from Content Studio: ${sanitized.format || sanitized.contentType || "Post"} for ${sanitized.platform || "Social"}.\n\nCaption/Hook: ${sanitized.conceptHook || sanitized.caption || "None"}`,
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

// ─── POST /api/content/batch-upload (Fast-Track Upload) ───────
router.post("/batch-upload", requirePermission("content.create"), asyncHandler(async (req, res) => {
  const { posts } = req.body || {};
  if (!Array.isArray(posts) || posts.length === 0) {
    throw createError("An array of posts is required for batch upload", 400);
  }

  const userId = (req as any).userId || "system";
  const createdList = [];

  for (const item of posts) {
    const postRecord: any = {
      title: item.title || "Ready Upload Post",
      clientId: item.clientId || null,
      platform: item.platform || "INSTAGRAM",
      contentType: item.contentType || (item.format === "CAROUSEL" ? "CAROUSEL" : "REEL"),
      format: item.format || "REEL",
      caption: item.caption || "",
      scheduledAt: item.scheduledAt || null,
      assetsLink: item.assetsLink || (Array.isArray(item.mediaFiles) ? item.mediaFiles[0] : null),
      mediaFiles: Array.isArray(item.mediaFiles) ? item.mediaFiles : (item.assetsLink ? [item.assetsLink] : []),
      coverImageUrl: item.coverImageUrl || null,
      status: "IN_REVIEW",
      internalApprovalStatus: "PENDING",
      isFastTrack: "true",
      assetVersions: [
        {
          version: 1,
          url: item.assetsLink || (Array.isArray(item.mediaFiles) ? item.mediaFiles[0] : ""),
          mediaFiles: Array.isArray(item.mediaFiles) ? item.mediaFiles : [],
          uploadedBy: userId,
          uploadedByName: (req as any).userName || "Editor",
          note: "Fast-track ready upload",
          createdAt: new Date().toISOString(),
        }
      ],
    };

    const [created] = await db.insert(contentPostsTable).values(postRecord).returning();
    createdList.push(created);
  }

  // Notify Managers
  await NotificationService.notifyAdminsAndManagers({
    type: "CONTENT_IN_REVIEW",
    title: `⚡ ${createdList.length} Fast-Track Post(s) Uploaded to Approval Queue`,
    message: `Ready for one-click PC review and scheduling.`,
    actionUrl: "/content",
  }).catch(() => {});

  return res.status(201).json({ success: true, count: createdList.length, posts: createdList });
}));

// ─── POST /api/content/batch-approve ─────────────────────────
router.post("/batch-approve", requirePermission("content.edit"), asyncHandler(async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    throw createError("IDs array is required", 400);
  }

  const userId = (req as any).userId ?? null;
  const updatedRows = await db
    .update(contentPostsTable)
    .set({
      status: "ADMIN_APPROVED",
      internalApprovalStatus: "APPROVED",
      approvalStatus: "APPROVED",
      internalApprovedBy: userId,
      internalApprovedAt: new Date(),
      approvedBy: userId,
      approvedAt: new Date(),
    })
    .where(inArray(contentPostsTable.id, ids))
    .returning();

  return res.json({ success: true, count: updatedRows.length, posts: updatedRows });
}));

// ─── POST /api/content/:id/handoff (Role & Stage Transitions) ─
router.post("/:id/handoff", requirePermission("content.edit"), asyncHandler(async (req, res) => {
  const contentId = req.params.id as string;
  const { action, payload } = req.body || {};

  const [post] = await db.select().from(contentPostsTable).where(eq(contentPostsTable.id, contentId));
  if (!post) throw createError("Content post not found", 404);

  const updates: any = {};
  const currentUserId = (req as any).userId;

  if (action === "TO_SHOOTING") {
    // Stage 1 -> Stage 2: Send brief & references to Videographer
    updates.status = "SHOOTING";
    if (payload?.videographerId) updates.videographerId = payload.videographerId;
    if (payload?.shootDate) updates.shootDate = payload.shootDate;
    if (payload?.shootTimeSlot) updates.shootTimeSlot = payload.shootTimeSlot;
    if (payload?.shootLocation) updates.shootLocation = payload.shootLocation;
    if (payload?.shotList) updates.shotList = payload.shotList;
    if (payload?.shootEquipmentProps) updates.shootEquipmentProps = payload.shootEquipmentProps;
    if (payload?.conceptHook) updates.conceptHook = payload.conceptHook;
    if (payload?.scriptBody) updates.scriptBody = payload.scriptBody;
    if (payload?.scriptScenes) updates.scriptScenes = payload.scriptScenes;
    if (payload?.referenceLinks) updates.referenceLinks = payload.referenceLinks;
    if (payload?.trendingAudioUrl) updates.trendingAudioUrl = payload.trendingAudioUrl;

    const targetVideographer = payload?.videographerId || post.videographerId;
    updates.currentOwnerId = targetVideographer || null;

    if (targetVideographer) {
      await NotificationService.createNotification({
        userId: targetVideographer,
        type: "TASK_ASSIGNED",
        title: `🎥 New Shoot Brief: ${post.title || "Content Post"}`,
        message: `Brief, script, and shot list ready for shoot on ${payload?.shootDate || post.shootDate || "scheduled date"}.`,
        actionUrl: "/employee/content",
      }).catch(() => {});
    }
  } else if (action === "TO_PRODUCTION") {
    // Stage 2 -> Stage 3: Videographer hands off raw footage to Editor
    updates.status = "PRODUCTION";
    updates.shootCompletedAt = new Date();
    if (payload?.rawFootageUrl) updates.rawFootageUrl = payload.rawFootageUrl;
    if (payload?.videographerNotes) updates.videographerNotes = payload.videographerNotes;
    if (payload?.editorId) updates.editorId = payload.editorId;

    const targetEditor = payload?.editorId || post.editorId;
    updates.currentOwnerId = targetEditor || null;

    if (targetEditor) {
      await NotificationService.createNotification({
        userId: targetEditor,
        type: "TASK_ASSIGNED",
        title: `🎬 Raw Footage Ready for Editing: ${post.title || "Content Post"}`,
        message: `Videographer uploaded raw footage. Best takes and notes attached.`,
        actionUrl: "/employee/content",
      }).catch(() => {});
    }
  } else if (action === "TO_IN_REVIEW") {
    // Stage 3 -> Stage 4: Editor sends finished deliverable for internal approval
    updates.status = "IN_REVIEW";
    updates.internalApprovalStatus = "PENDING";
    updates.currentOwnerId = payload?.approverId || post.approverId || null;

    if (payload?.assetsLink || payload?.mediaFiles) {
      if (payload.assetsLink) updates.assetsLink = payload.assetsLink;
      if (payload.mediaFiles) updates.mediaFiles = payload.mediaFiles;
      if (payload.coverImageUrl) updates.coverImageUrl = payload.coverImageUrl;

      const existingVersions = Array.isArray(post.assetVersions) ? [...(post.assetVersions as any[])] : [];
      const newVersionNum = existingVersions.length + 1;
      existingVersions.push({
        version: newVersionNum,
        url: payload.assetsLink || (payload.mediaFiles?.[0] || ""),
        mediaFiles: payload.mediaFiles || [],
        uploadedBy: currentUserId || "system",
        uploadedByName: (req as any).userName || "Editor",
        note: payload.note || `Version ${newVersionNum} uploaded`,
        createdAt: new Date().toISOString(),
      });
      updates.assetVersions = existingVersions;
    }

    if (payload?.qcChecklist) {
      updates.qcChecklist = payload.qcChecklist;
    }

    // Notify Approver / Admins
    await NotificationService.notifyAdminsAndManagers({
      type: "CONTENT_IN_REVIEW",
      title: `👀 Edit Ready for Approval: ${post.title || "Content Post"}`,
      message: `Editor has submitted a new version for PC review and proofing.`,
      actionUrl: "/content",
    }).catch(() => {});
  } else if (action === "ROUTE_REVISION") {
    // Revision routing: send back to Editor, Videographer, or Strategist
    const { targetRole, revisionNote, timestampSec, frameCoordX, frameCoordY } = payload || {};
    updates.needsRevision = "true";
    updates.internalApprovalStatus = "CHANGES_REQUESTED";

    if (targetRole === "VIDEOGRAPHER") {
      updates.status = "SHOOTING";
      updates.currentOwnerId = post.videographerId;
    } else if (targetRole === "STRATEGIST") {
      updates.status = "SCRIPTING";
      updates.currentOwnerId = post.ideationAssignedTo;
    } else {
      // Default to Editor
      updates.status = "PRODUCTION";
      updates.currentOwnerId = post.editorId;
    }

    // Add revision note as a timestamped comment
    if (revisionNote) {
      const existingComments = Array.isArray(post.comments) ? [...(post.comments as any[])] : [];
      existingComments.push({
        id: crypto.randomUUID(),
        userId: currentUserId,
        comment: `[Revision Request] ${revisionNote}`,
        timestampSec: timestampSec !== undefined ? Number(timestampSec) : null,
        frameCoordX: frameCoordX !== undefined ? Number(frameCoordX) : null,
        frameCoordY: frameCoordY !== undefined ? Number(frameCoordY) : null,
        createdAt: new Date().toISOString(),
      });
      updates.comments = existingComments;
    }

    if (updates.currentOwnerId) {
      await NotificationService.createNotification({
        userId: updates.currentOwnerId,
        type: "TASK_ASSIGNED",
        title: `⚠️ Revision Requested: ${post.title || "Content Post"}`,
        message: revisionNote ? `Feedback: ${revisionNote}` : `Please review feedback and update the asset.`,
        actionUrl: "/employee/content",
      }).catch(() => {});
    }
  }

  // Update post
  const [updated] = await db
    .update(contentPostsTable)
    .set(updates)
    .where(eq(contentPostsTable.id, contentId))
    .returning();

  // Sync linked task if exists
  if (updated.linkedTaskId) {
    try {
      let taskStatus = "TODO";
      if (["SCRIPTING", "SHOOTING", "PRODUCTION", "DESIGNING"].includes(updated.status)) taskStatus = "IN_PROGRESS";
      else if (updated.status === "IN_REVIEW") taskStatus = "IN_REVIEW";
      else if (["ADMIN_APPROVED", "SCHEDULED", "PUBLISHED"].includes(updated.status)) taskStatus = "COMPLETED";

      await db.update(tasksTable).set({
        status: taskStatus,
        assigneeId: updated.currentOwnerId || post.assigneeId,
      }).where(eq(tasksTable.id, updated.linkedTaskId));
    } catch (tErr) {
      logger.warn({ tErr }, "Could not sync linked task on handoff");
    }
  }

  return res.json({ success: true, post: updated });
}));

// ─── POST /api/content/ai-script-generate ─────────────────────
router.post("/ai-script-generate", requirePermission("content.create"), asyncHandler(async (req, res) => {
  const { topic, clientName, platform, format, referenceNotes } = req.body || {};

  const cleanTopic = topic || "Growth strategies for modern brands";
  const brand = clientName || "our brand";

  // Generate structured hook, script, and shot list
  const generated = {
    conceptHook: `Stop making this huge mistake if you want to scale ${cleanTopic}. Here's the 3-step playbook.`,
    scriptBody: `Hook: Stop making this huge mistake if you want to scale ${cleanTopic}.\n\nPoint 1: Most people start by focusing on vanity metrics, but what actually drives results is consistent, targeted value.\n\nPoint 2: At ${brand}, we test 5 variations of creative hooks before spending any ad budget.\n\nCall to Action: Comment "PLAYBOOK" below and we'll DM you the complete framework.`,
    scriptScenes: [
      {
        id: crypto.randomUUID(),
        sceneNo: 1,
        timecode: "0:00 - 0:03",
        visualDirection: "Fast zoom-in on presenter holding phone or product, sharp dynamic cut",
        spokenAudio: `Stop making this huge mistake with ${cleanTopic}!`,
        onScreenText: "STOP DOING THIS 🚨",
      },
      {
        id: crypto.randomUUID(),
        sceneNo: 2,
        timecode: "0:03 - 0:12",
        visualDirection: "Cut to B-roll showing behind-the-scenes dashboard or workflow with screen recording overlay",
        spokenAudio: "Most teams waste 80% of their effort here. Here is what actually moves the needle.",
        onScreenText: "THE 80/20 PRINCIPLE 📈",
      },
      {
        id: crypto.randomUUID(),
        sceneNo: 3,
        timecode: "0:12 - 0:25",
        visualDirection: "Medium shot with dynamic hands gesture, quick whip pan to product demo",
        spokenAudio: `Implement this 3-step framework we use at ${brand} to get 3x more conversions.`,
        onScreenText: "3X CONVERSIONS 🔥",
      },
      {
        id: crypto.randomUUID(),
        sceneNo: 4,
        timecode: "0:25 - 0:30",
        visualDirection: "Presenter smiles, points down to caption area with high-energy finish",
        spokenAudio: "Save this reel and comment 'PLAYBOOK' for the free cheat sheet!",
        onScreenText: "COMMENT 'PLAYBOOK' 💬",
      },
    ],
    shotList: [
      {
        id: crypto.randomUUID(),
        shotNumber: 1,
        framing: "CLOSE_UP",
        cameraMovement: "STATIC",
        description: "Presenter direct-to-camera intro hook. Sharp eye contact with high energy.",
        lightingAudioNote: "Key light at 45 degrees, lapel mic clipped at center chest",
        isCaptured: false,
        bestTakeNote: "",
      },
      {
        id: crypto.randomUUID(),
        shotNumber: 2,
        framing: "B_ROLL",
        cameraMovement: "GIMBAL",
        description: "Smooth push-in on laptop screen showing dashboard metrics / client report.",
        lightingAudioNote: "Natural daylight + soft fill light to reduce screen reflection",
        isCaptured: false,
        bestTakeNote: "",
      },
      {
        id: crypto.randomUUID(),
        shotNumber: 3,
        framing: "MEDIUM",
        cameraMovement: "HANDHELD",
        description: "Presenter explaining framework with subtle organic handheld motion.",
        lightingAudioNote: "Consistent warm fill, boom mic overhead",
        isCaptured: false,
        bestTakeNote: "",
      },
      {
        id: crypto.randomUUID(),
        shotNumber: 4,
        framing: "TRANSITION",
        cameraMovement: "PAN",
        description: "Fast whip-pan transition from left to right covering the cut.",
        lightingAudioNote: "High shutter speed (1/120s) for crisp motion blur",
        isCaptured: false,
        bestTakeNote: "",
      },
      {
        id: crypto.randomUUID(),
        shotNumber: 5,
        framing: "CLOSE_UP",
        cameraMovement: "STATIC",
        description: "Outro CTA: Presenter points down to caption box with friendly smile.",
        lightingAudioNote: "Ring light / softbox front lighting",
        isCaptured: false,
        bestTakeNote: "",
      },
    ],
  };

  return res.json({ success: true, ...generated });
}));

// ─── GET /api/content/shoot-sheet-pdf ─────────────────────────
router.get("/shoot-sheet-pdf", requirePermission("content.view"), asyncHandler(async (req, res) => {
  const { date, clientId } = req.query as { date?: string; clientId?: string };
  if (!date) throw createError("Query parameter 'date' (YYYY-MM-DD) is required", 400);

  const conditions = [eq(contentPostsTable.shootDate, date)];
  if (clientId) conditions.push(eq(contentPostsTable.clientId, clientId));

  const posts = await db
    .select(CONTENT_COLUMNS)
    .from(contentPostsTable)
    .leftJoin(clientsTable, eq(contentPostsTable.clientId, clientsTable.id))
    .where(conditions.length === 1 ? conditions[0] : and(...conditions));

  const clientName = posts[0]?.clientName || "BlinkBeyond Client";

  const postsHtml = posts.map((p, idx) => {
    const scenes = Array.isArray(p.scriptScenes) ? p.scriptScenes : [];
    const shots = Array.isArray(p.shotList) ? p.shotList : [];
    const refs = Array.isArray(p.referenceLinks) ? p.referenceLinks : [];

    const scenesRows = scenes.map((s: any) => `
      <tr>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;font-weight:700;text-align:center">${s.sceneNo || 1}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;font-family:monospace;font-size:11px">${s.timecode || "0:00"}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0">${s.visualDirection || "—"}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0">${s.spokenAudio || "—"}</td>
        <td style="padding:6px 10px;border:1px solid #e2e8f0;font-weight:600;color:#6366f1">${s.onScreenText || "—"}</td>
      </tr>
    `).join("");

    const shotsRows = shots.map((sh: any) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:11.5px">
        <div>
          <span style="font-weight:700;margin-right:8px">[ ] Shot ${sh.shotNumber}:</span>
          <span style="display:inline-block;padding:1px 6px;border-radius:4px;background:#f3f4f6;font-size:10px;font-weight:600;margin-right:6px">${sh.framing}</span>
          <span style="display:inline-block;padding:1px 6px;border-radius:4px;background:#eef2ff;color:#4f46e5;font-size:10px;font-weight:600;margin-right:8px">${sh.cameraMovement}</span>
          <span>${sh.description}</span>
        </div>
        <div style="font-family:monospace;color:#64748b;font-size:11px">Best Take: ________</div>
      </div>
    `).join("");

    return `
      <div style="border:1px solid #cbd5e1;border-radius:8px;padding:16px;margin-bottom:24px;page-break-inside:avoid;background:#ffffff">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #6366f1;padding-bottom:8px;margin-bottom:12px">
          <div>
            <span style="background:#6366f1;color:#ffffff;font-size:11px;font-weight:800;padding:2px 8px;border-radius:4px;margin-right:8px">POST #${idx+1}</span>
            <strong style="font-size:15px;color:#0f172a">${p.title || "Social Post"}</strong>
            <span style="color:#64748b;font-size:12px;margin-left:8px">(${p.format || p.contentType || "Reel"})</span>
          </div>
          <div style="font-size:11px;color:#64748b">Location: <strong>${p.shootLocation || "Studio"}</strong> | Time: <strong>${p.shootTimeSlot || "Morning"}</strong></div>
        </div>

        ${p.conceptHook ? `
          <div style="background:#f8fafc;border-left:4px solid #f59e0b;padding:8px 12px;margin-bottom:12px;font-size:12px">
            <strong style="color:#d97706">Visual & Verbal Hook:</strong> ${p.conceptHook}
          </div>
        ` : ""}

        ${scenes.length > 0 ? `
          <div style="margin-bottom:12px">
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#475569;margin-bottom:6px">Scene-by-Scene Script Breakdown:</div>
            <table style="width:100%;border-collapse:collapse;font-size:11.5px">
              <thead>
                <tr style="background:#f1f5f9;color:#334155;text-align:left">
                  <th style="padding:6px 10px;border:1px solid #e2e8f0;width:30px">#</th>
                  <th style="padding:6px 10px;border:1px solid #e2e8f0;width:70px">Time</th>
                  <th style="padding:6px 10px;border:1px solid #e2e8f0">Visual Direction</th>
                  <th style="padding:6px 10px;border:1px solid #e2e8f0">Spoken Audio</th>
                  <th style="padding:6px 10px;border:1px solid #e2e8f0">On-Screen Text</th>
                </tr>
              </thead>
              <tbody>${scenesRows}</tbody>
            </table>
          </div>
        ` : ""}

        ${shots.length > 0 ? `
          <div>
            <div style="font-size:11px;font-weight:800;text-transform:uppercase;color:#475569;margin-bottom:6px">On-Set Shot Checklist:</div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px">${shotsRows}</div>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");

  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Shoot Call Sheet — ${date}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; margin: 24px; }
        @media print { body { margin: 12px; } }
      </style>
    </head>
    <body>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:20px">
        <div>
          <h1 style="margin:0;font-size:24px;font-weight:900;letter-spacing:-0.5px">SHOOT DAY CALL SHEET</h1>
          <p style="margin:4px 0 0 0;color:#64748b;font-size:13px">Client: <strong>${clientName}</strong> | Scheduled Date: <strong>${date}</strong></p>
        </div>
        <div style="text-align:right">
          <div style="font-size:20px;font-weight:800;color:#6366f1">${posts.length} Posts to Shoot</div>
          <div style="font-size:11px;color:#94a3b8">BlinkBeyond Production Studio</div>
        </div>
      </div>

      ${postsHtml || "<p>No posts scheduled for this shoot date.</p>"}

      <div style="margin-top:30px;padding-top:14px;border-top:1px dashed #cbd5e1;display:flex;justify-content:space-between;font-size:11px;color:#64748b">
        <div>Videographer Sign-Off: ____________________</div>
        <div>Total Raw Footage Links / Hard Drives Collected: [  ]</div>
        <div>Date Completed: ____________________</div>
      </div>
    </body>
    </html>
  `;

  res.setHeader("Content-Type", "text/html");
  return res.send(fullHtml);
}));

// ─── PATCH /api/content/:id ───────────────────────────────────
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
      mediaFiles: sanitized.mediaFiles || [sanitized.assetsLink],
      uploadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      uploadedBy: (req as any).userId || "system",
      uploadedByName: (req as any).userName || "Team Member",
      note: body.versionNote || `Version ${versions.length + 1}`,
    });
    sanitized.assetVersions = versions;
  }

  // Update currentOwnerId based on stage if changed
  if (sanitized.status && sanitized.status !== existing.status && !sanitized.currentOwnerId) {
    if (["IDEA", "SCRIPTING"].includes(sanitized.status)) {
      sanitized.currentOwnerId = sanitized.ideationAssignedTo || existing.ideationAssignedTo || existing.assigneeId;
    } else if (sanitized.status === "SHOOTING") {
      sanitized.currentOwnerId = sanitized.videographerId || existing.videographerId || existing.assigneeId;
    } else if (["PRODUCTION", "DESIGNING"].includes(sanitized.status)) {
      sanitized.currentOwnerId = sanitized.editorId || existing.editorId || existing.assigneeId;
    } else if (sanitized.status === "IN_REVIEW") {
      sanitized.currentOwnerId = sanitized.approverId || existing.approverId;
    }
  }

  // Bi-directional Auto-Sync: create linked task if assignee was just added
  let targetTaskId = existing.linkedTaskId || sanitized.linkedTaskId;
  const effectiveAssignee = sanitized.currentOwnerId || sanitized.assigneeId || existing.assigneeId;

  if (!targetTaskId && effectiveAssignee) {
    try {
      const [clientProject] = (sanitized.clientId || existing.clientId)
        ? await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.clientId, sanitized.clientId || existing.clientId)).limit(1)
        : [];

      const [newTask] = await db.insert(tasksTable).values({
        title: `[Content] ${sanitized.title || existing.title || "Social Post"}`,
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
      if (["SCRIPTING", "DESIGNING", "PRODUCTION", "SHOOTING"].includes(sanitized.status)) {
        await db.update(tasksTable).set({ status: "IN_PROGRESS" }).where(eq(tasksTable.id, targetTaskId));
      } else if (sanitized.status === "IN_REVIEW") {
        await db.update(tasksTable).set({ status: "IN_REVIEW" }).where(eq(tasksTable.id, targetTaskId));
      } else if (["ADMIN_APPROVED", "SCHEDULED", "PUBLISHED"].includes(sanitized.status)) {
        await db.update(tasksTable).set({ status: "COMPLETED" }).where(eq(tasksTable.id, targetTaskId));
      }
    } catch (syncErr) {
      logger.warn({ syncErr }, "Failed to sync content status to linked task");
    }
  }

  const [row] = await db
    .update(contentPostsTable)
    .set(sanitized)
    .where(eq(contentPostsTable.id, contentId))
    .returning();

  return res.json(row);
}));

// ─── POST /api/content/:id/comments/pin ───────────────────────
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

// ─── DELETE /api/content/:id ──────────────────────────────────
router.delete("/:id", requirePermission("content.delete"), asyncHandler(async (req, res) => {
  await db.delete(contentPostsTable).where(eq(contentPostsTable.id, (req.params.id as string)));
  return res.status(204).send();
}));

// ─── Approval Routes ──────────────────────────────────────────
router.post("/:id/approve", requirePermission("content.edit"), asyncHandler(async (req, res) => {
  const userId = (req as any).userId ?? null;
  const [row] = await db
    .update(contentPostsTable)
    .set({
      approvalStatus: "APPROVED",
      internalApprovalStatus: "APPROVED",
      status: "ADMIN_APPROVED",
      approvedBy: userId,
      approvedAt: new Date(),
      internalApprovedBy: userId,
      internalApprovedAt: new Date(),
    } as any)
    .where(eq(contentPostsTable.id, req.params.id as string))
    .returning();
  if (!row) throw createError("Not found", 404);
  return res.json(row);
}));

router.post("/:id/reject", requirePermission("content.edit"), asyncHandler(async (req, res) => {
  const { note } = req.body as { note?: string };
  const [row] = await db
    .update(contentPostsTable)
    .set({
      approvalStatus: "REJECTED",
      internalApprovalStatus: "REJECTED",
      rejectionNote: note ?? null,
    } as any)
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

  const [existingShare] = await db
    .select()
    .from(clientCalendarSharesTable)
    .where(eq(clientCalendarSharesTable.clientId, sanitized.clientId))
    .limit(1);

  if (existingShare) {
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
  const id = req.params.id as string;
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
  const id = req.params.id as string;
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
  const id = req.params.id as string;
  await db.delete(clientCalendarSharesTable).where(eq(clientCalendarSharesTable.id, id));
  return res.status(204).send();
}));

export default router;
