import { pgTable, text, timestamp, boolean, integer, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vendorsTable = pgTable("vendors", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  gstin: text("gstin"),
  pan: text("pan"),
  category: text("category"),
  vendorType: text("vendor_type").default("VENDOR"), // VENDOR | FREELANCER | INFLUENCER
  instagramHandle: text("instagram_handle"),
  youtubeHandle: text("youtube_handle"),
  niche: text("niche"),
  followerCount: integer("follower_count").default(0),
  engagementRate: text("engagement_rate"),
  commercialRatePerReel: real("commercial_rate_per_reel").default(0),
  isActive: boolean("is_active").notNull().default(true),
  
  // Audit fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("vendors_name_idx").on(table.name),
  index("vendors_gstin_idx").on(table.gstin),
]);

export const insertVendorSchema = createInsertSchema(vendorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendorsTable.$inferSelect;
