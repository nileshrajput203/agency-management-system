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

export function isManagerRole(systemRole?: string | null): boolean {
  if (!systemRole) return false;
  const normalized = String(systemRole).trim().toUpperCase();
  const managerRoles = [
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "PROJECT_MANAGER",
    "ACCOUNT_MANAGER",
    "DIRECTOR",
    "LEAD",
    "PRODUCTION_COORDINATOR",
    "PROJECT_COORDINATOR",
    "COORDINATOR",
    "PC",
    "CREATIVE_DIRECTOR",
    "CONTENT_LEAD",
    "HEAD_OF_CONTENT",
    "OPERATIONS",
    "FOUNDER",
    "CEO",
    "COO",
    "HR",
  ];
  return managerRoles.some((r) => normalized.includes(r)) || managerRoles.includes(normalized);
}

export function isPrivilegedRole(systemRole?: string | null): boolean {
  if (!systemRole) return false;
  return PRIVILEGED_ROLES.includes(systemRole as any);
}

// Account managers have delegated access to modules such as Sales, but they
// are still employees for the task workspace. Only these roles can see and
// manage the company-wide task board.
export function canManageTaskWorkspace(systemRole?: string | null, allowedModules?: unknown, role?: string | null): boolean {
  if (isManagerRole(systemRole) || isManagerRole(role)) return true;
  return canManageTaskWorkspaceFromModules(systemRole, allowedModules);
}

export function canManageEnabledSection(
  systemRole: string | null | undefined,
  module: string,
  allowedModules: unknown,
): boolean {
  if (isManagerRole(systemRole) && ["projects", "tasks", "content", "clients", "meetings", "reports"].includes(module)) {
    return true;
  }
  return canManageModuleSection(systemRole, module, allowedModules);
}

export function canManageProjectWorkspace(systemRole?: string | null, allowedModules?: unknown, role?: string | null): boolean {
  if (isManagerRole(systemRole) || isManagerRole(role)) return true;
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
      role: usersTable.role,
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
  (req as any).userRoleText = user.role;
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
        role: usersTable.role,
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

    const isSuperAdmin = user.systemRole === "SUPER_ADMIN" || user.role === "SUPER_ADMIN";
    const isDelegated = Boolean(user.isDelegatedAdmin);
    const isManager = isManagerRole(user.systemRole) || isManagerRole(user.role) || isDelegated;
    const allowedModulesList = getEffectiveModules(user.allowedModules);
    const configuredModulesList = parseConfiguredModules(user.allowedModules);
    const role: UserRole = isSuperAdmin || isManager || canManageTaskWorkspace(user.systemRole, configuredModulesList, user.role)
      ? "ADMIN"
      : "EMPLOYEE";
    const basePermissions: string[] = isSuperAdmin
      ? [...ROLE_PERMISSIONS.ADMIN]
      : getModulePermissions(user.allowedModules);

    const effectivePermissions = new Set<string>(basePermissions);
    if (isManager) {
      const managerDefaultPermissions = [
        "projects.create",
        "projects.edit",
        "projects.view",
        "projects.delete",
        "tasks.create",
        "tasks.edit",
        "tasks.view",
        "tasks.delete",
        "content.create",
        "content.edit",
        "content.view",
        "clients.create",
        "clients.edit",
        "clients.view",
        "meetings.create",
        "meetings.edit",
        "meetings.view",
        "time.view",
        "time.log",
        "attendance.view",
        "reports.view",
        "attachments.view",
        "attachments.upload",
        "users.view",
      ];
      for (const p of managerDefaultPermissions) {
        effectivePermissions.add(p);
      }
    }

    if (!effectivePermissions.has(permission)) {
      return res.status(403).json({ error: `Forbidden: Missing required permission ${permission}` });
    }

    (req as any).userRole = role;
    (req as any).userSystemRole = user.systemRole;
    (req as any).userRoleText = user.role;
    (req as any).userIsDelegatedAdmin = isDelegated;
    (req as any).userPortalMode = user.portalMode || "MODE_1";
    (req as any).userViewAllClients = Boolean(user.viewAllClients) || isSuperAdmin || isManager;
    (req as any).userAllowedModules = allowedModulesList;
    (req as any).userConfiguredModules = configuredModulesList ?? [];

    return next();
  });
}

export function requireAnyPermission(...permissions: Permission[]) {
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
    const isManager = isManagerRole(user.systemRole) || isDelegated;
    const allowedModulesList = getEffectiveModules(user.allowedModules);
    const configuredModulesList = parseConfiguredModules(user.allowedModules);
    const role: UserRole = isSuperAdmin || isManager || canManageTaskWorkspace(user.systemRole, configuredModulesList)
      ? "ADMIN"
      : "EMPLOYEE";
    const basePermissions: string[] = isSuperAdmin
      ? [...ROLE_PERMISSIONS.ADMIN]
      : getModulePermissions(user.allowedModules);

    const effectivePermissions = new Set<string>(basePermissions);
    if (isManager) {
      const managerDefaultPermissions = [
        "projects.create",
        "projects.edit",
        "projects.view",
        "projects.delete",
        "tasks.create",
        "tasks.edit",
        "tasks.view",
        "tasks.delete",
        "clients.create",
        "clients.edit",
        "clients.view",
        "meetings.create",
        "meetings.edit",
        "meetings.view",
        "time.view",
        "time.log",
        "attendance.view",
        "reports.view",
        "attachments.view",
        "attachments.upload",
        "users.view",
      ];
      for (const p of managerDefaultPermissions) {
        effectivePermissions.add(p);
      }
    }

    const hasAny = permissions.some((p) => effectivePermissions.has(p));
    if (!hasAny) {
      return res.status(403).json({ error: `Forbidden: Missing required permission (one of ${permissions.join(", ")})` });
    }

    (req as any).userRole = role;
    (req as any).userSystemRole = user.systemRole;
    (req as any).userIsDelegatedAdmin = isDelegated;
    (req as any).userPortalMode = user.portalMode || "MODE_1";
    (req as any).userViewAllClients = Boolean(user.viewAllClients) || isSuperAdmin || isManager;
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
