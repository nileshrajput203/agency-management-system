import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable, fileAttachmentsTable } from "@workspace/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate, isValidUUID } from "../lib/validation";
import {
  requirePermission,
  canManageEnabledSection,
  canManageTaskWorkspace,
  isManagerRole,
} from "../middleware/auth";
import { canEmployeeAccessTask } from "../middleware/taskAccess";

const router = Router();

const ENTITY_MODULES: Record<string, string> = {
  client: "clients",
  clients: "clients",
  project: "projects",
  projects: "projects",
  task: "tasks",
  tasks: "tasks",
  content: "content",
  invoice: "finance",
  invoices: "finance",
  quotation: "finance",
  quotations: "finance",
  proposal: "finance",
  proposals: "finance",
  purchase_order: "finance",
  "purchase-order": "finance",
  "work-report": "reports",
  leave: "leaves",
  attendance: "attendance",
};

function normalizeEntityType(entityType: unknown): string {
  const normalized = String(entityType ?? "").trim().toLowerCase();
  if (!ENTITY_MODULES[normalized]) {
    throw createError("Unsupported attachment entity type", 400);
  }
  return normalized;
}

function aliasesForEntity(entityType: string): string[] {
  const pairs: Record<string, string[]> = {
    client: ["client", "clients"],
    clients: ["client", "clients"],
    project: ["project", "projects"],
    projects: ["project", "projects"],
    task: ["task", "tasks"],
    tasks: ["task", "tasks"],
    invoice: ["invoice", "invoices"],
    invoices: ["invoice", "invoices"],
    quotation: ["quotation", "quotations"],
    quotations: ["quotation", "quotations"],
    proposal: ["proposal", "proposals"],
    proposals: ["proposal", "proposals"],
    purchase_order: ["purchase_order", "purchase-order"],
    "purchase-order": ["purchase_order", "purchase-order"],
  };
  return pairs[entityType] ?? [entityType];
}

async function assertEntityAccess(
  req: any,
  entityType: string,
  entityId: string,
): Promise<boolean> {
  const module = ENTITY_MODULES[entityType];
  if (module === "tasks") {
    const isPrivileged =
      canManageTaskWorkspace(req.userSystemRole, req.userConfiguredModules, req.userRoleText) ||
      isManagerRole(req.userSystemRole) ||
      isManagerRole(req.userRole) ||
      Boolean(req.userIsDelegatedAdmin);
    if (isPrivileged) return true;

    const [task] = await db
      .select({
        assigneeId: tasksTable.assigneeId,
        requestedBy: tasksTable.requestedBy,
        approvalStatus: tasksTable.approvalStatus,
        coAssignees: tasksTable.coAssignees,
      })
      .from(tasksTable)
      .where(eq(tasksTable.id, entityId));

    if (!task) throw createError("Task not found", 404);

    const isApprovedOrModified =
      task.approvalStatus === "APPROVED" ||
      task.approvalStatus === "MODIFIED" ||
      !task.approvalStatus;

    // Active tasks are accessible to all team members for uploading/viewing work
    if (!isApprovedOrModified && !canEmployeeAccessTask(task, req.userId)) {
      throw createError("Forbidden: You do not have access to this task's attachments", 403);
    }
    return true;
  }

  if (!canManageEnabledSection(req.userSystemRole, module, req.userConfiguredModules)) {
    throw createError(`Forbidden: Enable the ${module} section to access these attachments`, 403);
  }
  return true;
}

// GET /api/attachments?entityType=task&entityId=xxx
router.get("/", requirePermission("attachments.view"), asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.query as Record<string, string>;
  if (!entityType || !entityId) throw createError("entityType and entityId are required", 400);

  if (!isValidUUID(entityId)) {
    throw createError("Invalid entityId format", 400);
  }

  const normalizedType = normalizeEntityType(entityType);
  await assertEntityAccess(req, normalizedType, entityId);
  const result = await db
    .select()
    .from(fileAttachmentsTable)
    .where(and(
      inArray(fileAttachmentsTable.entityType, aliasesForEntity(normalizedType)),
      eq(fileAttachmentsTable.entityId, entityId),
    ))
    .orderBy(desc(fileAttachmentsTable.createdAt));
  return res.json(result);
}));

// POST /api/attachments
router.post("/", requirePermission("attachments.upload"), asyncHandler(async (req, res) => {
  const { entityType, entityId, filename, url } = req.body as {
    entityType: string;
    entityId: string;
    filename: string;
    url: string;
  };
  if (!entityType || !entityId || !filename || !url) {
    throw createError("entityType, entityId, filename, and url are required", 400);
  }

  if (!isValidUUID(entityId)) {
    throw createError("Invalid entityId format", 400);
  }

  const normalizedType = normalizeEntityType(entityType);
  await assertEntityAccess(req, normalizedType, entityId);
  const sanitized = sanitizeAndValidate({ entityType: normalizedType, entityId, filename, url });

  const uploadedBy = (req as any).userId ?? null;

  const [row] = await db.insert(fileAttachmentsTable).values({
    entityType: sanitized.entityType,
    entityId: sanitized.entityId,
    filename: sanitized.filename,
    url: sanitized.url,
    uploadedBy,
  }).returning();
  return res.status(201).json(row);
}));

// DELETE /api/attachments/:id
router.delete("/:id", requirePermission("attachments.upload"), asyncHandler(async (req, res) => {
  const id = String(req.params.id ?? "");
  if (!isValidUUID(id)) {
    throw createError("Invalid attachment ID format", 400);
  }
  const [attachment] = await db
    .select()
    .from(fileAttachmentsTable)
    .where(eq(fileAttachmentsTable.id, id));
  if (!attachment) {
    throw createError("Attachment not found", 404);
  }

  const userId = (req as any).userId;
  const normalizedType = normalizeEntityType(attachment.entityType);
  const canManageAttachment = await assertEntityAccess(req, normalizedType, attachment.entityId);
  if (!canManageAttachment && attachment.uploadedBy !== userId) {
    throw createError("Forbidden: You can only delete attachments you uploaded", 403);
  }

  await db.delete(fileAttachmentsTable).where(eq(fileAttachmentsTable.id, id));
  return res.status(204).send();
}));

export default router;
