import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const contentPostsTable = pgTable("content_posts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  platform: text("platform").default("INSTAGRAM"),
  contentType: text("content_type").default("POST"),
  status: text("status").default("IDEA"),
  caption: text("caption"),
  scheduledAt: text("scheduled_at"),
  clientId: text("client_id").references(() => clientsTable.id, { onDelete: "cascade" }),
  referenceUrl: text("reference_url"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContentPostSchema = createInsertSchema(contentPostsTable).omit({ id: true, createdAt: true });
export type InsertContentPost = z.infer<typeof insertContentPostSchema>;
export type ContentPost = typeof contentPostsTable.$inferSelect;
