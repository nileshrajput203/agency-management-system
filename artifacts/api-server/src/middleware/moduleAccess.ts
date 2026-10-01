export const DEFAULT_EMPLOYEE_MODULES = ["tasks", "attendance", "leaves", "reports"] as const;

const MODULE_PERMISSIONS: Record<string, string[]> = {
  clients: ["clients.view", "clients.create", "clients.edit", "clients.delete"],
  sales: ["sales.view", "sales.create", "sales.edit", "sales.delete"],
  projects: ["projects.view", "projects.create", "projects.edit", "projects.delete"],
  tasks: ["tasks.view", "tasks.create", "tasks.edit", "tasks.delete"],
  meetings: ["meetings.view", "meetings.create", "meetings.edit", "meetings.delete"],
  time: ["time.view", "time.log"],
  content: ["content.view", "content.create", "content.edit", "content.delete"],
  finance: [
    "invoices.view", "invoices.create", "invoices.edit", "invoices.delete",
    "quotations.view", "quotations.create", "quotations.edit", "quotations.delete",
    "proposals.view", "proposals.create", "proposals.edit", "proposals.delete",
    "purchase_orders.view", "purchase_orders.create", "purchase_orders.edit", "purchase_orders.delete",
  ],
  invoices: ["invoices.view", "invoices.create", "invoices.edit", "invoices.delete"],
  quotations: ["quotations.view", "quotations.create", "quotations.edit", "quotations.delete"],
  proposals: ["proposals.view", "proposals.create", "proposals.edit", "proposals.delete"],
  purchaseOrders: ["purchase_orders.view", "purchase_orders.create", "purchase_orders.edit", "purchase_orders.delete"],
  purchase_orders: ["purchase_orders.view", "purchase_orders.create", "purchase_orders.edit", "purchase_orders.delete"],
  attendance: ["attendance.view", "attendance.manage"],
  leaves: ["leave.view", "leave.apply", "leave.approve"],
  leave: ["leave.view", "leave.apply", "leave.approve"],
  reports: ["reports.view"],
  team: ["users.view", "users.manage"],
  users: ["users.view", "users.manage"],
  userManagement: ["users.view", "users.manage"],
  settings: ["settings.view", "settings.update"],
  attachments: ["attachments.view", "attachments.upload"],
};

const DEFAULT_EMPLOYEE_PERMISSIONS = [
  "tasks.view",
  "tasks.create",
  "tasks.edit",
  "attachments.view",
  "attachments.upload",
  "attendance.view",
  "leave.view",
  "leave.apply",
  "reports.view",
];

export function parseConfiguredModules(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((module) => module.trim()).filter(Boolean);
  }
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(String).map((module) => module.trim()).filter(Boolean);
    }
  } catch {
    // Older records may store a comma-separated module list.
  }

  return value.split(",").map((module) => module.trim()).filter(Boolean);
}

export function getEffectiveModules(value: unknown): string[] {
  const configured = parseConfiguredModules(value);
  return configured.length > 0 ? configured : [...DEFAULT_EMPLOYEE_MODULES];
}

export function getModulePermissions(value: unknown): string[] {
  const configured = parseConfiguredModules(value);
  if (configured.length === 0) return [...DEFAULT_EMPLOYEE_PERMISSIONS];

  const permissions = new Set<string>();
  for (const module of configured) {
    for (const permission of MODULE_PERMISSIONS[module] ?? []) {
      permissions.add(permission);
    }
  }
  if (configured.some((module) =>
    ["clients", "projects", "tasks", "content", "finance"].includes(module)
  )) {
    permissions.add("attachments.view");
    permissions.add("attachments.upload");
  }
  return [...permissions];
}

export function hasConfiguredModule(value: unknown, module: string): boolean {
  return parseConfiguredModules(value).includes(module);
}

export function canManageModuleSection(
  systemRole: string | null | undefined,
  module: string,
  configuredModules: unknown,
): boolean {
  return systemRole === "SUPER_ADMIN" || hasConfiguredModule(configuredModules, module);
}

export function canManageTaskWorkspace(
  systemRole: string | null | undefined,
  configuredModules: unknown,
): boolean {
  return systemRole === "SUPER_ADMIN" ||
    (hasConfiguredModule(configuredModules, "projects") &&
      hasConfiguredModule(configuredModules, "tasks"));
}