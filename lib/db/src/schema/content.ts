import { pgTable, text, timestamp, json, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { usersTable } from "./users";

export interface ScriptScene {
  id: string;
  sceneNo: number;
  timecode: string;
  visualDirection: string;
  spokenAudio: string;
  onScreenText: string;
}

export interface ReferenceLink {
  id: string;
  title: string;
  url: string;
  platform: "INSTAGRAM" | "YOUTUBE" | "DRIVE" | "PINTEREST" | "OTHER" | string;
  timestampNote: string;
  whatToCopy: "HOOK" | "TRANSITION" | "LIGHTING" | "EDITING_PACE" | "FULL_STYLE" | string;
}

export interface ShotListItem {
  id: string;
  shotNumber: number;
  framing: "WIDE" | "MEDIUM" | "CLOSE_UP" | "B_ROLL" | "TRANSITION" | "POV" | "DRONE" | string;
  cameraMovement: "STATIC" | "GIMBAL" | "HANDHELD" | "PAN" | string;
  description: string;
  lightingAudioNote: string;
  isCaptured: boolean;
  bestTakeNote: string;
}

export interface EquipmentPropItem {
  item: string;
  isPacked: boolean;
}

export interface AssetVersionItem {
  version: number;
  url: string;
  mediaFiles?: string[];
  uploadedBy?: string;
  uploadedByName?: string;
  note?: string;
  createdAt?: string;
  uploadedAt?: string;
}

export interface QCChecklist {
  hookChecked?: boolean;
  brandGuidelinesMatched?: boolean;
  subtitlesVerified?: boolean;
  safeZoneChecked?: boolean;
  audioBalanced?: boolean;
  ctaIncluded?: boolean;
  [key: string]: boolean | undefined;
}

export const contentPostsTable = pgTable("content_posts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  platform: text("platform").default("INSTAGRAM"),
  contentType: text("content_type").default("POST"),
  status: text("status").default("IDEA"),
  caption: text("caption"),
  scheduledAt: text("scheduled_at"),
  shootDate: text("shoot_date"),
  clientId: text("client_id").references(() => clientsTable.id, { onDelete: "cascade" }),
  referenceUrl: text("reference_url"),
  assetsLink: text("assets_link"),
  description: text("description"),
  script: text("script"),
  ideation: text("ideation"),
  format: text("format"),
  needsRevision: text("needs_revision").default("false"),
  referenceLinks: json("reference_links").$type<ReferenceLink[]>().default([]),
  customProperties: json("custom_properties").$type<{ key: string; value: string }[]>(),
  comments: json("comments").$type<{ id: string; userId: string | null; comment: string; timestampSec?: number | null; frameCoordX?: number | null; frameCoordY?: number | null; version?: number | null; createdAt: string }[]>(),
  title: text("title"),
  approvalStatus: text("approval_status").default("PENDING"),
  approvedBy: text("approved_by").references(() => usersTable.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  rejectionNote: text("rejection_note"),
  mediaUrls: json("media_urls").$type<string[]>(),
  assigneeId: text("assignee_id").references(() => usersTable.id, { onDelete: "set null" }),
  linkedTaskId: text("linked_task_id"),
  assetVersions: json("asset_versions").$type<AssetVersionItem[]>().default([]),

  // Multi-Role Handoff & Coordination
  ideationAssignedTo: text("ideation_assigned_to"),
  videographerId: text("videographer_id"),
  editorId: text("editor_id"),
  approverId: text("approver_id"),
  currentOwnerId: text("current_owner_id"),

  // Ideation, Script & On-Set Reference Pack
  conceptHook: text("concept_hook"),
  scriptBody: text("script_body"),
  scriptScenes: json("script_scenes").$type<ScriptScene[]>().default([]),
  trendingAudioUrl: text("trending_audio_url"),
  shotList: json("shot_list").$type<ShotListItem[]>().default([]) ,
  shootLocation: text("shoot_location"),
  shootTimeSlot: text("shoot_time_slot"),
  shootEquipmentProps: json("shoot_equipment_props").$type<EquipmentPropItem[]>().default([]),

  // Production Handoff & Versioning
  rawFootageUrl: text("raw_footage_url"),
  shootCompletedAt: timestamp("shoot_completed_at"),
  videographerNotes: text("videographer_notes"),
  mediaFiles: json("media_files").$type<string[]>().default([]),
  coverImageUrl: text("cover_image_url"),
  qcChecklist: json("qc_checklist").$type<QCChecklist>().default({}),
  internalApprovalStatus: text("internal_approval_status").default("PENDING"),
  internalApprovedBy: text("internal_approved_by"),
  internalApprovedAt: timestamp("internal_approved_at"),
  isFastTrack: text("is_fast_track").default("false"),

  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("content_posts_client_id_idx").on(table.clientId),
  index("content_posts_status_idx").on(table.status),
  index("content_posts_scheduled_at_idx").on(table.scheduledAt),
  index("content_posts_current_owner_idx").on(table.currentOwnerId),
  index("content_posts_internal_approval_idx").on(table.internalApprovalStatus),
]);

export const insertContentPostSchema = createInsertSchema(contentPostsTable).omit({ id: true, createdAt: true });
export type InsertContentPost = z.infer<typeof insertContentPostSchema>;
export type ContentPost = typeof contentPostsTable.$inferSelect;

export const clientCalendarSharesTable = pgTable("client_calendar_shares", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }),
  shareToken: text("share_token").notNull().unique(),
  label: text("label"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  isRevoked: text("is_revoked").default("false"),
});

export const insertClientCalendarShareSchema = createInsertSchema(clientCalendarSharesTable).omit({ id: true, createdAt: true });
export type InsertClientCalendarShare = z.infer<typeof insertClientCalendarShareSchema>;
export type ClientCalendarShare = typeof clientCalendarSharesTable.$inferSelect;

export const clientSocialAccountsTable = pgTable("client_social_accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  handle: text("handle"),
  pageId: text("page_id"),
  profileUrl: text("profile_url"),
  accessToken: text("access_token"),
  isActive: text("is_active").default("true"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClientSocialAccountSchema = createInsertSchema(clientSocialAccountsTable).omit({ id: true, createdAt: true });
export type InsertClientSocialAccount = z.infer<typeof insertClientSocialAccountSchema>;
export type ClientSocialAccount = typeof clientSocialAccountsTable.$inferSelect;
