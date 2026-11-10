// @ts-nocheck
import type { SystemRole } from "@/generated/prisma/client";

export type ModuleKey =
  | "dashboard"
  | "clients"
  | "sales"
  | "projects"
  | "tasks"
  | "time"
  | "finance"
  | "content"
  | "hr"
  | "team"
  | "reports"
  | "attendance"
  | "leaves"
  | "settings"
  | "automation";

export type PermissionAction = "view" | "create" | "edit" | "delete";

type ModulePermissions = Partial<Record<PermissionAction, boolean>>;

export const DEFAULT_EMPLOYEE_MODULES: ModuleKey[] = [
  "tasks",
  "attendance",
  "leaves",
  "reports",
];

export function getExplicitUserModules(allowedModules?: unknown): string[] {
  if (Array.isArray(allowedModules) && allowedModules.length > 0) {
    return allowedModules.map(String).map((module) => module.trim()).filter(Boolean);
  }
  if (typeof allowedModules === "string" && allowedModules.trim()) {
    try {
      const parsed = JSON.parse(allowedModules);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((module) => module.trim()).filter(Boolean);
      }
    } catch {
      const parsed = allowedModules.split(",").map((module) => module.trim()).filter(Boolean);
      if (parsed.length > 0) return parsed;
    }
  }
  return [];
}

export function getUserModules(allowedModules?: unknown, role?: string): string[] {
  const configured = getExplicitUserModules(allowedModules);
  const modules = new Set<string>();

  for (const m of configured) {
    modules.add(m);
  }

  // Finance alias / sub-module bidirectional mapping
  const financeSubModules = ["invoices", "quotations", "purchaseOrders", "purchase_orders", "proposals", "expenses", "excelReports", "vendors"];
  if (configured.some(m => financeSubModules.includes(m))) {
    modules.add("finance");
  }
  if (configured.includes("finance")) {
    financeSubModules.forEach(sm => modules.add(sm));
  }

  // Alias purchase_orders <-> purchaseOrders
  if (modules.has("purchaseOrders")) modules.add("purchase_orders");
  if (modules.has("purchase_orders")) modules.add("purchaseOrders");

  // Alias leaves <-> leave
  if (modules.has("leaves")) modules.add("leave");
  if (modules.has("leave")) modules.add("leaves");

  // Alias team <-> users <-> userManagement
  if (modules.has("team") || modules.has("users") || modules.has("userManagement")) {
    modules.add("team");
    modules.add("users");
    modules.add("userManagement");
  }

  if (configured.length > 0) return [...modules];
  if (role && (ROLE_MODULES as any)[role]) {
    return (ROLE_MODULES as any)[role];
  }
  return DEFAULT_EMPLOYEE_MODULES;
}

export function hasModuleAccess(allowedModules: unknown, module: string): boolean {
  const userMods = getUserModules(allowedModules);
  if (userMods.includes(module)) return true;

  if (module === "finance") {
    return userMods.some(m => ["finance", "invoices", "quotations", "purchaseOrders", "purchase_orders", "proposals"].includes(m));
  }
  if (["invoices", "quotations", "proposals"].includes(module)) {
    return userMods.includes(module) || userMods.includes("finance");
  }
  if (module === "purchaseOrders" || module === "purchase_orders") {
    return userMods.includes("purchaseOrders") || userMods.includes("purchase_orders") || userMods.includes("finance");
  }
  if (module === "team" || module === "users") {
    return userMods.includes("team") || userMods.includes("users");
  }
  if (module === "leaves" || module === "leave") {
    return userMods.includes("leaves") || userMods.includes("leave");
  }

  return false;
}

