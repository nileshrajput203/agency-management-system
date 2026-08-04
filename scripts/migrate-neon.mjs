/**
 * Direct Neon migration script.
 * Creates all tables IF NOT EXISTS and adds missing columns.
 * Safe to run multiple times — never drops data.
 */
import pg from "pg";

const { Client } = pg;

const DB_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!DB_URL) {
  console.error("Set DATABASE_URL or NEON_DATABASE_URL");
  process.exit(1);
}

function buildUrl(raw) {
  try {
    const u = new URL(raw);
    u.hostname = u.hostname.replace("-pooler", ""); // use direct connection for DDL
    u.searchParams.delete("channel_binding");
    if (!u.searchParams.get("sslmode")) u.searchParams.set("sslmode", "require");
    return u.toString();
  } catch {
    return raw;
  }
}

const client = new Client({
  connectionString: buildUrl(DB_URL),
  ssl: { rejectUnauthorized: false },
});

// All SQL statements — in dependency order
const statements = [
  // ── users ──────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "users" (
    "id"                  text PRIMARY KEY,
    "name"                text NOT NULL,
    "email"               text NOT NULL UNIQUE,
    "password_hash"       text,
    "role"                text NOT NULL DEFAULT 'MANAGER',
    "system_role"         text NOT NULL DEFAULT 'ACCOUNT_MANAGER',
    "department"          text,
    "is_active"           boolean DEFAULT true,
    "allowed_modules"     jsonb DEFAULT '[]'::jsonb,
    "is_delegated_admin"  boolean DEFAULT false,
    "portal_mode"         text DEFAULT 'MODE_1',
    "view_all_clients"    boolean DEFAULT false,
    "created_at"          timestamp DEFAULT now() NOT NULL,
    "updated_at"          timestamp DEFAULT now() NOT NULL,
    "created_by"          text,
    "updated_by"          text,
    "deleted_at"          timestamp
  )`,
  `CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email")`,
  `CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role")`,
  `CREATE INDEX IF NOT EXISTS "users_is_active_idx" ON "users"("is_active")`,

  // patch missing columns on existing users table
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_delegated_admin" boolean DEFAULT false`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "portal_mode" text DEFAULT 'MODE_1'`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "view_all_clients" boolean DEFAULT false`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "allowed_modules" jsonb DEFAULT '[]'::jsonb`,

  // ── agency_settings ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "agency_settings" (
    "id"                   text PRIMARY KEY DEFAULT 'default',
    "agency_name"          text NOT NULL DEFAULT 'Blink Beyond',
    "email"                text,
    "phone"                text,
    "address"              text,
    "website"              text,
    "primary_color"        text NOT NULL DEFAULT '#6366f1',
    "currency"             text NOT NULL DEFAULT 'INR',
    "tax_label"            text NOT NULL DEFAULT 'GST',
    "tax_percent"          real NOT NULL DEFAULT 18,
    "logo_url"             text,
    "work_day_start"       text NOT NULL DEFAULT '09:00',
    "work_day_end"         text NOT NULL DEFAULT '18:00',
    "working_days"         text NOT NULL DEFAULT '1,2,3,4,5',
    "grace_period_min"     integer NOT NULL DEFAULT 30,
    "half_day_cutoff_time" text NOT NULL DEFAULT '12:00',
    "absent_cutoff_time"   text NOT NULL DEFAULT '11:00',
    "updated_at"           timestamp DEFAULT now()
  )`,

  // ── roles / permissions / rbac ─────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "roles" (
    "id"          text PRIMARY KEY,
    "name"        text NOT NULL UNIQUE,
    "description" text,
    "created_at"  timestamp DEFAULT now() NOT NULL,
    "updated_at"  timestamp DEFAULT now() NOT NULL,
    "created_by"  text,
    "updated_by"  text,
    "deleted_at"  timestamp
  )`,
  `CREATE TABLE IF NOT EXISTS "permissions" (
    "id"          text PRIMARY KEY,
    "name"        text NOT NULL UNIQUE,
    "resource"    text NOT NULL,
    "action"      text NOT NULL,
    "description" text,
    "created_at"  timestamp DEFAULT now() NOT NULL,
    "updated_at"  timestamp DEFAULT now() NOT NULL,
    "created_by"  text,
    "updated_by"  text,
    "deleted_at"  timestamp
  )`,
  `CREATE TABLE IF NOT EXISTS "role_permissions" (
    "role_id"       text NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
    "permission_id" text NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
    "created_at"    timestamp DEFAULT now() NOT NULL,
    "created_by"    text,
    PRIMARY KEY ("role_id", "permission_id")
  )`,
  `CREATE TABLE IF NOT EXISTS "user_roles" (
    "user_id"    text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "role_id"    text NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "created_by" text,
    PRIMARY KEY ("user_id", "role_id")
  )`,

  // ── clients ────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "clients" (
    "id"                text PRIMARY KEY,
    "company_name"      text NOT NULL,
    "contact_person"    text,
    "phone"             text,
    "email"             text,
    "category"          text DEFAULT 'RETAINER',
    "health"            text DEFAULT 'GREEN',
    "notes"             text,
    "service_type"      text,
    "service_details"   text,
    "social_handles"    text,
    "website_url"       text,
    "content_frequency" text,
    "target_audience"   text,
    "platforms"         text,
    "social_goals"      text,
    "content_types"     text,
    "website_type"      text,
    "website_features"  text,
    "cms_preference"    text,
    "budget_range"      text,
    "logo_url"          text,
    "onboarding_date"   text,
    "assigned_to"       text REFERENCES "users"("id") ON DELETE SET NULL,
    "created_at"        timestamp DEFAULT now() NOT NULL,
    "updated_at"        timestamp DEFAULT now() NOT NULL,
    "created_by"        text,
    "updated_by"        text,
    "deleted_at"        timestamp
  )`,
  `CREATE INDEX IF NOT EXISTS "clients_company_name_idx" ON "clients"("company_name")`,
  `CREATE INDEX IF NOT EXISTS "clients_category_idx" ON "clients"("category")`,
  `CREATE INDEX IF NOT EXISTS "clients_assigned_to_idx" ON "clients"("assigned_to")`,

  // ── vendors ────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "vendors" (
    "id"          text PRIMARY KEY,
    "name"        text NOT NULL,
    "email"       text,
    "phone"       text,
    "address"     text,
    "gstin"       text,
    "pan"         text,
    "notes"       text,
    "created_at"  timestamp DEFAULT now() NOT NULL,
    "updated_at"  timestamp DEFAULT now() NOT NULL,
    "created_by"  text,
    "updated_by"  text,
    "deleted_at"  timestamp
  )`,

  // ── leads ──────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "leads" (
    "id"                  text PRIMARY KEY,
    "title"               text NOT NULL,
    "stage"               text NOT NULL DEFAULT 'LEAD',
    "company_name"        text,
    "contact_name"        text,
    "email"               text,
    "value"               real,
    "probability"         integer DEFAULT 0,
    "expected_close_date" timestamp,
    "source"              text,
    "description"         text,
    "notes"               text,
    "stage_changed_at"    timestamp DEFAULT now(),
    "created_at"          timestamp DEFAULT now() NOT NULL,
    "updated_at"          timestamp DEFAULT now() NOT NULL,
    "created_by"          text,
    "updated_by"          text,
    "deleted_at"          timestamp
  )`,
  `CREATE INDEX IF NOT EXISTS "leads_stage_idx" ON "leads"("stage")`,
  `CREATE INDEX IF NOT EXISTS "leads_email_idx" ON "leads"("email")`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "description" text`,
  `ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "probability" integer DEFAULT 0`,

  // ── lead_contacts ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "lead_contacts" (
    "id"         text PRIMARY KEY,
    "lead_id"    text NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
    "name"       text NOT NULL,
    "email"      text,
    "phone"      text,
    "role"       text,
    "notes"      text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "lead_contacts_lead_id_idx" ON "lead_contacts"("lead_id")`,

  // ── employees ──────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "employees" (
    "id"                text PRIMARY KEY,
    "user_id"           text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "employee_code"     text UNIQUE,
    "designation"       text,
    "joining_date"      timestamp,
    "salary"            real,
    "manager_id"        text REFERENCES "users"("id") ON DELETE SET NULL,
    "emergency_contact" text,
    "created_at"        timestamp DEFAULT now() NOT NULL,
    "updated_at"        timestamp DEFAULT now() NOT NULL,
    "created_by"        text,
    "updated_by"        text,
    "deleted_at"        timestamp
  )`,
  `CREATE INDEX IF NOT EXISTS "employees_user_id_idx" ON "employees"("user_id")`,
  `CREATE INDEX IF NOT EXISTS "employees_manager_id_idx" ON "employees"("manager_id")`,

  // ── attendance ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "attendance" (
    "id"                    text PRIMARY KEY,
    "user_id"               text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "check_in_at"           timestamp,
    "check_out_at"          timestamp,
    "break_start_at"        timestamp,
    "break_end_at"          timestamp,
    "break_duration_min"    integer NOT NULL DEFAULT 0,
    "break_status"          text NOT NULL DEFAULT 'IDLE',
    "is_late"               boolean NOT NULL DEFAULT false,
    "overtime_min"          integer NOT NULL DEFAULT 0,
    "overtime_check_in_at"  timestamp,
    "overtime_check_out_at" timestamp,
    "status"                text NOT NULL DEFAULT 'PRESENT',
    "date"                  text NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "attendance_user_id_date_idx" ON "attendance"("user_id", "date")`,

  // ── projects ───────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "projects" (
    "id"                      text PRIMARY KEY,
    "name"                    text NOT NULL,
    "status"                  text DEFAULT 'NOT_STARTED',
    "priority"                text DEFAULT 'MEDIUM',
    "client_id"               text REFERENCES "clients"("id") ON DELETE SET NULL,
    "start_date"              timestamp,
    "due_date"                timestamp,
    "description"             text,
    "started_at"              timestamp,
    "completed_at"            timestamp,
    "completion_notes"        text,
    "completion_percentage"   integer DEFAULT 0,
    "activity_timeline"       jsonb DEFAULT '[]'::jsonb,
    "assigned_to"             text REFERENCES "users"("id") ON DELETE SET NULL,
    "assignment_status"       text,
    "assignment_description"  text,
    "rejection_reason"        text,
    "assignment_action_at"    timestamp,
    "created_at"              timestamp DEFAULT now() NOT NULL,
    "updated_at"              timestamp DEFAULT now() NOT NULL,
    "created_by"              text,
    "updated_by"              text,
    "deleted_at"              timestamp
  )`,
  `CREATE INDEX IF NOT EXISTS "projects_client_id_idx" ON "projects"("client_id")`,
  `CREATE INDEX IF NOT EXISTS "projects_assigned_to_idx" ON "projects"("assigned_to")`,
  `CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects"("status")`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "started_at" timestamp`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "completed_at" timestamp`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "completion_notes" text`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "completion_percentage" integer DEFAULT 0`,
  `ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "activity_timeline" jsonb DEFAULT '[]'::jsonb`,

  // ── subprojects ────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "subprojects" (
    "id"           text PRIMARY KEY,
    "project_id"   text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    "name"         text NOT NULL,
    "status"       text DEFAULT 'NOT_STARTED',
    "priority"     text DEFAULT 'MEDIUM',
    "description"  text,
    "objective"    text,
    "requirements" text,
    "deliverables" text,
    "notes"        text,
    "start_date"   timestamp,
    "due_date"     timestamp,
    "assigned_to"  text REFERENCES "users"("id") ON DELETE SET NULL,
    "created_at"   timestamp DEFAULT now() NOT NULL,
    "updated_at"   timestamp DEFAULT now() NOT NULL,
    "created_by"   text,
    "updated_by"   text
  )`,
  `CREATE INDEX IF NOT EXISTS "subprojects_project_id_idx" ON "subprojects"("project_id")`,

  // ── project_requests ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "project_requests" (
    "id"           text PRIMARY KEY,
    "project_id"   text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    "requested_by" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "request_type" text NOT NULL,
    "title"        text,
    "description"  text NOT NULL,
    "status"       text NOT NULL DEFAULT 'PENDING',
    "admin_notes"  text,
    "resolved_by"  text REFERENCES "users"("id") ON DELETE SET NULL,
    "resolved_at"  timestamp,
    "created_at"   timestamp DEFAULT now() NOT NULL,
    "updated_at"   timestamp DEFAULT now() NOT NULL
  )`,

  // ── tasks ──────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "tasks" (
    "id"                   text PRIMARY KEY,
    "project_id"           text REFERENCES "projects"("id") ON DELETE CASCADE,
    "subproject_id"        text REFERENCES "subprojects"("id") ON DELETE SET NULL,
    "title"                text NOT NULL,
    "description"          text,
    "objective"            text,
    "requirements"         text,
    "deliverables"         text,
    "notes"                text,
    "status"               text DEFAULT 'TODO',
    "priority"             text DEFAULT 'MEDIUM',
    "assignee_id"          text REFERENCES "users"("id") ON DELETE SET NULL,
    "due_date"             timestamp,
    "start_date"           timestamp,
    "parent_id"            text REFERENCES "tasks"("id") ON DELETE CASCADE,
    "position"             integer DEFAULT 0,
    "rejection_reason"     text,
    "requested_at"         timestamp,
    "created_at"           timestamp DEFAULT now() NOT NULL,
    "updated_at"           timestamp DEFAULT now() NOT NULL,
    "created_by"           text,
    "updated_by"           text,
    "deleted_at"           timestamp
  )`,
  `CREATE INDEX IF NOT EXISTS "tasks_project_id_idx" ON "tasks"("project_id")`,
  `CREATE INDEX IF NOT EXISTS "tasks_assignee_id_idx" ON "tasks"("assignee_id")`,
  `CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks"("status")`,
  `CREATE INDEX IF NOT EXISTS "tasks_due_date_idx" ON "tasks"("due_date")`,
  `CREATE INDEX IF NOT EXISTS "tasks_parent_id_idx" ON "tasks"("parent_id")`,
  `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "start_date" timestamp`,
  `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "objective" text`,
  `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "requirements" text`,
  `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "deliverables" text`,
  `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "notes" text`,

  // ── invoices ───────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "invoices" (
    "id"                   text PRIMARY KEY,
    "number"               text,
    "client_id"            text REFERENCES "clients"("id") ON DELETE SET NULL,
    "status"               text DEFAULT 'DRAFT',
    "invoice_date"         text,
    "due_date"             text,
    "logo_url"             text,
    "business_name"        text,
    "business_phone"       text,
    "business_email"       text,
    "business_pan"         text,
    "company_gstin"        text,
    "business_address"     text,
    "business_city"        text,
    "business_postal_code" text,
    "business_state"       text,
    "client_gstin"         text,
    "client_phone"         text,
    "client_email"         text,
    "client_pan"           text,
    "billing_address"      text,
    "client_city"          text,
    "client_postal_code"   text,
    "client_state"         text,
    "shipping_address"     text,
    "currency"             text DEFAULT 'INR',
    "gst_type"             text DEFAULT 'CGST_SGST',
    "subtotal"             real DEFAULT 0,
    "tax_amount"           real DEFAULT 0,
    "discount"             real DEFAULT 0,
    "discount_type"        text DEFAULT 'FIXED',
    "total"                real DEFAULT 0,
    "notes"                text,
    "terms_and_conditions" text,
    "signature_url"        text,
    "bank_details"         json,
    "line_items"           json,
    "created_at"           timestamp DEFAULT now() NOT NULL,
    "updated_at"           timestamp DEFAULT now() NOT NULL,
    "created_by"           text,
    "updated_by"           text,
    "deleted_at"           timestamp
  )`,
  `CREATE INDEX IF NOT EXISTS "invoices_client_id_idx" ON "invoices"("client_id")`,
  `CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status")`,

  // ── payments ───────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "payments" (
    "id"             text PRIMARY KEY,
    "invoice_id"     text NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
    "amount"         real NOT NULL,
    "payment_date"   text,
    "method"         text,
    "reference"      text,
    "notes"          text,
    "created_at"     timestamp DEFAULT now() NOT NULL,
    "updated_at"     timestamp DEFAULT now() NOT NULL,
    "created_by"     text,
    "updated_by"     text,
    "deleted_at"     timestamp
  )`,
  `CREATE INDEX IF NOT EXISTS "payments_invoice_id_idx" ON "payments"("invoice_id")`,

  // ── quotations ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "quotations" (
    "id"                   text PRIMARY KEY,
    "number"               text,
    "client_id"            text REFERENCES "clients"("id") ON DELETE SET NULL,
    "status"               text DEFAULT 'DRAFT',
    "valid_until"          text,
    "quotation_date"       text,
    "logo_url"             text,
    "business_name"        text,
    "business_phone"       text,
    "business_email"       text,
    "business_pan"         text,
    "company_gstin"        text,
    "business_address"     text,
    "business_city"        text,
    "business_postal_code" text,
    "business_state"       text,
    "client_gstin"         text,
    "client_phone"         text,
    "client_email"         text,
    "client_pan"           text,
    "billing_address"      text,
    "client_city"          text,
    "client_postal_code"   text,
    "client_state"         text,
    "currency"             text DEFAULT 'INR',
    "gst_type"             text DEFAULT 'CGST_SGST',
    "subtotal"             real DEFAULT 0,
    "tax_amount"           real DEFAULT 0,
    "discount"             real DEFAULT 0,
    "discount_type"        text DEFAULT 'FIXED',
    "total"                real DEFAULT 0,
    "notes"                text,
    "terms_and_conditions" text,
    "signature_url"        text,
    "bank_details"         json,
    "line_items"           json,
    "created_at"           timestamp DEFAULT now() NOT NULL,
    "updated_at"           timestamp DEFAULT now() NOT NULL,
    "created_by"           text,
    "updated_by"           text,
    "deleted_at"           timestamp
  )`,

  // ── proposals ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "proposals" (
    "id"                   text PRIMARY KEY,
    "title"                text NOT NULL,
    "client_id"            text REFERENCES "clients"("id") ON DELETE SET NULL,
    "status"               text DEFAULT 'DRAFT',
    "proposal_date"        text,
    "valid_until"          text,
    "logo_url"             text,
    "business_name"        text,
    "business_address"     text,
    "subtotal"             real DEFAULT 0,
    "tax_amount"           real DEFAULT 0,
    "total"                real DEFAULT 0,
    "currency"             text DEFAULT 'INR',
    "notes"                text,
    "terms_and_conditions" text,
    "line_items"           json,
    "created_at"           timestamp DEFAULT now() NOT NULL,
    "updated_at"           timestamp DEFAULT now() NOT NULL,
    "created_by"           text,
    "updated_by"           text,
    "deleted_at"           timestamp
  )`,

  // ── purchase_orders ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "purchase_orders" (
    "id"                   text PRIMARY KEY,
    "number"               text,
    "client_id"            text REFERENCES "clients"("id") ON DELETE SET NULL,
    "vendor_id"            text REFERENCES "vendors"("id") ON DELETE SET NULL,
    "status"               text DEFAULT 'DRAFT',
    "po_date"              text,
    "delivery_date"        text,
    "currency"             text DEFAULT 'INR',
    "subtotal"             real DEFAULT 0,
    "tax_amount"           real DEFAULT 0,
    "total"                real DEFAULT 0,
    "notes"                text,
    "terms_and_conditions" text,
    "line_items"           json,
    "created_at"           timestamp DEFAULT now() NOT NULL,
    "updated_at"           timestamp DEFAULT now() NOT NULL,
    "created_by"           text,
    "updated_by"           text,
    "deleted_at"           timestamp
  )`,

  // ── leave_requests ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "leave_requests" (
    "id"           text PRIMARY KEY,
    "user_id"      text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "leave_type"   text NOT NULL DEFAULT 'CASUAL',
    "start_date"   text NOT NULL,
    "end_date"     text NOT NULL,
    "reason"       text,
    "status"       text NOT NULL DEFAULT 'PENDING',
    "reviewed_by"  text REFERENCES "users"("id") ON DELETE SET NULL,
    "reviewed_at"  timestamp,
    "admin_notes"  text,
    "created_at"   timestamp DEFAULT now() NOT NULL,
    "updated_at"   timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "leave_requests_user_id_idx" ON "leave_requests"("user_id")`,
  `CREATE INDEX IF NOT EXISTS "leave_requests_status_idx" ON "leave_requests"("status")`,

  // ── leave_balances ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "leave_balances" (
    "id"           text PRIMARY KEY,
    "user_id"      text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "year"         integer NOT NULL,
    "leave_type"   text NOT NULL DEFAULT 'CASUAL',
    "total"        integer NOT NULL DEFAULT 0,
    "used"         integer NOT NULL DEFAULT 0,
    "remaining"    integer NOT NULL DEFAULT 0,
    "created_at"   timestamp DEFAULT now() NOT NULL,
    "updated_at"   timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "leave_balances_user_year_type_idx" ON "leave_balances"("user_id","year","leave_type")`,

  // ── notifications ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "notifications" (
    "id"              text PRIMARY KEY,
    "user_id"         text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "sender_id"       text REFERENCES "users"("id") ON DELETE SET NULL,
    "type"            text NOT NULL DEFAULT 'SYSTEM',
    "priority"        text NOT NULL DEFAULT 'LOW',
    "title"           text NOT NULL,
    "message"         text NOT NULL,
    "action"          text,
    "action_url"      text,
    "reference_id"    text,
    "reference_type"  text,
    "metadata"        jsonb,
    "is_read"         boolean NOT NULL DEFAULT false,
    "read_at"         timestamp,
    "expires_at"      timestamp,
    "created_at"      timestamp DEFAULT now() NOT NULL,
    "updated_at"      timestamp DEFAULT now() NOT NULL,
    "created_by"      text,
    "updated_by"      text,
    "deleted_at"      timestamp
  )`,
  `CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications"("user_id")`,
  `CREATE INDEX IF NOT EXISTS "notifications_is_read_idx" ON "notifications"("is_read")`,

  // ── content_posts ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "content_posts" (
    "id"                text PRIMARY KEY,
    "platform"          text,
    "type"              text,
    "status"            text DEFAULT 'IDEA',
    "caption"           text,
    "scheduled_at"      text,
    "shoot_date"        text,
    "client_id"         text REFERENCES "clients"("id") ON DELETE CASCADE,
    "reference_url"     text,
    "assets_link"       text,
    "description"       text,
    "script"            text,
    "ideation"          text,
    "format"            text,
    "needs_revision"    text DEFAULT 'false',
    "reference_links"   json,
    "custom_properties" json,
    "comments"          json,
    "title"             text,
    "approval_status"   text DEFAULT 'PENDING',
    "approved_by"       text REFERENCES "users"("id") ON DELETE SET NULL,
    "approved_at"       timestamp,
    "rejection_note"    text,
    "media_urls"        json,
    "created_at"        timestamp DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "content_posts_client_id_idx" ON "content_posts"("client_id")`,
  `CREATE INDEX IF NOT EXISTS "content_posts_status_idx" ON "content_posts"("status")`,

  // ── client_calendar_shares ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "client_calendar_shares" (
    "id"          text PRIMARY KEY,
    "client_id"   text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
    "share_token" text NOT NULL UNIQUE,
    "label"       text,
    "created_at"  timestamp DEFAULT now() NOT NULL,
    "expires_at"  timestamp,
    "is_revoked"  text DEFAULT 'false'
  )`,

  // ── client_social_accounts ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "client_social_accounts" (
    "id"               text PRIMARY KEY,
    "client_id"        text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
    "platform"         text NOT NULL,
    "handle"           text,
    "url"              text,
    "notes"            text,
    "created_at"       timestamp DEFAULT now() NOT NULL,
    "updated_at"       timestamp DEFAULT now() NOT NULL
  )`,

  // ── meetings ───────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "meetings" (
    "id"           text PRIMARY KEY,
    "title"        text NOT NULL,
    "description"  text,
    "start_time"   timestamp NOT NULL,
    "end_time"     timestamp,
    "duration_min" integer,
    "status"       text DEFAULT 'SCHEDULED',
    "location"     text,
    "meeting_url"  text,
    "client_id"    text REFERENCES "clients"("id") ON DELETE SET NULL,
    "created_by"   text REFERENCES "users"("id") ON DELETE SET NULL,
    "created_at"   timestamp DEFAULT now() NOT NULL,
    "updated_at"   timestamp DEFAULT now() NOT NULL
  )`,

  // ── time_entries ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "time_entries" (
    "id"           text PRIMARY KEY,
    "task_id"      text REFERENCES "tasks"("id") ON DELETE CASCADE,
    "project_id"   text REFERENCES "projects"("id") ON DELETE CASCADE,
    "user_id"      text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "duration_min" integer NOT NULL DEFAULT 0,
    "description"  text,
    "is_billable"  boolean DEFAULT false,
    "logged_date"  text,
    "created_at"   timestamp DEFAULT now() NOT NULL,
    "updated_at"   timestamp DEFAULT now() NOT NULL
  )`,

  // ── file_attachments ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "file_attachments" (
    "id"             text PRIMARY KEY,
    "entity_type"    text NOT NULL,
    "entity_id"      text NOT NULL,
    "file_url"       text NOT NULL,
    "file_name"      text,
    "file_size"      integer,
    "mime_type"      text,
    "uploaded_by"    text REFERENCES "users"("id") ON DELETE SET NULL,
    "created_at"     timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "file_attachments_entity_idx" ON "file_attachments"("entity_type","entity_id")`,

  // ── comments ───────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "comments" (
    "id"          text PRIMARY KEY,
    "entity_type" text NOT NULL,
    "entity_id"   text NOT NULL,
    "user_id"     text REFERENCES "users"("id") ON DELETE SET NULL,
    "content"     text NOT NULL,
    "created_at"  timestamp DEFAULT now() NOT NULL,
    "updated_at"  timestamp DEFAULT now() NOT NULL
  )`,

  // ── activity_logs ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "activity_logs" (
    "id"          text PRIMARY KEY,
    "client_id"   text REFERENCES "clients"("id") ON DELETE CASCADE,
    "user_id"     text REFERENCES "users"("id") ON DELETE SET NULL,
    "action"      text NOT NULL,
    "entity_type" text,
    "entity_id"   text,
    "details"     jsonb,
    "created_at"  timestamp DEFAULT now() NOT NULL
  )`,

  // ── audit_logs ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id"                  text PRIMARY KEY,
    "admin_user_id"       text NOT NULL,
    "admin_user_name"     text,
    "target_user_id"      text NOT NULL,
    "target_user_name"    text,
    "action"              text NOT NULL,
    "permissions_added"   jsonb DEFAULT '[]'::jsonb,
    "permissions_removed" jsonb DEFAULT '[]'::jsonb,
    "reason"              text,
    "details"             text,
    "created_at"          timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "audit_logs_target_user_idx" ON "audit_logs"("target_user_id")`,
  `CREATE INDEX IF NOT EXISTS "audit_logs_admin_user_idx" ON "audit_logs"("admin_user_id")`,

  // ── user_hidden_items ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "user_hidden_items" (
    "id"          text PRIMARY KEY,
    "user_id"     text NOT NULL,
    "entity_type" text NOT NULL,
    "entity_id"   text NOT NULL,
    "hidden_at"   timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "user_hidden_items_user_entity_unique" UNIQUE("user_id","entity_type","entity_id")
  )`,

  // ── work_reports ───────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "work_reports" (
    "id"                        text PRIMARY KEY,
    "user_id"                   text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "employee_name"             text,
    "employee_designation"      text,
    "title"                     text NOT NULL,
    "period"                    text NOT NULL DEFAULT 'Monthly',
    "start_date"                text,
    "end_date"                  text,
    "status"                    text NOT NULL DEFAULT 'Draft',
    "client_handled"            text,
    "projects"                  jsonb DEFAULT '[]'::jsonb,
    "self_assessment"           text,
    "summary"                   text,
    "manager_feedback"          text,
    "manager_comment_sections"  jsonb DEFAULT '{}'::jsonb,
    "current_version"           integer NOT NULL DEFAULT 1,
    "pdf_url"                   text,
    "reopen_requested"          boolean NOT NULL DEFAULT false,
    "reopen_reason"             text,
    "reopen_status"             text NOT NULL DEFAULT 'None',
    "submitted_at"              timestamp,
    "reviewed_at"               timestamp,
    "approved_at"               timestamp,
    "created_at"                timestamp DEFAULT now() NOT NULL,
    "updated_at"                timestamp DEFAULT now() NOT NULL,
    "created_by"                text,
    "updated_by"                text
  )`,
  `CREATE TABLE IF NOT EXISTS "work_report_versions" (
    "id"                text PRIMARY KEY,
    "report_id"         text NOT NULL REFERENCES "work_reports"("id") ON DELETE CASCADE,
    "version_number"    integer NOT NULL,
    "status_at_version" text NOT NULL,
    "snapshot"          jsonb NOT NULL,
    "submitted_by"      text NOT NULL,
    "submitted_by_name" text,
    "change_summary"    text,
    "created_at"        timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "work_report_audit_logs" (
    "id"               text PRIMARY KEY,
    "report_id"        text NOT NULL REFERENCES "work_reports"("id") ON DELETE CASCADE,
    "actor_id"         text NOT NULL,
    "actor_name"       text,
    "actor_role"       text,
    "action"           text NOT NULL,
    "fields_changed"   jsonb DEFAULT '[]'::jsonb,
    "manager_comments" text,
    "created_at"       timestamp DEFAULT now() NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "work_report_reopen_requests" (
    "id"                  text PRIMARY KEY,
    "report_id"           text NOT NULL REFERENCES "work_reports"("id") ON DELETE CASCADE,
    "requested_by"        text NOT NULL,
    "requested_by_name"   text,
    "reason"              text NOT NULL,
    "status"              text NOT NULL DEFAULT 'Pending',
    "reviewed_by"         text,
    "reviewed_by_name"    text,
    "review_comment"      text,
    "created_at"          timestamp DEFAULT now() NOT NULL,
    "updated_at"          timestamp DEFAULT now() NOT NULL
  )`,
];

async function run() {
  console.log("[migrate] Connecting to Neon...");
  await client.connect();
  console.log("[migrate] Connected. Applying schema...\n");

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const stmt of statements) {
    const preview = stmt.trim().replace(/\s+/g, " ").slice(0, 70);
    try {
      await client.query(stmt);
      console.log(`  ✓  ${preview}`);
      ok++;
    } catch (err) {
      // "already exists" errors are expected and safe to ignore
      const msg = err.message || "";
      if (
        msg.includes("already exists") ||
        msg.includes("duplicate column") ||
        msg.includes("duplicate key")
      ) {
        console.log(`  –  ${preview}  (already exists)`);
        skip++;
      } else {
        console.error(`  ✗  ${preview}`);
        console.error(`     Error: ${msg}`);
        fail++;
      }
    }
  }

  await client.end();
  console.log(`\n[migrate] Done — ${ok} applied, ${skip} skipped, ${fail} errors`);
  if (fail > 0) process.exit(1);
}

run().catch((err) => {
  console.error("[migrate] Fatal:", err.message);
  process.exit(1);
});
