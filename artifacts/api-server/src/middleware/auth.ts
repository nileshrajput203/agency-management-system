import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { asyncHandler } from "../lib/asyncHandler";

export const PRIVILEGED_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ACCOUNT_MANAGER"] as const;

export function isPrivilegedRole(systemRole?: string | null): boolean {
  if (!systemRole) return false;
  return PRIVILEGED_ROLES.includes(systemRole as any);
}

// Account managers have delegated access to modules such as Sales, but they
// are still employees for the task workspace. Only these roles can see and
// manage the company-wide task board.
export const TASK_MANAGER_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER"] as const;

export function isTaskManagerRole(systemRole?: string | null): boolean {
  if (!systemRole) return false;
  return TASK_MANAGER_ROLES.includes(systemRole as any);
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

    const isPrivileged = isPrivilegedRole(user.systemRole);
    const isDelegated = Boolean(user.isDelegatedAdmin);
    const role: UserRole = isPrivileged ? "ADMIN" : "EMPLOYEE";

    const getModulesList = (val: unknown): string[] => {
      if (Array.isArray(val)) return val as string[];
      if (typeof val === "string" && val) {
        try {
          const parsed = JSON.parse(val);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return val.split(",").map((s) => s.trim()).filter(Boolean);
        }
      }
      return [];
    };

    const allowedModulesList = getModulesList(user.allowedModules);

    let effectivePermissions: string[] = isPrivileged ? [...ROLE_PERMISSIONS.ADMIN] : [...ROLE_PERMISSIONS.EMPLOYEE];

    if (!isPrivileged && isDelegated) {
      // Map allowedModules to administrative permissions for delegated employees
      if (allowedModulesList.length === 0) {
        effectivePermissions = [...ROLE_PERMISSIONS.ADMIN];
      } else {
        const MODULE_DELEGATED_PERMISSIONS: Record<string, string[]> = {
          clients: ["clients.view", "clients.create", "clients.edit", "clients.delete"],
          sales: ["sales.view", "sales.create", "sales.edit", "sales.delete"],
          projects: ["projects.view", "projects.create", "projects.edit", "projects.delete"],
          tasks: ["tasks.view", "tasks.create", "tasks.edit", "tasks.delete"],
          content: ["content.view", "content.create", "content.edit", "content.delete"],
          invoices: ["invoices.view", "invoices.create", "invoices.edit", "invoices.delete"],
          quotations: ["quotations.view", "quotations.create", "quotations.edit", "quotations.delete"],
          proposals: ["proposals.view", "proposals.create", "proposals.edit", "proposals.delete"],
          purchaseOrders: ["purchase_orders.view", "purchase_orders.create", "purchase_orders.edit", "purchase_orders.delete"],
          purchase_orders: ["purchase_orders.view", "purchase_orders.create", "purchase_orders.edit", "purchase_orders.delete"],
          finance: [
            "invoices.view", "invoices.create", "invoices.edit", "invoices.delete",
            "quotations.view", "quotations.create", "quotations.edit", "quotations.delete",
            "proposals.view", "proposals.create", "proposals.edit", "proposals.delete",
            "purchase_orders.view", "purchase_orders.create", "purchase_orders.edit", "purchase_orders.delete"
          ],
          leaves: ["leave.view", "leave.apply", "leave.approve"],
          leave: ["leave.view", "leave.apply", "leave.approve"],
          attendance: ["attendance.view", "attendance.manage"],
          team: ["users.view", "users.manage"],
          users: ["users.view", "users.manage"],
          userManagement: ["users.view", "users.manage"],
          settings: ["settings.view", "settings.update"],
          reports: ["reports.view"],
        };

        for (const mod of allowedModulesList) {
          if (MODULE_DELEGATED_PERMISSIONS[mod]) {
            effectivePermissions.push(...MODULE_DELEGATED_PERMISSIONS[mod]);
          }
        }
      }
    }

    if (!effectivePermissions.includes(permission)) {
      return res.status(403).json({ error: `Forbidden: Missing required permission ${permission}` });
    }

    // Enforce allowedModules restriction on base permissions only when explicit allowedModules are configured on account
    if (!isPrivileged && !isDelegated && allowedModulesList.length > 0) {
      const PERMISSION_TO_MODULE: Record<string, string[]> = {
        "clients.create": ["clients"], "clients.edit": ["clients"], "clients.delete": ["clients"], "clients.view": ["clients"],
        "projects.create": ["projects"], "projects.edit": ["projects"], "projects.delete": ["projects"], "projects.view": ["projects"],
        "tasks.create": ["tasks"], "tasks.edit": ["tasks"], "tasks.delete": ["tasks"], "tasks.view": ["tasks"],
        "content.create": ["content"], "content.edit": ["content"], "content.delete": ["content"], "content.view": ["content"],
        "invoices.create": ["invoices", "finance"], "invoices.edit": ["invoices", "finance"], "invoices.delete": ["invoices", "finance"], "invoices.view": ["invoices", "finance"],
        "quotations.create": ["quotations", "finance"], "quotations.edit": ["quotations", "finance"], "quotations.delete": ["quotations", "finance"], "quotations.view": ["quotations", "finance"],
        "proposals.create": ["proposals", "finance"], "proposals.edit": ["proposals", "finance"], "proposals.delete": ["proposals", "finance"], "proposals.view": ["proposals", "finance"],
        "leave.apply": ["leaves", "leave"], "leave.approve": ["leaves", "leave"], "leave.view": ["leaves", "leave"],
        "attendance.view": ["attendance"], "attendance.manage": ["attendance"],
        "sales.create": ["sales"], "sales.edit": ["sales"], "sales.delete": ["sales"], "sales.view": ["sales"],
        "purchase_orders.create": ["purchaseOrders", "purchase_orders", "finance"], "purchase_orders.edit": ["purchaseOrders", "purchase_orders", "finance"], "purchase_orders.delete": ["purchaseOrders", "purchase_orders", "finance"], "purchase_orders.view": ["purchaseOrders", "purchase_orders", "finance"],
        "users.manage": ["team", "users", "userManagement"], "settings.view": ["settings"], "settings.update": ["settings"],
        "attachments.upload": ["attachments"], "attachments.view": ["attachments"],
        "reports.view": ["reports"],
      };

      const acceptableModules = PERMISSION_TO_MODULE[permission];
      if (acceptableModules && !acceptableModules.some((m) => allowedModulesList.includes(m))) {
        return res.status(403).json({ error: `Forbidden: Module for permission ${permission} is disabled for your account.` });
      }
    }

    (req as any).userRole = role;
    (req as any).userSystemRole = user.systemRole;
    (req as any).userIsDelegatedAdmin = isDelegated;
    (req as any).userPortalMode = user.portalMode || "MODE_1";
    (req as any).userViewAllClients = Boolean(user.viewAllClients) || isPrivileged;
    (req as any).userAllowedModules = allowedModulesList;

    next();
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

    const isPrivileged = isPrivilegedRole(user.systemRole);
    const isDelegatedAdmin = Boolean(user.isDelegatedAdmin);

    const role: UserRole = (isPrivileged || isDelegatedAdmin) ? "ADMIN" : "EMPLOYEE";
    if (allowedRole === "ADMIN" && role !== "ADMIN") {
      return res.status(403).json({ error: `Forbidden: ${allowedRole} role required` });
    }

    (req as any).userRole = role;
    (req as any).userSystemRole = user.systemRole;
    (req as any).userIsDelegatedAdmin = Boolean(user.isDelegatedAdmin);

    next();
  });
}
