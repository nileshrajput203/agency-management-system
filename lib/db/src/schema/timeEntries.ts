import { pgTable, text, boolean, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tasksTable } from "./tasks";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const timeEntriesTable = pgTable("time_entries", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  taskId: text("task_id").references(() => tasksTable.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  userId: text("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  durationMin: integer("duration_min"),
  note: text("note"),
  isBillable: boolean("is_billable").default(true),

  // Audit fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("time_entries_user_id_idx").on(table.userId),
  index("time_entries_project_id_idx").on(table.projectId),
  index("time_entries_task_id_idx").on(table.taskId),
  index("time_entries_started_at_idx").on(table.startedAt),
]);

export const insertTimeEntrySchema = createInsertSchema(timeEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type TimeEntry = typeof timeEntriesTable.$inferSelect;
