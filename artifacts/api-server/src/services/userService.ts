import { db } from "@workspace/db";
import { usersTable, employeesTable, rolesTable, userRolesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

const STANDARD_ROLES = [
  { name: "SUPER_ADMIN", description: "Full system control and administrative access" },
  { name: "ADMIN", description: "Administrative access for system management" },
  { name: "MANAGER", description: "Managerial access for teams and operations" },
  { name: "ACCOUNT_MANAGER", description: "Client relationship and project oversight" },
  { name: "CREATIVE_STRATEGIST", description: "Creative planning and campaign strategy" },
  { name: "DESIGNER", description: "Visual design and creative assets production" },
  { name: "DEVELOPER", description: "Software development and technical execution" },
  { name: "CONTENT_CREATOR", description: "Content generation and copy writing" },
  { name: "SALES_EXECUTIVE", description: "Lead generation and sales pipeline management" },
  { name: "FINANCE_EXECUTIVE", description: "Invoicing, payments, and financial tracking" },
  { name: "HR", description: "Human resources, leaves, and team management" },
  { name: "CLIENT", description: "External client portal access" },
  { name: "EMPLOYEE", description: "Standard employee team member access" },
];

/**
 * Ensures all standard system roles exist in the `roles` table.
 */
export async function ensureStandardRoles(): Promise<Map<string, string>> {
  const roleMap = new Map<string, string>();
  
  // Get all existing roles
  const existingRoles = await db.select({ id: rolesTable.id, name: rolesTable.name }).from(rolesTable);
  for (const r of existingRoles) {
    roleMap.set(r.name, r.id);
  }

  // Insert missing standard roles
  for (const roleDef of STANDARD_ROLES) {
    if (!roleMap.has(roleDef.name)) {
      const [inserted] = await db
        .insert(rolesTable)
        .values({
          name: roleDef.name,
          description: roleDef.description,
        })
        .onConflictDoNothing()
        .returning({ id: rolesTable.id, name: rolesTable.name });

      if (inserted) {
        roleMap.set(inserted.name, inserted.id);
      } else {
        // Fetch again if conflict
        const [found] = await db.select({ id: rolesTable.id, name: rolesTable.name }).from(rolesTable).where(eq(rolesTable.name, roleDef.name));
        if (found) {
          roleMap.set(found.name, found.id);
        }
      }
    }
  }

  return roleMap;
}

/**
 * Synchronizes a single user's record with `employees` and `user_roles` tables.
 */
export async function syncUserEmployeeAndRole(user: {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  systemRole?: string | null;
}): Promise<void> {
  if (!user || !user.id) return;

  const roleName = user.systemRole || user.role || "EMPLOYEE";
  const roleMap = await ensureStandardRoles();

  // 1. Ensure roleId exists for roleName
  let roleId = roleMap.get(roleName);
  if (!roleId) {
    const [newRole] = await db
      .insert(rolesTable)
      .values({ name: roleName, description: `${roleName} role` })
      .onConflictDoNothing()
      .returning({ id: rolesTable.id });

    if (newRole) {
      roleId = newRole.id;
    } else {
      const [found] = await db.select({ id: rolesTable.id }).from(rolesTable).where(eq(rolesTable.name, roleName));
      roleId = found?.id;
    }
  }

  // 2. Sync user_roles table
  if (roleId) {
    const [existingUserRole] = await db
      .select({ userId: userRolesTable.userId })
      .from(userRolesTable)
      .where(and(eq(userRolesTable.userId, user.id), eq(userRolesTable.roleId, roleId)));

    if (!existingUserRole) {
      // Remove stale user_roles if any, then insert new mapping
      await db.delete(userRolesTable).where(eq(userRolesTable.userId, user.id));
      await db.insert(userRolesTable).values({
        userId: user.id,
        roleId: roleId,
      });
    }
  }

  // 3. Sync employees table
  const [existingEmployee] = await db
    .select({ id: employeesTable.id })
    .from(employeesTable)
    .where(eq(employeesTable.userId, user.id));

  const designation = roleName.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  if (existingEmployee) {
    await db
      .update(employeesTable)
      .set({
        designation,
        updatedAt: new Date(),
      })
      .where(eq(employeesTable.id, existingEmployee.id));
  } else {
    // Generate clean employee code based on short hash / ID
    const shortCode = user.id.replace(/-/g, "").slice(0, 6).toUpperCase();
    const employeeCode = `EMP-${shortCode}`;

    await db
      .insert(employeesTable)
      .values({
        userId: user.id,
        employeeCode,
        designation,
        joiningDate: new Date(),
      });
  }
}

/**
 * Mass synchronization for all existing users in `usersTable`.
 * Runs on server bootstrap to ensure 100% data consistency.
 */
export async function syncAllUsers(): Promise<void> {
  try {
    const allUsers = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        role: usersTable.role,
        systemRole: usersTable.systemRole,
      })
      .from(usersTable);

    if (allUsers.length === 0) return;

    logger.info(`Starting synchronization for ${allUsers.length} user records with employees and user_roles...`);

    for (const u of allUsers) {
      await syncUserEmployeeAndRole(u);
    }

    logger.info(`Successfully synchronized ${allUsers.length} users with employees and user_roles tables.`);
  } catch (err: any) {
    logger.error({ err: err?.message || err }, "Failed to synchronize users with employees and user_roles tables.");
  }
}
