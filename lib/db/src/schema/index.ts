import {
  pgTable,
  text,
  boolean,
  integer,
  real,
  timestamp,
  json,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

const cuid = () => createId();

// ─── Enums ────────────────────────────────────────────────────
export const systemRoleEnum = pgEnum("system_role", [
  "SUPER_ADMIN",
  "MANAGER",
  "ACCOUNT_MANAGER",
  "DESIGNER",
  "SALES_EXECUTIVE",
  "DEVELOPER",
  "FINANCE_EXECUTIVE",
  "HR",
  "CUSTOM",
]);

export const clientCategoryEnum = pgEnum("client_category", [
  "RETAINER",
  "ONE_TIME",
  "LEAD",
  "CHURNED",
]);

export const clientHealthEnum = pgEnum("client_health", [
  "GREEN",
  "YELLOW",
  "RED",
]);

export const leadStageEnum = pgEnum("lead_stage", [
  "LEAD",
  "CONTACTED",
  "DEMO_GIVEN",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "NOT_STARTED",
  "IN_PROGRESS",
  "UNDER_REVIEW",
  "COMPLETED",
  "ON_HOLD",
  "CANCELLED",
]);

export const projectPriorityEnum = pgEnum("project_priority", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
]);

export const contentStatusEnum = pgEnum("content_status", [
  "IDEA",
  "SCRIPTING",
  "DESIGNING",
  "IN_REVIEW",
  "ADMIN_APPROVED",
  "SCHEDULED",
  "PUBLISHED",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "DRAFT",
  "SENT",
  "VIEWED",
  "PAID",
  "OVERDUE",
  "CANCELLED",
]);

export const quotationStatusEnum = pgEnum("quotation_status", [
  "DRAFT",
  "SENT",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
]);

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

export const proposalStatusEnum = pgEnum("proposal_status", [
  "DRAFT",
  "SENT",
  "APPROVED",
  "REJECTED",
]);

