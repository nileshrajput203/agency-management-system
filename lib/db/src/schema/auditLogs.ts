import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable("audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  adminUserId: text("admin_user_id").notNull(),
  adminUserName: text("admin_user_name"),
  targetUserId: text("target_user_id").notNull(),
  targetUserName: text("target_user_name"),
  action: text("action").notNull(), // e.g. "DELEGATED_ACCESS_UPDATED", "DELEGATED_ACCESS_REVOKED"
  permissionsAdded: jsonb("permissions_added").$type<string[]>().default([]),
  permissionsRemoved: jsonb("permissions_removed").$type<string[]>().default([]),
  reason: text("reason"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("audit_logs_target_user_idx").on(table.targetUserId),
  index("audit_logs_admin_user_idx").on(table.adminUserId),
]);

export type AuditLog = typeof auditLogsTable.$inferSelect;
