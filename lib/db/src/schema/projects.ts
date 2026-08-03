import { pgTable, text, timestamp, index, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { usersTable } from "./users";

export const projectsTable = pgTable("projects", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  status: text("status").default("NOT_STARTED"),
  priority: text("priority").default("MEDIUM"),
  clientId: text("client_id").references(() => clientsTable.id, { onDelete: "set null" }),
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  description: text("description"),

  // Progress & Completion fields
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  completionNotes: text("completion_notes"),
  completionPercentage: integer("completion_percentage").default(0),
  activityTimeline: jsonb("activity_timeline").$type<any[]>().default([]),

  // Assignment fields
  assignedTo: text("assigned_to").references(() => usersTable.id, { onDelete: "set null" }),
  assignmentStatus: text("assignment_status"),
  assignmentDescription: text("assignment_description"),
  rejectionReason: text("rejection_reason"),
  assignmentActionAt: timestamp("assignment_action_at"),
  
  // Audit fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("projects_client_id_idx").on(table.clientId),
  index("projects_assigned_to_idx").on(table.assignedTo),
  index("projects_status_idx").on(table.status),
]);

export const subprojectsTable = pgTable("subprojects", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").default("NOT_STARTED"),
  priority: text("priority").default("MEDIUM"),
  description: text("description"),
  objective: text("objective"),
  requirements: text("requirements"),
  deliverables: text("deliverables"),
  notes: text("notes"),
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  assignedTo: text("assigned_to").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
}, (table) => [
  index("subprojects_project_id_idx").on(table.projectId),
]);

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;

export const insertSubprojectSchema = createInsertSchema(subprojectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubproject = z.infer<typeof insertSubprojectSchema>;
export type Subproject = typeof subprojectsTable.$inferSelect;

export const projectRequestsTable = pgTable("project_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  requestedBy: text("requested_by").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  requestType: text("request_type").notNull(), // e.g. "RESOURCE_NEEDED", "EXTENSION_NEEDED", "CLARIFICATION_NEEDED", "MODIFICATION_REQUESTED"
  title: text("title"),
  description: text("description").notNull(),
  status: text("status").default("PENDING").notNull(), // "PENDING", "APPROVED", "REJECTED"
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("project_requests_project_id_idx").on(table.projectId),
  index("project_requests_requested_by_idx").on(table.requestedBy),
  index("project_requests_status_idx").on(table.status),
]);

export const insertProjectRequestSchema = createInsertSchema(projectRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProjectRequest = z.infer<typeof insertProjectRequestSchema>;
export type ProjectRequest = typeof projectRequestsTable.$inferSelect;

