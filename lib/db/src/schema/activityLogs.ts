import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";

export const activityLogsTable = pgTable("activity_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").references(() => clientsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("activity_logs_client_id_idx").on(table.clientId),
]);

export type ActivityLog = typeof activityLogsTable.$inferSelect;