// ─── Users & Auth ─────────────────────────────────────────────
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(cuid),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  department: text("department"),
  avatarUrl: text("avatar_url"),
  systemRole: systemRoleEnum("system_role").notNull().default("DEVELOPER"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey().$defaultFn(cuid),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Agency Settings ──────────────────────────────────────────
export const agencySettings = pgTable("agency_settings", {
  id: text("id").primaryKey().default("default"),
  agencyName: text("agency_name").notNull().default("Blink Beyond"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  website: text("website"),
  primaryColor: text("primary_color").notNull().default("#6366f1"),
  currency: text("currency").notNull().default("INR"),
  taxLabel: text("tax_label").notNull().default("GST"),
  taxPercent: real("tax_percent").notNull().default(18),
  logoUrl: text("logo_url"),
  workDayStart: text("work_day_start").notNull().default("09:00"),
  workDayEnd: text("work_day_end").notNull().default("18:00"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Clients ──────────────────────────────────────────────────
export const clients = pgTable("clients", {
  id: text("id").primaryKey().$defaultFn(cuid),
  companyName: text("company_name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  billingAddress: text("billing_address"),
  gstin: text("gstin"),
  category: clientCategoryEnum("category").notNull().default("LEAD"),
  health: clientHealthEnum("health").notNull().default("GREEN"),
  source: text("source"),
  internalNotes: text("internal_notes"),
  website: text("website"),
  instagram: text("instagram"),
  facebook: text("facebook"),
  youtube: text("youtube"),
  linkedin: text("linkedin"),
  brandColors: text("brand_colors"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const contentContracts = pgTable("content_contracts", {
  id: text("id").primaryKey().$defaultFn(cuid),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  postsPerMonth: integer("posts_per_month").notNull().default(0),
  reelsPerMonth: integer("reels_per_month").notNull().default(0),
  storiesPerMonth: integer("stories_per_month").notNull().default(0),
  carouselsPerMonth: integer("carousels_per_month").notNull().default(0),
  captionWriting: boolean("caption_writing").notNull().default(false),
  hashtagResearch: boolean("hashtag_research").notNull().default(false),
  scheduling: boolean("scheduling").notNull().default(false),
  contractMonths: integer("contract_months").notNull().default(1),
  startDate: text("start_date").notNull(),
  monthlyRetainer: real("monthly_retainer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Leads ────────────────────────────────────────────────────
export const leads = pgTable("leads", {
  id: text("id").primaryKey().$defaultFn(cuid),
  title: text("title").notNull(),
  companyName: text("company_name"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  value: real("value"),
  stage: leadStageEnum("stage").notNull().default("LEAD"),
  probability: integer("probability"),
  notes: text("notes"),
  industry: text("industry"),
  assigneeId: text("assignee_id").references(() => users.id, {
    onDelete: "set null",
  }),
  stageChangedAt: timestamp("stage_changed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Projects ─────────────────────────────────────────────────
export const projects = pgTable("projects", {
  id: text("id").primaryKey().$defaultFn(cuid),
  name: text("name").notNull(),
  description: text("description"),
  clientId: text("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),
  type: text("type").notNull().default("GENERAL"),
  status: projectStatusEnum("status").notNull().default("NOT_STARTED"),
  priority: projectPriorityEnum("priority").notNull().default("MEDIUM"),
  progress: integer("progress").notNull().default(0),
  startDate: text("start_date"),
  endDate: text("end_date"),
  budget: real("budget"),
  managerId: text("manager_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Tasks ────────────────────────────────────────────────────
export const tasks = pgTable("tasks", {
  id: text("id").primaryKey().$defaultFn(cuid),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("TODO"),
  priority: taskPriorityEnum("priority").notNull().default("MEDIUM"),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  assigneeId: text("assignee_id").references(() => users.id, {
    onDelete: "set null",
  }),
  creatorId: text("creator_id").references(() => users.id, {
    onDelete: "set null",
  }),
  dueDate: text("due_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Content Posts ────────────────────────────────────────────
export const contentPosts = pgTable("content_posts", {
  id: text("id").primaryKey().$defaultFn(cuid),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  contentType: text("content_type").notNull(),
  caption: text("caption"),
  hashtags: text("hashtags"),
  status: contentStatusEnum("status").notNull().default("IDEA"),
  scheduledAt: text("scheduled_at"),
  publishedAt: text("published_at"),
  assigneeId: text("assignee_id").references(() => users.id, {
    onDelete: "set null",
  }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Invoices ─────────────────────────────────────────────────
export const invoices = pgTable("invoices", {
  id: text("id").primaryKey().$defaultFn(cuid),
  number: text("number").notNull().unique(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "restrict" }),
  status: invoiceStatusEnum("status").notNull().default("DRAFT"),
  lineItems: json("line_items").notNull().$type<LineItem[]>().default([]),
  subtotal: real("subtotal").notNull().default(0),
  tax: real("tax").notNull().default(0),
  discount: real("discount").notNull().default(0),
  total: real("total").notNull().default(0),
  notes: text("notes"),
  paymentInstructions: text("payment_instructions"),
  invoiceDate: text("invoice_date").notNull(),
  dueDate: text("due_date"),
  paidAt: text("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Quotations ───────────────────────────────────────────────
export const quotations = pgTable("quotations", {
  id: text("id").primaryKey().$defaultFn(cuid),
  number: text("number").notNull().unique(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "restrict" }),
  status: quotationStatusEnum("status").notNull().default("DRAFT"),
  lineItems: json("line_items").notNull().$type<LineItem[]>().default([]),
  subtotal: real("subtotal").notNull().default(0),
  tax: real("tax").notNull().default(0),
  discount: real("discount").notNull().default(0),
  total: real("total").notNull().default(0),
  notes: text("notes"),
  validUntil: text("valid_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Attendance ───────────────────────────────────────────────
export const attendance = pgTable("attendance", {
  id: text("id").primaryKey().$defaultFn(cuid),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  checkInAt: timestamp("check_in_at").notNull().defaultNow(),
  checkOutAt: timestamp("check_out_at"),
  isLate: boolean("is_late").notNull().default(false),
  overtimeMin: integer("overtime_min").notNull().default(0),
  date: text("date").notNull(),
});

// ─── Leave Requests ───────────────────────────────────────────
export const leaveRequests = pgTable("leave_requests", {
  id: text("id").primaryKey().$defaultFn(cuid),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: leaveTypeEnum("type").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  reason: text("reason"),
  status: leaveStatusEnum("status").notNull().default("PENDING"),
  reviewedBy: text("reviewed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Proposals ────────────────────────────────────────────────
export const proposals = pgTable("proposals", {
  id: text("id").primaryKey().$defaultFn(cuid),
  title: text("title").notNull(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  status: proposalStatusEnum("status").notNull().default("DRAFT"),
  content: text("content"),
  template: text("template"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Types ────────────────────────────────────────────────────
export type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent?: number;
  discount?: number;
  total?: number;
};
