import { pgTable, text, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leaveTypeEnum = pgEnum("leave_type", [
  "CASUAL",
  "SICK",
  "EARNED",
  "UNPAID",
]);

export const leaveStatusEnum = pgEnum("leave_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const leaveRequestsTable = pgTable("leave_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  type: leaveTypeEnum("type").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  reason: text("reason"),
  status: leaveStatusEnum("status").notNull().default("PENDING"),
  reviewedBy: text("reviewed_by").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("leave_requests_user_id_idx").on(table.userId),
  index("leave_requests_status_idx").on(table.status),
]);

export const insertLeaveRequestSchema = createInsertSchema(leaveRequestsTable).omit({ id: true, createdAt: true });
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type LeaveRequest = typeof leaveRequestsTable.$inferSelect;
