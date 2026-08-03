import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const userHiddenItemsTable = pgTable("user_hidden_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  hiddenAt: timestamp("hidden_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => {
  return {
    userEntityIdx: uniqueIndex("user_hidden_items_user_entity_idx").on(table.userId, table.entityType, table.entityId),
  };
});

export type UserHiddenItem = typeof userHiddenItemsTable.$inferSelect;
export type NewUserHiddenItem = typeof userHiddenItemsTable.$inferInsert;
