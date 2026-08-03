import { Router } from "express";
import { db } from "@workspace/db";
import { clientCalendarSharesTable, contentPostsTable, clientsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { NotificationService } from "../services/notificationService";
import { logger, notificationLogger } from "../lib/logger";

const router = Router();

async function getValidShare(shareToken: string) {
  const [share] = await db
    .select()
    .from(clientCalendarSharesTable)
    .where(eq(clientCalendarSharesTable.shareToken, shareToken));

  if (!share) {
    return { error: "Share link not found", status: 404 };
  }

  if (share.isRevoked === "true") {
    return { error: "This share link has been disabled or revoked", status: 410 };
  }

  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return { error: "This share link has expired", status: 410 };
  }

  return { share };
}

// ─── GET Client Shared Calendar ──────────────────────────────
router.get("/calendar/:shareToken", async (req, res) => {
  try {
    const { shareToken } = req.params;
    const result = await getValidShare(shareToken);

    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }

    const { share } = result;

    const [client] = await db
      .select({
        id: clientsTable.id,
        companyName: clientsTable.companyName,
        logoUrl: clientsTable.logoUrl,
      })
      .from(clientsTable)
      .where(eq(clientsTable.id, share.clientId));

    const posts = await db
      .select()
      .from(contentPostsTable)
      .where(eq(contentPostsTable.clientId, share.clientId));

    return res.json({
      label: share.label || `${client?.companyName || "Client"} Content Calendar`,
      clientId: share.clientId,
      clientName: client?.companyName || "Client",
      clientLogo: client?.logoUrl || null,
      expiresAt: share.expiresAt,
      posts,
    });
  } catch (err) {
    console.error("[publicCalendar] Error fetching calendar:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Approve Post ──────────────────────────────────────────────
router.post("/calendar/:shareToken/approve/:postId", async (req, res) => {
  try {
    const { shareToken, postId } = req.params;
    const result = await getValidShare(shareToken);
    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }

    const { share } = result;

    const [post] = await db
      .select()
      .from(contentPostsTable)
      .where(and(eq(contentPostsTable.id, postId), eq(contentPostsTable.clientId, share.clientId)));

    if (!post) {
      return res.status(404).json({ error: "Content item not found" });
    }

    const [updatedPost] = await db
      .update(contentPostsTable)
      .set({
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
        rejectionNote: null,
        needsRevision: "false",
      })
      .where(eq(contentPostsTable.id, postId))
      .returning();

    // Notify agency team
    const [client] = await db.select({ companyName: clientsTable.companyName }).from(clientsTable).where(eq(clientsTable.id, share.clientId));
    const clientName = client?.companyName || "Client";
    const postTitle = post.title || post.caption?.slice(0, 30) || "Scheduled Post";
    const nowFormatted = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

    NotificationService.notifyAdminsAndManagers({
      title: `Content Approved - ${clientName}`,
      message: `${clientName} approved "${postTitle}".\nAction: ✓ Approved by Client\nDate: ${nowFormatted}`,
      type: "CONTENT",
      priority: "MEDIUM",
      actionUrl: `/content?postId=${postId}`,
      referenceId: postId,
      referenceType: "CONTENT",
    }).catch((err) => notificationLogger.error({ err }, "Error notifying team of content approval"));

    return res.json(updatedPost);
  } catch (err) {
    logger.error({ err }, "[publicCalendar] Error approving post");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Reject Post ──────────────────────────────────────────────
router.post("/calendar/:shareToken/reject/:postId", async (req, res) => {
  try {
    const { shareToken, postId } = req.params;
    const { reason } = req.body as { reason?: string };

    const result = await getValidShare(shareToken);
    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }

    const { share } = result;

    const [post] = await db
      .select()
      .from(contentPostsTable)
      .where(and(eq(contentPostsTable.id, postId), eq(contentPostsTable.clientId, share.clientId)));

    if (!post) {
      return res.status(404).json({ error: "Content item not found" });
    }

    const rejectionNote = reason?.trim() || "Rejected by client";

    const [updatedPost] = await db
      .update(contentPostsTable)
      .set({
        approvalStatus: "REJECTED",
        rejectionNote,
        needsRevision: "true",
      })
      .where(eq(contentPostsTable.id, postId))
      .returning();

    // Notify agency team
    const [client] = await db.select({ companyName: clientsTable.companyName }).from(clientsTable).where(eq(clientsTable.id, share.clientId));
    const clientName = client?.companyName || "Client";
    const postTitle = post.title || post.caption?.slice(0, 30) || "Scheduled Post";
    const nowFormatted = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

    NotificationService.notifyAdminsAndManagers({
      title: `Content Rejected - ${clientName}`,
      message: `${clientName} rejected "${postTitle}".\nAction: Content Rejected\nReason: "${rejectionNote}"\nDate: ${nowFormatted}`,
      type: "CONTENT",
      priority: "HIGH",
      actionUrl: `/content?postId=${postId}`,
      referenceId: postId,
      referenceType: "CONTENT",
    }).catch((err) => notificationLogger.error({ err }, "Error notifying team of content rejection"));

    return res.json(updatedPost);
  } catch (err) {
    logger.error({ err }, "[publicCalendar] Error rejecting post");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Request Changes ──────────────────────────────────────────
router.post("/calendar/:shareToken/request-changes/:postId", async (req, res) => {
  try {
    const { shareToken, postId } = req.params;
    const { subject, category, description, priority, attachmentUrl } = req.body as {
      subject?: string;
      category?: string;
      description?: string;
      priority?: string;
      attachmentUrl?: string;
    };

    const result = await getValidShare(shareToken);
    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }

    const { share } = result;

    const [post] = await db
      .select()
      .from(contentPostsTable)
      .where(and(eq(contentPostsTable.id, postId), eq(contentPostsTable.clientId, share.clientId)));

    if (!post) {
      return res.status(404).json({ error: "Content item not found" });
    }

    const commentText = `[CLIENT REVISION REQUEST - ${category ? category.toUpperCase() : "GENERAL"} - ${priority || "NORMAL"}]\nSubject: ${subject || "Revision Requested"}\nDescription: ${description || "No details provided"}${attachmentUrl ? `\nAttachment: ${attachmentUrl}` : ""}`;

    const existingComments = Array.isArray(post.comments) ? post.comments : [];
    const newComment = {
      id: crypto.randomUUID(),
      userId: null,
      comment: commentText,
      createdAt: new Date().toISOString(),
    };

    const updatedComments = [...existingComments, newComment];

    const [updatedPost] = await db
      .update(contentPostsTable)
      .set({
        approvalStatus: "NEEDS_CHANGES",
        needsRevision: "true",
        rejectionNote: `${subject || "Revision"}: ${description || ""}`,
        comments: updatedComments,
      })
      .where(eq(contentPostsTable.id, postId))
      .returning();

    // Notify agency team
    const [client] = await db.select({ companyName: clientsTable.companyName }).from(clientsTable).where(eq(clientsTable.id, share.clientId));
    const clientName = client?.companyName || "Client";
    const postTitle = post.title || post.caption?.slice(0, 30) || "Scheduled Post";
    const nowFormatted = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

    NotificationService.notifyAdminsAndManagers({
      title: `Client Requested Revision - ${clientName}`,
      message: `${clientName} requested changes on "${postTitle}".\nAction: Client Revision Requested (${category || "General"})\nSubject: ${subject || "Revision Requested"}\nReason: "${description || "No details provided"}"\nDate: ${nowFormatted}`,
      type: "CONTENT",
      priority: priority === "URGENT" ? "URGENT" : "HIGH",
      actionUrl: `/content?postId=${postId}`,
      referenceId: postId,
      referenceType: "CONTENT",
    }).catch((err) => notificationLogger.error({ err }, "Error notifying team of change request"));

    return res.json(updatedPost);
  } catch (err) {
    logger.error({ err }, "[publicCalendar] Error requesting changes");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Submit Content Idea ─────────────────────────────────────
router.post("/calendar/:shareToken/ideas", async (req, res) => {
  try {
    const { shareToken } = req.params;
    const { title, description, platform, contentType, category } = req.body as {
      title?: string;
      description?: string;
      platform?: string;
      contentType?: string;
      category?: string;
    };

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Idea title is required" });
    }

    const result = await getValidShare(shareToken);
    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }

    const { share } = result;

    const [newPost] = await db
      .insert(contentPostsTable)
      .values({
        clientId: share.clientId,
        title: title.trim(),
        caption: description?.trim() || null,
        ideation: description?.trim() || null,
        status: "IDEA",
        approvalStatus: "PENDING",
        platform: platform || "INSTAGRAM",
        contentType: contentType || "POST",
        format: category || "CLIENT_IDEA",
      })
      .returning();

    // Notify agency team
    const [client] = await db.select({ companyName: clientsTable.companyName }).from(clientsTable).where(eq(clientsTable.id, share.clientId));
    const clientName = client?.companyName || "Client";

    NotificationService.notifyAdminsAndManagers({
      title: "New Client Content Idea",
      message: `${clientName} submitted a new content idea: "${title.trim()}"`,
      type: "CONTENT",
      priority: "MEDIUM",
      actionUrl: "/content",
      referenceId: newPost.id,
      referenceType: "CONTENT",
    }).catch((err) => notificationLogger.error({ err }, "Error notifying team of content idea"));

    return res.status(201).json(newPost);
  } catch (err) {
    logger.error({ err }, "[publicCalendar] Error submitting idea");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

