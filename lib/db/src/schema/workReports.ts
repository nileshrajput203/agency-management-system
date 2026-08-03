import { pgTable, text, timestamp, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const workReportsTable = pgTable("work_reports", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  employeeName: text("employee_name"),
  employeeDesignation: text("employee_designation"),
  title: text("title").notNull(),
  period: text("period").notNull().default("Monthly"), // "Monthly", "Weekly", "Daily"
  startDate: text("start_date"),
  endDate: text("end_date"),
  status: text("status").notNull().default("Draft"), 
  // Statuses: "Draft", "Submitted", "Under Review", "Needs Changes", "Resubmitted", "Approved", "Archived"
  clientHandled: text("client_handled"),
  projects: jsonb("projects").default([]), 
  // array of { id, projectName, clientName, taskDescription, completionPercentage, status, hoursSpent, managerComment }
  selfAssessment: text("self_assessment"),
  summary: text("summary"),
  managerFeedback: text("manager_feedback"),
  managerCommentSections: jsonb("manager_comment_sections").default({}), 
  // e.g., { projects: "Update completion percentage.", selfAssessment: "Add details on client x." }
  currentVersion: integer("current_version").notNull().default(1),
  pdfUrl: text("pdf_url"),
  reopenRequested: boolean("reopen_requested").notNull().default(false),
  reopenReason: text("reopen_reason"),
  reopenStatus: text("reopen_status").notNull().default("None"), // "None", "Pending", "Approved", "Rejected"
  
  // Timestamps
  submittedAt: timestamp("submitted_at"),
  reviewedAt: timestamp("reviewed_at"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
}, (table) => [
  index("work_reports_user_id_idx").on(table.userId),
  index("work_reports_status_idx").on(table.status),
  index("work_reports_created_at_idx").on(table.createdAt),
]);

export const workReportVersionsTable = pgTable("work_report_versions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  reportId: text("report_id").notNull().references(() => workReportsTable.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  statusAtVersion: text("status_at_version").notNull(),
  snapshot: jsonb("snapshot").notNull(), // full report snapshot
  submittedBy: text("submitted_by").notNull(),
  submittedByName: text("submitted_by_name"),
  changeSummary: text("change_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("work_report_versions_report_id_idx").on(table.reportId),
]);

export const workReportAuditLogsTable = pgTable("work_report_audit_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  reportId: text("report_id").notNull().references(() => workReportsTable.id, { onDelete: "cascade" }),
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name"),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  fieldsChanged: jsonb("fields_changed").default([]), // Array of { field, oldValue, newValue }
  managerComments: text("manager_comments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("work_report_audit_logs_report_id_idx").on(table.reportId),
  index("work_report_audit_logs_created_at_idx").on(table.createdAt),
]);

export const workReportReopenRequestsTable = pgTable("work_report_reopen_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  reportId: text("report_id").notNull().references(() => workReportsTable.id, { onDelete: "cascade" }),
  requestedBy: text("requested_by").notNull(),
  requestedByName: text("requested_by_name"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("Pending"), // "Pending", "Approved", "Rejected"
  reviewedBy: text("reviewed_by"),
  reviewedByName: text("reviewed_by_name"),
  reviewComment: text("review_comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("work_report_reopen_requests_report_id_idx").on(table.reportId),
  index("work_report_reopen_requests_status_idx").on(table.status),
]);

export const insertWorkReportSchema = createInsertSchema(workReportsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWorkReport = z.infer<typeof insertWorkReportSchema>;
export type WorkReport = typeof workReportsTable.$inferSelect;
export type WorkReportVersion = typeof workReportVersionsTable.$inferSelect;
export type WorkReportAuditLog = typeof workReportAuditLogsTable.$inferSelect;
export type WorkReportReopenRequest = typeof workReportReopenRequestsTable.$inferSelect;
