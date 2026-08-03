import { db } from "@workspace/db";
import { userHiddenItemsTable } from "@workspace/db/schema";
import { eq, and, sql, AnyColumn } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function hideItemForUser(userId: string, entityType: string, entityId: string): Promise<void> {
  const existing = await db
    .select({ id: userHiddenItemsTable.id })
    .from(userHiddenItemsTable)
    .where(
      and(
        eq(userHiddenItemsTable.userId, userId),
        eq(userHiddenItemsTable.entityType, entityType),
        eq(userHiddenItemsTable.entityId, entityId)
      )
    );

  if (existing.length === 0) {
    await db.insert(userHiddenItemsTable).values({
      id: randomUUID(),
      userId,
      entityType,
      entityId,
      hiddenAt: new Date(),
    });
  }
}

export async function deleteHiddenItemsForEntity(entityType: string, entityId: string): Promise<void> {
  await db
    .delete(userHiddenItemsTable)
    .where(
      and(
        eq(userHiddenItemsTable.entityType, entityType),
        eq(userHiddenItemsTable.entityId, entityId)
      )
    );
}

export async function getHiddenEntityIds(userId: string, entityType: string): Promise<string[]> {
  const rows = await db
    .select({ entityId: userHiddenItemsTable.entityId })
    .from(userHiddenItemsTable)
    .where(
      and(
        eq(userHiddenItemsTable.userId, userId),
        eq(userHiddenItemsTable.entityType, entityType)
      )
    );
  return rows.map((r) => r.entityId);
}

export function excludeHiddenSql(idColumn: AnyColumn, userId: string, entityType: string) {
  return sql`${idColumn} NOT IN (SELECT entity_id FROM user_hidden_items WHERE user_id = ${userId} AND entity_type = ${entityType})`;
}
