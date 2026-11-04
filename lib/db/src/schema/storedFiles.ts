import { pgTable, text, timestamp, integer, index } from "drizzle-orm/pg-core";

export const storedFilesTable = pgTable("stored_files", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  filename: text("filename").notNull().unique(),
  originalName: text("original_name"),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  data: text("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("stored_files_filename_idx").on(table.filename),
]);

export type StoredFile = typeof storedFilesTable.$inferSelect;
export type InsertStoredFile = typeof storedFilesTable.$inferInsert;
