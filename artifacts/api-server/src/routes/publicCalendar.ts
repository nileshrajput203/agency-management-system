import { Router } from "express";
import { db } from "@workspace/db";
import {
  clientCalendarSharesTable,
  contentPostsTable,
  clientsTable,
  tasksTable,
  proposalsTable,
  invoicesTable,
  quotationsTable,
  projectsTable,
  projectMilestonesTable,
} from "@workspace/db/schema";
import { eq, and, desc, asc, or, inArray } from "drizzle-orm";
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

    // Reopen linked task in Task Board with URGENT priority
    if (post.linkedTaskId) {
      try {
        await db.update(tasksTable).set({
          status: "IN_PROGRESS",
          priority: "URGENT",
          assignmentNote: `[Client Revision Request]: ${subject || "Revision"}: ${description || ""}`,
        }).where(eq(tasksTable.id, post.linkedTaskId));
      } catch (tErr) {
        logger.warn({ tErr }, "Failed to reopen linked task for revision");
      }
    }

    // Notify agency team
    const [client] = await db.select({ companyName: clientsTable.companyName }).from(clientsTable).where(eq(clientsTable.id, share.clientId));
    const clientName = client?.companyName || "Client";
    const postTitle = post.title || post.caption?.slice(0, 30) || "Scheduled Post";
    const nowFormatted = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

    // Instant high-priority notification to assigned designer/editor
    if (post.assigneeId) {
      NotificationService.createNotification({
        userId: post.assigneeId,
        title: `🚨 Client Revision Requested: ${postTitle}`,
        message: `${clientName} requested changes: ${subject || "Revision"} - ${description || ""}`,
        type: "CONTENT",
        priority: "URGENT",
        actionUrl: `/content?postId=${postId}`,
        referenceId: postId,
        referenceType: "CONTENT",
      }).catch(() => {});
    }

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

