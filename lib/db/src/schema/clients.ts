import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({ id: true, createdAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
