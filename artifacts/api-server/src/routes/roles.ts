import { Router } from "express";
import { db } from "@workspace/db";
import { rolesTable, auditLogsTable, usersTable } from "@workspace/db/schema";
import { asc, eq } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import { createError } from "../middleware/errorHandler";
import { requirePermission } from "../middleware/auth";

const router = Router();

router.get("/", requirePermission("users.view"), asyncHandler(async (_req, res) => {
  const roles = await db
    .select({ id: rolesTable.id, name: rolesTable.name, description: rolesTable.description })
    .from(rolesTable)
    .where(eq(rolesTable.deletedAt, null))
    .orderBy(asc(rolesTable.name));
  return res.json(roles);
}));

router.post("/", requirePermission("users.manage"), asyncHandler(async (req, res) => {
  const rawName = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const name = rawName.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (name.length < 2) throw createError("Role name must contain at least two letters or numbers", 400);
  if (["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(name)) {
    throw createError("That role already exists", 409);
  }

  const [role] = await db
    .insert(rolesTable)
    .values({
      name,
      description: typeof req.body?.description === "string" ? req.body.description.trim().slice(0, 240) : null,
      createdBy: (req as any).userId,
    })
    .onConflictDoNothing()
    .returning({ id: rolesTable.id, name: rolesTable.name, description: rolesTable.description });
  if (!role) throw createError("A role with that name already exists", 409);
  const [adminUser] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, (req as any).userId));
  await db.insert(auditLogsTable).values({
    adminUserId: (req as any).userId,
    adminUserName: adminUser?.name || "Administrator",
    // audit_logs targets users today; retain the required target id while
    // identifying the newly-created role in the target name and details.
    targetUserId: (req as any).userId,
    targetUserName: `Role: ${role.name}`,
    action: "ROLE_CREATED",
    permissionsAdded: [],
    permissionsRemoved: [],
    reason: "Custom role created",
    details: JSON.stringify({ roleId: role.id, roleName: role.name, description: role.description }),
  });
  return res.status(201).json(role);
}));

export default router;