CREATE TABLE IF NOT EXISTS "file_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"filename" text NOT NULL,
	"url" text NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp
);

CREATE TABLE IF NOT EXISTS "leave_balances" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"year" integer NOT NULL,
	"casual_total" integer DEFAULT 12,
	"casual_used" integer DEFAULT 0,
	"sick_total" integer DEFAULT 6,
	"sick_used" integer DEFAULT 0,
	"earned_total" integer DEFAULT 15,
	"earned_used" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "time_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text,
	"project_id" text,
	"user_id" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"duration_min" integer,
	"note" text,
	"is_billable" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	"deleted_at" timestamp
);

ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "onboarding_date" text;
ALTER TABLE "client_calendar_shares" ADD COLUMN IF NOT EXISTS "is_revoked" text DEFAULT 'false';

DO $$ BEGIN
  ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "file_attachments_entity_idx" ON "file_attachments" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "file_attachments_uploaded_by_idx" ON "file_attachments" ("uploaded_by");

CREATE UNIQUE INDEX IF NOT EXISTS "leave_balances_user_id_year_idx" ON "leave_balances" ("user_id", "year");
CREATE INDEX IF NOT EXISTS "leave_balances_user_id_idx" ON "leave_balances" ("user_id");

CREATE INDEX IF NOT EXISTS "time_entries_user_id_idx" ON "time_entries" ("user_id");
CREATE INDEX IF NOT EXISTS "time_entries_project_id_idx" ON "time_entries" ("project_id");
CREATE INDEX IF NOT EXISTS "time_entries_task_id_idx" ON "time_entries" ("task_id");
CREATE INDEX IF NOT EXISTS "time_entries_started_at_idx" ON "time_entries" ("started_at");

CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" ("role");
CREATE INDEX IF NOT EXISTS "users_is_active_idx" ON "users" ("is_active");

CREATE INDEX IF NOT EXISTS "clients_company_name_idx" ON "clients" ("company_name");
CREATE INDEX IF NOT EXISTS "clients_category_idx" ON "clients" ("category");

CREATE INDEX IF NOT EXISTS "leads_stage_idx" ON "leads" ("stage");
CREATE INDEX IF NOT EXISTS "leads_email_idx" ON "leads" ("email");

CREATE INDEX IF NOT EXISTS "projects_client_id_idx" ON "projects" ("client_id");
CREATE INDEX IF NOT EXISTS "projects_assigned_to_idx" ON "projects" ("assigned_to");
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects" ("status");

CREATE INDEX IF NOT EXISTS "tasks_project_id_idx" ON "tasks" ("project_id");
CREATE INDEX IF NOT EXISTS "tasks_assignee_id_idx" ON "tasks" ("assignee_id");
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks" ("status");
CREATE INDEX IF NOT EXISTS "tasks_due_date_idx" ON "tasks" ("due_date");
CREATE INDEX IF NOT EXISTS "tasks_parent_id_idx" ON "tasks" ("parent_id");

CREATE INDEX IF NOT EXISTS "content_posts_client_id_idx" ON "content_posts" ("client_id");
CREATE INDEX IF NOT EXISTS "content_posts_status_idx" ON "content_posts" ("status");
CREATE INDEX IF NOT EXISTS "content_posts_scheduled_at_idx" ON "content_posts" ("scheduled_at");

CREATE INDEX IF NOT EXISTS "invoices_client_id_idx" ON "invoices" ("client_id");
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" ("status");
CREATE INDEX IF NOT EXISTS "invoices_number_idx" ON "invoices" ("number");
CREATE INDEX IF NOT EXISTS "invoice_items_invoice_id_idx" ON "invoice_items" ("invoice_id");

CREATE INDEX IF NOT EXISTS "quotations_client_id_idx" ON "quotations" ("client_id");
CREATE INDEX IF NOT EXISTS "quotations_status_idx" ON "quotations" ("status");
CREATE INDEX IF NOT EXISTS "quotations_number_idx" ON "quotations" ("number");
CREATE INDEX IF NOT EXISTS "quotation_items_quotation_id_idx" ON "quotation_items" ("quotation_id");

CREATE INDEX IF NOT EXISTS "proposals_client_id_idx" ON "proposals" ("client_id");
CREATE INDEX IF NOT EXISTS "proposals_status_idx" ON "proposals" ("status");
CREATE INDEX IF NOT EXISTS "proposal_items_proposal_id_idx" ON "proposal_items" ("proposal_id");

CREATE INDEX IF NOT EXISTS "purchase_orders_client_id_idx" ON "purchase_orders" ("client_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_vendor_id_idx" ON "purchase_orders" ("vendor_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_status_idx" ON "purchase_orders" ("status");
CREATE INDEX IF NOT EXISTS "purchase_order_items_po_id_idx" ON "purchase_order_items" ("purchase_order_id");

CREATE INDEX IF NOT EXISTS "comments_entity_idx" ON "comments" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "comments_user_id_idx" ON "comments" ("user_id");

CREATE INDEX IF NOT EXISTS "payments_invoice_id_idx" ON "payments" ("invoice_id");

CREATE INDEX IF NOT EXISTS "leave_requests_user_id_idx" ON "leave_requests" ("user_id");
CREATE INDEX IF NOT EXISTS "leave_requests_status_idx" ON "leave_requests" ("status");

CREATE INDEX IF NOT EXISTS "activity_logs_client_id_idx" ON "activity_logs" ("client_id");

CREATE INDEX IF NOT EXISTS "lead_contacts_lead_id_idx" ON "lead_contacts" ("lead_id");

CREATE INDEX IF NOT EXISTS "employees_user_id_idx" ON "employees" ("user_id");
CREATE INDEX IF NOT EXISTS "employees_manager_id_idx" ON "employees" ("manager_id");
