import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";
import {
  getEffectiveModules,
  getModulePermissions,
  hasConfiguredModule,
  parseConfiguredModules,
  canManageModuleSection,
  canManageTaskWorkspace as canManageTaskWorkspaceFromModules,
} from "./moduleAccess";

export const PRIVILEGED_ROLES = ["SUPER_ADMIN"] as const;

export function isPrivilegedRole(systemRole?: string | null): boolean {
  if (!systemRole) return false;
  return PRIVILEGED_ROLES.includes(systemRole as any);
}

// Account managers have delegated access to modules such as Sales, but they
// are still employees for the task workspace. Only these roles can see and
// manage the company-wide task board.
export function canManageTaskWorkspace(systemRole?: string | null, allowedModules?: unknown): boolean {
  return canManageTaskWorkspaceFromModules(systemRole, allowedModules);
}

export function canManageEnabledSection(
  systemRole: string | null | undefined,
  module: string,
  allowedModules: unknown,
): boolean {
  return canManageModuleSection(systemRole, module, allowedModules);
}

export function canManageProjectWorkspace(systemRole?: string | null, allowedModules?: unknown): boolean {
  return canManageEnabledSection(systemRole, "projects", allowedModules);
}

export function canManageMeetingWorkspace(systemRole?: string | null, allowedModules?: unknown): boolean {
  return canManageEnabledSection(systemRole, "meetings", allowedModules);
}

export type UserRole = "ADMIN" | "EMPLOYEE";

export type Permission =
  | "users.manage"
  | "users.view"
  | "settings.view"
  | "settings.update"
  | "leave.approve"
  | "leave.apply"
  | "leave.view"
  | "attendance.view"
  | "attendance.manage"
  | "time.log"
  | "time.view"
  | "meetings.create"
  | "meetings.edit"
  | "meetings.delete"
  | "meetings.view"
  | "attachments.upload"
  | "attachments.view"
  | "projects.create"
  | "projects.edit"
  | "projects.delete"
  | "projects.view"
  | "tasks.create"
  | "tasks.edit"
  | "tasks.delete"
  | "tasks.view"
  | "content.create"
  | "content.edit"
  | "content.delete"
  | "content.view"
  | "invoices.create"
  | "invoices.edit"
  | "invoices.delete"
  | "invoices.view"
  | "quotations.create"
  | "quotations.edit"
  | "quotations.delete"
  | "quotations.view"
  | "proposals.create"
  | "proposals.edit"
  | "proposals.delete"
  | "proposals.view"
  | "purchase_orders.create"
  | "purchase_orders.edit"
  | "purchase_orders.delete"
  | "purchase_orders.view"
  | "sales.create"
  | "sales.edit"
  | "sales.delete"
  | "sales.view"
  | "clients.create"
  | "clients.edit"
  | "clients.delete"
  | "clients.view"
  | "reports.view";

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    "users.manage",
    "users.view",
    "settings.view",
    "settings.update",
    "leave.approve",
    "leave.apply",
    "leave.view",
    "attendance.view",
    "attendance.manage",
    "time.log",
    "time.view",
    "meetings.create",
    "meetings.edit",
    "meetings.delete",
    "meetings.view",
    "attachments.upload",
    "attachments.view",
    "projects.create",
    "projects.edit",
    "projects.delete",
    "projects.view",
    "tasks.create",
    "tasks.edit",
    "tasks.delete",
    "tasks.view",
    "content.create",
    "content.edit",
    "content.delete",
    "content.view",
    "invoices.create",
    "invoices.edit",
    "invoices.delete",
    "invoices.view",
    "quotations.create",
    "quotations.edit",
    "quotations.delete",
    "quotations.view",
    "proposals.create",
    "proposals.edit",
    "proposals.delete",
    "proposals.view",
    "purchase_orders.create",
    "purchase_orders.edit",
    "purchase_orders.delete",
    "purchase_orders.view",
    "sales.create",
    "sales.edit",
    "sales.delete",
    "sales.view",
    "clients.create",
    "clients.edit",
    "clients.delete",
    "clients.view",
    "reports.view",
  ],
  EMPLOYEE: [
    "leave.apply",
    "leave.view",
    "attendance.view",
    "time.log",
    "time.view",
    "users.view",
    "attachments.upload",
    "attachments.view",
    "projects.view",
    "projects.edit",
    "tasks.view",
    "tasks.edit",
    "content.view",
    "invoices.view",
    "quotations.view",
    "proposals.view",
    "sales.view",
    "clients.view",
    "reports.view",
  ],
};

export const requireAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = header.slice(7);
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const userId = payload.sub;

  const [user] = await db
    .select({
      isActive: usersTable.isActive,
      systemRole: usersTable.systemRole,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!user.isActive) {
    return res.status(401).json({ error: "Your account is inactive or pending approval." });
  }

  (req as Request & { userId: string }).userId = userId;
  (req as any).userSystemRole = user.systemRole;
  return next();
});

export function requirePermission(permission: Permission) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [user] = await db
      .select({
        systemRole: usersTable.systemRole,
        isActive: usersTable.isActive,
        allowedModules: usersTable.allowedModules,
        isDelegatedAdmin: usersTable.isDelegatedAdmin,
        portalMode: usersTable.portalMode,
        viewAllClients: usersTable.viewAllClients,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: "Your account is inactive or pending approval." });
    }

    const isSuperAdmin = user.systemRole === "SUPER_ADMIN";
    const isDelegated = Boolean(user.isDelegatedAdmin);
    const allowedModulesList = getEffectiveModules(user.allowedModules);
    const configuredModulesList = parseConfiguredModules(user.allowedModules);
    const role: UserRole = isSuperAdmin || canManageTaskWorkspace(user.systemRole, configuredModulesList)
      ? "ADMIN"
      : "EMPLOYEE";
    const effectivePermissions: string[] = isSuperAdmin
      ? [...ROLE_PERMISSIONS.ADMIN]
      : getModulePermissions(user.allowedModules);

    if (!effectivePermissions.includes(permission)) {
      return res.status(403).json({ error: `Forbidden: Missing required permission ${permission}` });
    }

    (req as any).userRole = role;
    (req as any).userSystemRole = user.systemRole;
    (req as any).userIsDelegatedAdmin = isDelegated;
    (req as any).userPortalMode = user.portalMode || "MODE_1";
    (req as any).userViewAllClients = Boolean(user.viewAllClients) || isSuperAdmin;
    (req as any).userAllowedModules = allowedModulesList;
    (req as any).userConfiguredModules = configuredModulesList ?? [];

    return next();
  });
}

export function requireRole(allowedRole: UserRole) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [user] = await db
      .select({
        systemRole: usersTable.systemRole,
        isActive: usersTable.isActive,
        isDelegatedAdmin: usersTable.isDelegatedAdmin,
        portalMode: usersTable.portalMode
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Your account is inactive or pending approval." });
    }

    const isSuperAdmin = user.systemRole === "SUPER_ADMIN";
    const isDelegatedAdmin = Boolean(user.isDelegatedAdmin);

    const role: UserRole = isSuperAdmin ? "ADMIN" : "EMPLOYEE";
    if (allowedRole === "ADMIN" && role !== "ADMIN") {
      return res.status(403).json({ error: `Forbidden: ${allowedRole} role required` });
    }

    (req as any).userRole = role;
    (req as any).userSystemRole = user.systemRole;
    (req as any).userIsDelegatedAdmin = Boolean(user.isDelegatedAdmin);

    return next();
  });
}