// ─── Public Frame.io-Style Pin Comment on Video/Image ───────────
router.post("/calendar/:shareToken/posts/:postId/pin-comment", async (req, res) => {
  try {
    const { shareToken, postId } = req.params;
    const { comment, timestampSec, frameCoordX, frameCoordY, authorName } = req.body || {};

    if (!comment || typeof comment !== "string" || !comment.trim()) {
      return res.status(400).json({ error: "Comment text is required" });
    }

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

    const existingComments = Array.isArray(post.comments) ? [...(post.comments as any[])] : [];
    const newComment = {
      id: crypto.randomUUID(),
      userId: null,
      authorName: authorName || "Client Reviewer",
      comment: comment.trim(),
      timestampSec: timestampSec !== undefined && timestampSec !== null ? Number(timestampSec) : null,
      frameCoordX: frameCoordX !== undefined && frameCoordX !== null ? Number(frameCoordX) : null,
      frameCoordY: frameCoordY !== undefined && frameCoordY !== null ? Number(frameCoordY) : null,
      createdAt: new Date().toISOString(),
    };

    existingComments.push(newComment);

    const [updated] = await db
      .update(contentPostsTable)
      .set({ comments: existingComments })
      .where(eq(contentPostsTable.id, postId))
      .returning();

    return res.status(201).json({ success: true, comment: newComment });
  } catch (err) {
    logger.error({ err }, "[publicCalendar] Error pinning visual comment");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Public Client Portal (Deliverables, Content, Projects, Invoices) ───
router.get(["/portal/:token", "/client-portal/:token"], async (req, res) => {
  try {
    const token = req.params.token;
    const [client] = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.portalToken, token));

    if (!client) {
      return res.status(404).json({ error: "Client portal not found or expired token" });
    }

    // 1. Content posts
    const posts = await db
      .select()
      .from(contentPostsTable)
      .where(eq(contentPostsTable.clientId, client.id))
      .orderBy(asc(contentPostsTable.scheduledAt));

    // 2. Projects & Milestones
    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.clientId, client.id))
      .orderBy(desc(projectsTable.createdAt));

    const projectIds = projects.map(p => p.id);
    let milestones: any[] = [];
    if (projectIds.length > 0) {
      milestones = await db
        .select()
        .from(projectMilestonesTable)
        .where(inArray(projectMilestonesTable.projectId, projectIds))
        .orderBy(asc(projectMilestonesTable.orderIndex));
    }

    // 3. Proposals
    const proposals = await db
      .select()
      .from(proposalsTable)
      .where(eq(proposalsTable.clientId, client.id))
      .orderBy(desc(proposalsTable.createdAt));

    // 4. Invoices
    const invoices = await db
      .select({
        id: invoicesTable.id,
        number: invoicesTable.number,
        invoiceType: invoicesTable.invoiceType,
        status: invoicesTable.status,
        paymentStatus: invoicesTable.paymentStatus,
        invoiceDate: invoicesTable.invoiceDate,
        dueDate: invoicesTable.dueDate,
        subtotal: invoicesTable.subtotal,
        taxAmount: invoicesTable.taxAmount,
        total: invoicesTable.total,
        currency: invoicesTable.currency,
      })
      .from(invoicesTable)
      .where(eq(invoicesTable.clientId, client.id))
      .orderBy(desc(invoicesTable.createdAt));

    return res.json({
      client: {
        id: client.id,
        companyName: client.companyName,
        contactPerson: client.contactPerson,
        email: client.email,
        phone: client.phone,
        category: client.category,
        brandKit: client.brandKit || {},
        deliverableQuotas: client.deliverableQuotas || [],
        monthlyRetainer: client.monthlyRetainer || 0,
      },
      posts,
      projects,
      milestones,
      proposals,
      invoices,
    });
  } catch (err) {
    logger.error({ err }, "[publicPortal] Error retrieving client portal data");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Public Interactive Web Proposal & E-Signature ───────────────
router.get(["/proposals/:token", "/proposal/:token"], async (req, res) => {
  try {
    const token = req.params.token;
    const [proposal] = await db
      .select()
      .from(proposalsTable)
      .where(or(eq(proposalsTable.shareToken, token), eq(proposalsTable.id, token)));

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found or link expired" });
    }

    let client = null;
    if (proposal.clientId) {
      const [c] = await db.select({ companyName: clientsTable.companyName, contactPerson: clientsTable.contactPerson, email: clientsTable.email }).from(clientsTable).where(eq(clientsTable.id, proposal.clientId));
      client = c || null;
    }

    return res.json({
      ...proposal,
      clientName: client?.companyName || proposal.clientName,
      pricingTiers: proposal.pricingTiers || [],
      optionalAddOns: proposal.optionalAddOns || [],
      selectedTierId: proposal.selectedTierId || null,
      selectedAddOnIds: proposal.selectedAddOnIds || [],
      signatureName: proposal.signatureName || null,
      signedAt: proposal.signedAt || null,
    });
  } catch (err) {
    logger.error({ err }, "[publicProposal] Error fetching proposal");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post(["/proposals/:token/accept", "/proposals/:token/sign"], async (req, res) => {
  try {
    const token = req.params.token;
    const { signatureName, selectedTierId, selectedAddOnIds = [] } = req.body || {};

    if (!signatureName || typeof signatureName !== "string" || !signatureName.trim()) {
      return res.status(400).json({ error: "Full signature name is required to accept" });
    }

    const [proposal] = await db
      .select()
      .from(proposalsTable)
      .where(or(eq(proposalsTable.shareToken, token), eq(proposalsTable.id, token)));

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    const now = new Date();

    const [updated] = await db
      .update(proposalsTable)
      .set({
        status: "APPROVED",
        signatureName: signatureName.trim(),
        signedAt: now,
        selectedTierId: selectedTierId || proposal.selectedTierId,
        selectedAddOnIds: Array.isArray(selectedAddOnIds) ? selectedAddOnIds : [],
        updatedAt: now,
      })
      .where(eq(proposalsTable.id, proposal.id))
      .returning();

    // Auto-create draft quotation for accounting
    try {
      const qNum = `Q-${Date.now().toString().slice(-6)}`;
      const totalAmount = Number(proposal.total) || 50000;
      await db.insert(quotationsTable).values({
        number: qNum,
        clientId: proposal.clientId,
        clientName: proposal.clientName || "Client",
        quotationDate: now.toISOString().split("T")[0],
        status: "APPROVED",
        currency: "INR",
        subtotal: totalAmount,
        taxAmount: Math.round(totalAmount * 0.18),
        total: Math.round(totalAmount * 1.18),
        notes: `Auto-generated quotation from approved interactive proposal "${proposal.title}" signed by ${signatureName.trim()}.`,
      });
    } catch (_) {}

    // Notify agency team
    NotificationService.notifyAdminsAndManagers({
      title: "🎉 Proposal Accepted & Digitally Signed!",
      message: `"${proposal.title}" was approved & signed by ${signatureName.trim()} (${proposal.clientName || "Client"}).`,
      type: "FINANCE",
      priority: "URGENT",
      actionUrl: `/proposals`,
      referenceId: proposal.id,
      referenceType: "PROPOSAL",
    }).catch(() => {});

    return res.json({ success: true, message: "Proposal accepted and signed successfully", proposal: updated });
  } catch (err) {
    logger.error({ err }, "[publicProposal] Error accepting proposal");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

