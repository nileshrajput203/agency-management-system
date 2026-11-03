import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { projectsTable } from "./projects";

export interface CrewAssignee {
  userId: string;
  userName?: string;
  role: "Videographer" | "Director" | "Editor" | "Photographer" | "Assistant" | "Model / Creator";
}

export interface ShotItem {
  sceneNo: number;
  description: string;
  format?: string;
  durationSec?: number;
  isShot?: boolean;
}

export const shootsTable = pgTable("shoots", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  clientId: text("client_id").references(() => clientsTable.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  shootDate: text("shoot_date").notNull(), // YYYY-MM-DD
  startTime: text("start_time"), // e.g. "10:00"
  endTime: text("end_time"), // e.g. "18:00"
  locationName: text("location_name"),
  googleMapsUrl: text("google_maps_url"),
  status: text("status").notNull().default("PLANNED"), // PLANNED | CONFIRMED | COMPLETED | CANCELLED
  crewAssignees: jsonb("crew_assignees").$type<CrewAssignee[]>().default([]),
  equipmentList: jsonb("equipment_list").$type<string[]>().default([]),
  shotList: jsonb("shot_list").$type<ShotItem[]>().default([]),
  callSheetNotes: text("call_sheet_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by"),
}, (table) => [
  index("shoots_client_id_idx").on(table.clientId),
  index("shoots_shoot_date_idx").on(table.shootDate),
  index("shoots_status_idx").on(table.status),
]);

export const insertShootSchema = createInsertSchema(shootsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertShoot = z.infer<typeof insertShootSchema>;
export type Shoot = typeof shootsTable.$inferSelect;