export function hasExplicitModuleAccess(allowedModules: unknown, module: string): boolean {
  const explicit = getExplicitUserModules(allowedModules);
  if (explicit.includes(module)) return true;
  if (module === "finance" && explicit.some(m => ["finance", "invoices", "quotations", "purchaseOrders", "purchase_orders", "proposals"].includes(m))) {
    return true;
  }
  if (["invoices", "quotations", "proposals"].includes(module) && (explicit.includes(module) || explicit.includes("finance"))) {
    return true;
  }
  if ((module === "purchaseOrders" || module === "purchase_orders") && (explicit.includes("purchaseOrders") || explicit.includes("purchase_orders") || explicit.includes("finance"))) {
    return true;
  }
  if ((module === "team" || module === "users") && (explicit.includes("team") || explicit.includes("users"))) {
    return true;
  }
  return false;
}

export function isSuperAdminRole(role?: string | null): boolean {
  return role === "SUPER_ADMIN";
}

export function isManagerOrAdminRole(user: any): boolean {
  if (!user) return false;
  if (user.isDelegatedAdmin) return true;
  const role = String(user.systemRole || user.role || "").trim().toUpperCase();
  const managerOrAdminRoles = [
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "ACCOUNT_MANAGER",
    "PROJECT_MANAGER",
    "HR",
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
  ];
  return managerOrAdminRoles.some((r) => role.includes(r));
}

export function canManageModule(user: any, module: string): boolean {
  const role = user?.systemRole ?? user?.role;
  if (isSuperAdminRole(role)) return true;
  if (isManagerOrAdminRole(user)) {
    if (["projects", "tasks", "content", "clients", "meetings", "reports", "team"].includes(module)) {
      return true;
    }
  }
  // Core personal modules: every employee can access their own tasks, attendance, leaves, and reports
  if (["tasks", "attendance", "leaves", "reports"].includes(module)) {
    return true;
  }
  return hasExplicitModuleAccess(user?.allowedModules, module);
}

export function canManageTaskWorkspaceForUser(user: any): boolean {
  if (isSuperAdminRole(user?.systemRole ?? user?.role) || isManagerOrAdminRole(user)) {
    return true;
  }
  return (
    hasExplicitModuleAccess(user?.allowedModules, "projects") &&
    hasExplicitModuleAccess(user?.allowedModules, "tasks")
  );
}

const ROLE_MODULES: Record<SystemRole, ModuleKey[]> = {
  SUPER_ADMIN: [
    "dashboard",
    "clients",
    "sales",
    "projects",
    "tasks",
    "time",
    "finance",
    "content",
    "hr",
    "team",
    "reports",
    "attendance",
    "leaves",
    "settings",
    "automation",
  ],
  MANAGER: [
    "dashboard",
    "clients",
    "projects",
    "tasks",
    "time",
    "content",
    "reports",
    "attendance",
  ],
  ACCOUNT_MANAGER: ["dashboard", "clients", "projects", "reports"],
  DESIGNER: ["dashboard", "tasks", "content", "time"],
  SALES_EXECUTIVE: ["dashboard", "sales", "clients"],
  DEVELOPER: ["dashboard", "projects", "tasks", "time"],
  FINANCE_EXECUTIVE: ["dashboard", "finance", "reports"],
  HR: ["dashboard", "hr", "attendance", "reports"],
  CUSTOM: ["dashboard"],
};

export function canAccessModule(
  role: SystemRole,
  module: ModuleKey,
  allowedModules?: unknown,
): boolean {
  return module === "dashboard" ||
    isSuperAdminRole(role) ||
    getUserModules(allowedModules).includes(module);
}

export function getAccessibleModules(role: SystemRole, allowedModules?: unknown): ModuleKey[] {
  if (isSuperAdminRole(role)) return [...ROLE_MODULES.SUPER_ADMIN];
  return [...new Set(["dashboard", ...getUserModules(allowedModules)])] as ModuleKey[];
}

export function isAdmin(role: SystemRole): boolean {
  return role === "SUPER_ADMIN";
}

export function parseCustomPermissions(
  permissions: unknown
): Record<string, ModulePermissions> {
  if (!permissions || typeof permissions !== "object") return {};
  return permissions as Record<string, ModulePermissions>;
}
