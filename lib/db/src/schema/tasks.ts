import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const tasksTable = pgTable("tasks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  status: text("status").default("TODO"),
  priority: text("priority").default("MEDIUM"),
  projectId: text("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  assigneeId: text("assignee_id").references(() => usersTable.id, { onDelete: "set null" }),
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  description: text("description"),
  objective: text("objective"),
  requirements: text("requirements"),
  deliverables: text("deliverables"),
  notes: text("notes"),
  parentId: text("parent_id").references((): any => tasksTable.id, { onDelete: "cascade" }),
  
  // Approval workflow fields
  approvalStatus: text("approval_status"),
  requestedBy: text("requested_by").references(() => usersTable.id, { onDelete: "set null" }),
  approvedBy: text("approved_by").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  requestedAt: timestamp("requested_at"),
  
  // Audit fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("tasks_project_id_idx").on(table.projectId),
  index("tasks_assignee_id_idx").on(table.assigneeId),
  index("tasks_status_idx").on(table.status),
  index("tasks_due_date_idx").on(table.dueDate),
  index("tasks_parent_id_idx").on(table.parentId),
]);

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
