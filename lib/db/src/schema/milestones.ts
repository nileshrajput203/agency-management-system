import { pgTable, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const projectMilestonesTable = pgTable("project_milestones", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  status: text("status").notNull().default("PENDING"), // PENDING | IN_PROGRESS | COMPLETED
  completedAt: timestamp("completed_at"),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("project_milestones_project_id_idx").on(table.projectId),
  index("project_milestones_status_idx").on(table.status),
]);

export type ProjectMilestone = typeof projectMilestonesTable.$inferSelect;

