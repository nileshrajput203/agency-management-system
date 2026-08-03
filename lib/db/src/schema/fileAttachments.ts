import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const fileAttachmentsTable = pgTable("file_attachments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  filename: text("filename").notNull(),
  url: text("url").notNull(),
  uploadedBy: text("uploaded_by").references(() => usersTable.id, { onDelete: "set null" }),

  // Audit fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("file_attachments_entity_idx").on(table.entityType, table.entityId),
  index("file_attachments_uploaded_by_idx").on(table.uploadedBy),
]);

export const insertFileAttachmentSchema = createInsertSchema(fileAttachmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFileAttachment = z.infer<typeof insertFileAttachmentSchema>;
export type FileAttachment = typeof fileAttachmentsTable.$inferSelect;
