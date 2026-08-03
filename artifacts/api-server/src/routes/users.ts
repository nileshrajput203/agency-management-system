import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, auditLogsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { hash } from "bcryptjs";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { sanitizeAndValidate } from "../lib/validation";
import { requirePermission } from "../middleware/auth";
import { syncUserEmployeeAndRole } from "../services/userService";

const router = Router();

function sanitizeUser(body: any, isUpdate = false) {
  return sanitizeAndValidate(body, {
    enums: {
      systemRole: ["SUPER_ADMIN", "ACCOUNT_MANAGER", "CREATIVE_STRATEGIST", "DESIGNER", "DEVELOPER", "CONTENT_CREATOR", "CLIENT"],
      portalMode: ["MODE_1", "MODE_2"],
    }
  });
}

const USER_SAFE_COLS = {
  id: usersTable.id,
  name: usersTable.name,
  email: usersTable.email,
  role: usersTable.role,
  systemRole: usersTable.systemRole,
  department: usersTable.department,
  isActive: usersTable.isActive,
  allowedModules: usersTable.allowedModules,
  isDelegatedAdmin: usersTable.isDelegatedAdmin,
  portalMode: usersTable.portalMode,
  viewAllClients: usersTable.viewAllClients,
};

function parseModules(row: any) {
  let mods: string[] = [];
  if (Array.isArray(row.allowedModules)) {
    mods = row.allowedModules as string[];
  } else if (typeof row.allowedModules === "string" && row.allowedModules) {
    try {
      mods = JSON.parse(row.allowedModules);
    } catch {
      mods = row.allowedModules.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
  }
  return {
    ...row,
    allowedModules: mods,
    isDelegatedAdmin: Boolean(row.isDelegatedAdmin),
    portalMode: row.portalMode || "MODE_1",
    viewAllClients: Boolean(row.viewAllClients),
  };
}

router.get("/audit-logs", requirePermission("users.view"), asyncHandler(async (req, res) => {
  const logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(100);
  return res.json(logs);
}));

router.get("/", requirePermission("users.view"), asyncHandler(async (req, res) => {
  const rows = await db.select(USER_SAFE_COLS).from(usersTable);
  return res.json(rows.map(parseModules));
}));

router.post("/", requirePermission("users.manage"), asyncHandler(async (req, res) => {
  const { name, email, password, systemRole, department, isActive, allowedModules, isDelegatedAdmin, portalMode, viewAllClients } = req.body;
  if (!name || !email) throw createError("Name and email are required", 400);

  const sanitized = sanitizeUser({ systemRole, department, isActive, portalMode }, false);

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));
  if (existing) throw createError("User with this email already exists", 409);

  const passwordHash = password ? await hash(password, 12) : null;

  const [row] = await db
    .insert(usersTable)
    .values({
      name,
      email,
      password: passwordHash,
      systemRole: sanitized.systemRole || "ACCOUNT_MANAGER",
      role: sanitized.systemRole || "ACCOUNT_MANAGER",
      department: sanitized.department || null,
      isActive: sanitized.isActive !== undefined ? sanitized.isActive : true,
      allowedModules: Array.isArray(allowedModules) ? allowedModules : [],
      isDelegatedAdmin: Boolean(isDelegatedAdmin),
      portalMode: sanitized.portalMode || "MODE_1",
      viewAllClients: Boolean(viewAllClients),
    })
    .returning(USER_SAFE_COLS);

  await syncUserEmployeeAndRole(row);

  return res.status(201).json(parseModules(row));
}));

router.patch("/:id", requirePermission("users.manage"), asyncHandler(async (req, res) => {
  const { id: _id, createdAt: _ts, password: _pw, auditReason, ...body } = req.body;

  const targetId = req.params.id as string;
  const currentUserId = (req as any).userId;
  const performingUserRole = (req as any).userSystemRole;

  const isPerformingAdmin = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNT_MANAGER"].includes(performingUserRole ?? "");

  if (!isPerformingAdmin && (body.isDelegatedAdmin !== undefined || body.portalMode !== undefined || body.viewAllClients !== undefined)) {
    throw createError("Forbidden: Only Administrators can modify delegated administrative privileges.", 403);
  }

  if (targetId === currentUserId) {
    if (body.isActive === false) {
      throw createError("You cannot deactivate your own account.", 400);
    }
    if (body.isDelegatedAdmin !== undefined || body.portalMode !== undefined || body.viewAllClients !== undefined) {
      throw createError("Forbidden: You cannot modify your own delegated administrative permissions.", 403);
    }
  }

  if (body.email) {
    const [conflict] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, body.email));
    if (conflict && conflict.id !== targetId) {
      throw createError("Email is already in use by another account", 409);
    }
  }

  // Retrieve old user for audit logging
  const [oldUser] = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
  if (!oldUser) throw createError("User not found", 404);

  const sanitized = sanitizeUser(body, true);
  const updateData: Record<string, unknown> = { ...sanitized };
  if (sanitized.systemRole) updateData.role = sanitized.systemRole;
  if (body.allowedModules !== undefined) updateData.allowedModules = Array.isArray(body.allowedModules) ? body.allowedModules : [];
  if (body.isDelegatedAdmin !== undefined) updateData.isDelegatedAdmin = Boolean(body.isDelegatedAdmin);
  if (body.portalMode !== undefined) updateData.portalMode = body.portalMode;
  if (body.viewAllClients !== undefined) updateData.viewAllClients = Boolean(body.viewAllClients);

  const [row] = await db
    .update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, targetId))
    .returning(USER_SAFE_COLS);

  if (!row) throw createError("User not found", 404);

  await syncUserEmployeeAndRole(row);

  // Record Audit Log if delegated permissions or allowed modules were modified
  const oldMods: string[] = Array.isArray(oldUser.allowedModules) ? (oldUser.allowedModules as string[]) : [];
  const newMods: string[] = Array.isArray(updateData.allowedModules) ? (updateData.allowedModules as string[]) : oldMods;
  const addedMods = newMods.filter(m => !oldMods.includes(m));
  const removedMods = oldMods.filter(m => !newMods.includes(m));

  if (
    body.isDelegatedAdmin !== undefined ||
    body.portalMode !== undefined ||
    body.viewAllClients !== undefined ||
    body.allowedModules !== undefined
  ) {
    const isRevocation = body.isDelegatedAdmin === false && oldUser.isDelegatedAdmin === true;
    const [adminUser] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, currentUserId));

    await db.insert(auditLogsTable).values({
      adminUserId: currentUserId,
      adminUserName: adminUser?.name || "Administrator",
      targetUserId: targetId,
      targetUserName: oldUser.name,
      action: isRevocation ? "DELEGATED_ACCESS_REVOKED" : "DELEGATED_ACCESS_UPDATED",
      permissionsAdded: addedMods,
      permissionsRemoved: removedMods,
      reason: auditReason || (isRevocation ? "Delegated administrative access revoked" : "Delegated access & module permissions updated"),
      details: JSON.stringify({
        isDelegatedAdmin: updateData.isDelegatedAdmin ?? oldUser.isDelegatedAdmin,
        portalMode: updateData.portalMode ?? oldUser.portalMode,
        viewAllClients: updateData.viewAllClients ?? oldUser.viewAllClients,
      }),
    });
  }

  return res.json(parseModules(row));
}));

router.delete("/:id", requirePermission("users.manage"), asyncHandler(async (req, res) => {
  await db.delete(usersTable).where(eq(usersTable.id, (req.params.id as string)));
  return res.status(204).send();
}));

export default router;
