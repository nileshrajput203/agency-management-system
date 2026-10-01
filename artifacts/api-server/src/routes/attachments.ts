import { Router } from "express";
import { db } from "@workspace/db";
import { tasksTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate, isValidUUID } from "../lib/validation";
import {
  requirePermission,
  canManageEnabledSection,
  canManageTaskWorkspace,
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
    if (canManageTaskWorkspace(req.userSystemRole, req.userConfiguredModules)) return true;
    const [task] = await db
      .select({
        assigneeId: tasksTable.assigneeId,
        requestedBy: tasksTable.requestedBy,
        approvalStatus: tasksTable.approvalStatus,
      })
      .from(tasksTable)
      .where(eq(tasksTable.id, entityId));
    if (!task || !canEmployeeAccessTask(task, req.userId)) {
      throw createError("Forbidden: You do not have access to this task's attachments", 403);
    }
    return false;
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
  const result = await db.execute(
    `SELECT * FROM file_attachments WHERE entity_type = ANY($1::text[]) AND entity_id = $2 ORDER BY created_at DESC`,
    [aliasesForEntity(normalizedType), entityId]
  );
  return res.json(result.rows ?? result);
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

  const result = await db.execute(
    `INSERT INTO file_attachments (id, entity_type, entity_id, filename, url, uploaded_by)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)
     RETURNING *`,
    [sanitized.entityType, sanitized.entityId, sanitized.filename, sanitized.url, uploadedBy]
  );
  const row = (result.rows ?? result)[0];
  return res.status(201).json(row);
}));

// DELETE /api/attachments/:id
router.delete("/:id", requirePermission("attachments.upload"), asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidUUID(id)) {
    throw createError("Invalid attachment ID format", 400);
  }
  const findResult = await db.execute(
    `SELECT * FROM file_attachments WHERE id = $1`,
    [id]
  );
  const attachment = (findResult.rows ?? findResult)[0] as any;
  if (!attachment) {
    throw createError("Attachment not found", 404);
  }

  const userId = (req as any).userId;
  const normalizedType = normalizeEntityType(attachment.entity_type);
  const canManageAttachment = await assertEntityAccess(req, normalizedType, attachment.entity_id);
  if (!canManageAttachment && attachment.uploaded_by !== userId) {
    throw createError("Forbidden: You can only delete attachments you uploaded", 403);
  }

  await db.execute(
    `DELETE FROM file_attachments WHERE id = $1`,
    [id]
  );
  return res.status(204).send();
}));

export default router;
