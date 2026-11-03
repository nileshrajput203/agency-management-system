import { pgTable, text, boolean, timestamp, jsonb, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password_hash"),
  role: text("role").notNull().default("MANAGER"),
  systemRole: text("system_role").notNull().default("ACCOUNT_MANAGER"),
  department: text("department"),
  isActive: boolean("is_active").default(true),
  allowedModules: jsonb("allowed_modules").$type<string[]>().default([]),
  isDelegatedAdmin: boolean("is_delegated_admin").default(false),
  portalMode: text("portal_mode").default("MODE_1"),
  viewAllClients: boolean("view_all_clients").default(false),
  hourlyCostRate: real("hourly_cost_rate").default(500),
  monthlySalary: real("monthly_salary").default(0),
  bankAccountNo: text("bank_account_no"),
  bankIfsc: text("bank_ifsc"),
  panNumber: text("pan_number"),
  designation: text("designation"),
  
  // Audit fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("users_email_idx").on(table.email),
  index("users_role_idx").on(table.role),
  index("users_is_active_idx").on(table.isActive),
]);

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
