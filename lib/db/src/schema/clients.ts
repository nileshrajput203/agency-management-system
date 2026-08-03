import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const clientsTable = pgTable("clients", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyName: text("company_name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  category: text("category").default("RETAINER"),
  health: text("health").default("GREEN"),
  notes: text("notes"),
  serviceType: text("service_type"),
  serviceDetails: text("service_details"),
  socialHandles: text("social_handles"),
  websiteUrl: text("website_url"),
  contentFrequency: text("content_frequency"),
  targetAudience: text("target_audience"),
  platforms: text("platforms"),
  socialGoals: text("social_goals"),
  contentTypes: text("content_types"),
  websiteType: text("website_type"),
  websiteFeatures: text("website_features"),
  cmsPreference: text("cms_preference"),
  budgetRange: text("budget_range"),
  logoUrl: text("logo_url"),
  onboardingDate: text("onboarding_date"),
  assignedTo: text("assigned_to").references(() => usersTable.id, { onDelete: "set null" }),
  
  // Audit fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("clients_company_name_idx").on(table.companyName),
  index("clients_category_idx").on(table.category),
  index("clients_assigned_to_idx").on(table.assignedTo),
]);

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
