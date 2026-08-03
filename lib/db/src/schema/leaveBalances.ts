import { pgTable, text, integer, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const leaveBalancesTable = pgTable("leave_balances", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  casualTotal: integer("casual_total").default(12),
  casualUsed: integer("casual_used").default(0),
  sickTotal: integer("sick_total").default(6),
  sickUsed: integer("sick_used").default(0),
  earnedTotal: integer("earned_total").default(15),
  earnedUsed: integer("earned_used").default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("leave_balances_user_id_year_idx").on(table.userId, table.year),
  index("leave_balances_user_id_idx").on(table.userId),
]);

export const insertLeaveBalanceSchema = createInsertSchema(leaveBalancesTable).omit({ id: true });
export type InsertLeaveBalance = z.infer<typeof insertLeaveBalanceSchema>;
export type LeaveBalance = typeof leaveBalancesTable.$inferSelect;
