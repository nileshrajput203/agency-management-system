import { hash } from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger, dbLogger } from "./logger";
import { syncAllUsers } from "../services/userService";

interface AdminConfig {
  email: string;
  password: string;
  name: string;
}

/**
 * Validates and retrieves initial admin configuration from environment variables.
 */
export function getAdminConfig(): AdminConfig {
  const email = process.env.DEFAULT_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@agencyps.com";
  const password = process.env.DEFAULT_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "Admin@123";
  const name = process.env.DEFAULT_ADMIN_NAME || process.env.ADMIN_NAME || "Admin";

  return { email, password, name };
}

/**
 * Performs essential startup environment checks and logs warnings if optional variables are missing.
 */
export function verifyEnvironment(): void {
  if (!process.env.JWT_SECRET) {
    logger.warn("Bootstrap: JWT_SECRET is not set in environment variables. Falling back to default development secret.");
  }
  if (!process.env.DATABASE_URL) {
    logger.warn("Bootstrap: DATABASE_URL is not set. Database operations may fail if default connection parameters are invalid.");
  }
}

/**
 * Seeds the initial Super Admin account if no user with the specified admin email exists.
 * Does NOT overwrite or reset password if the user already exists.
 */
export async function seedDefaultAdmin(): Promise<void> {
  const { email, password, name } = getAdminConfig();
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));

  if (!existing) {
    const passwordHash = await hash(password, 12);
    await db.insert(usersTable).values({
      name,
      email,
      password: passwordHash,
      role: "SUPER_ADMIN",
      systemRole: "SUPER_ADMIN",
      isActive: true,
    });
    logger.info({ email }, "Bootstrap: initial admin user created");
  } else {
    logger.info({ email }, "Bootstrap: admin user already exists — password and profile left unchanged");
  }
}

/**
 * Ensures that the subprojects table exists in the database.
 */
export async function ensureSubprojectsTable(): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS subprojects (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'NOT_STARTED',
      priority TEXT DEFAULT 'MEDIUM',
      description TEXT,
      objective TEXT,
      requirements TEXT,
      deliverables TEXT,
      notes TEXT,
      start_date TIMESTAMP WITH TIME ZONE,
      due_date TIMESTAMP WITH TIME ZONE,
      assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      created_by TEXT,
      updated_by TEXT
    )`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_call_date TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone TEXT`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS objective TEXT`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requirements TEXT`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deliverables TEXT`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS co_assignees JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignment_note TEXT`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS manager_approved_by TEXT`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subproject_id TEXT REFERENCES subprojects(id) ON DELETE SET NULL`,
    `CREATE INDEX IF NOT EXISTS tasks_subproject_id_idx ON tasks(subproject_id)`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS co_assignees JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS completion_notes TEXT`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS completion_percentage INTEGER DEFAULT 0`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS activity_timeline JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE subprojects ADD COLUMN IF NOT EXISTS objective TEXT`,
    `ALTER TABLE subprojects ADD COLUMN IF NOT EXISTS requirements TEXT`,
    `ALTER TABLE subprojects ADD COLUMN IF NOT EXISTS deliverables TEXT`,
    `ALTER TABLE subprojects ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE subprojects ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE subprojects ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE subprojects ADD COLUMN IF NOT EXISTS assigned_to TEXT`,
    `CREATE TABLE IF NOT EXISTS user_hidden_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      hidden_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      CONSTRAINT user_hidden_items_user_entity_unique UNIQUE(user_id, entity_type, entity_id)
    )`,
    `CREATE TABLE IF NOT EXISTS work_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      employee_name TEXT,
      employee_designation TEXT,
      title TEXT NOT NULL,
      period TEXT DEFAULT 'Monthly' NOT NULL,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT 'Draft' NOT NULL,
      client_handled TEXT,
      projects JSONB DEFAULT '[]'::jsonb,
      self_assessment TEXT,
      summary TEXT,
      manager_feedback TEXT,
      manager_comment_sections JSONB DEFAULT '{}'::jsonb,
      current_version INTEGER DEFAULT 1 NOT NULL,
      pdf_url TEXT,
      reopen_requested BOOLEAN DEFAULT false NOT NULL,
      reopen_reason TEXT,
      reopen_status TEXT DEFAULT 'None' NOT NULL,
      submitted_at TIMESTAMP WITH TIME ZONE,
      reviewed_at TIMESTAMP WITH TIME ZONE,
      approved_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      created_by TEXT,
      updated_by TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS work_report_versions (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL REFERENCES work_reports(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      status_at_version TEXT NOT NULL,
      snapshot JSONB NOT NULL,
      submitted_by TEXT NOT NULL,
      submitted_by_name TEXT,
      change_summary TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS work_report_audit_logs (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL REFERENCES work_reports(id) ON DELETE CASCADE,
      actor_id TEXT NOT NULL,
      actor_name TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      fields_changed JSONB DEFAULT '[]'::jsonb,
      manager_comments TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS work_report_reopen_requests (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL REFERENCES work_reports(id) ON DELETE CASCADE,
      requested_by TEXT NOT NULL,
      requested_by_name TEXT,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'Pending' NOT NULL,
      reviewed_by TEXT,
      reviewed_by_name TEXT,
      review_comment TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS project_requests (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      request_type TEXT NOT NULL,
      title TEXT,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING' NOT NULL,
      admin_notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE'`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS close_reason TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS target_revival_date TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS revived_at TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_notes TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_behavior TEXT DEFAULT 'ON_TIME'`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS grace_period_days TEXT DEFAULT '7'`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS delay_count TEXT DEFAULT '0'`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'TAX_INVOICE'`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS original_proforma_number TEXT`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS proforma_converted_at TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PENDING'`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delayed_days REAL DEFAULT 0`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_notes TEXT`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cgst_amount REAL DEFAULT 0`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sgst_amount REAL DEFAULT 0`,
    `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS igst_amount REAL DEFAULT 0`,
    `ALTER TABLE quotations ADD COLUMN IF NOT EXISTS is_proforma TEXT DEFAULT 'false'`,
    `ALTER TABLE quotations ADD COLUMN IF NOT EXISTS proforma_number TEXT`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS receipt_number TEXT`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS receipt_url TEXT`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS receipt_date TEXT`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS itc_eligible TEXT DEFAULT 'true'`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_mode TEXT`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vendor_name_snapshot TEXT`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS cgst_amount REAL DEFAULT 0`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS sgst_amount REAL DEFAULT 0`,
    `ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS igst_amount REAL DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS finance_sequences (
      id TEXT PRIMARY KEY,
      last_value INTEGER DEFAULT 0 NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS client_lifecycle_events (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      from_status TEXT,
      to_status TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      reason TEXT,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS employee_expenses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vendor_id TEXT REFERENCES vendors(id) ON DELETE SET NULL,
      client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      spend_date TEXT NOT NULL,
      vendor_name TEXT,
      vendor_gstin TEXT,
      amount NUMERIC(14, 2) NOT NULL,
      taxable_amount NUMERIC(14, 2) DEFAULT 0 NOT NULL,
      tax_percent NUMERIC(6, 3) DEFAULT 0 NOT NULL,
      tax_amount NUMERIC(14, 2) DEFAULT 0 NOT NULL,
      gst_type TEXT DEFAULT 'CGST_SGST' NOT NULL,
      itc_eligible BOOLEAN DEFAULT false NOT NULL,
      reimbursable BOOLEAN DEFAULT true NOT NULL,
      receipt_reference TEXT,
      status TEXT DEFAULT 'SUBMITTED' NOT NULL,
      rejection_reason TEXT,
      approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      approved_at TIMESTAMP WITH TIME ZONE,
      reimbursed_at TIMESTAMP WITH TIME ZONE,
      notes TEXT,
      submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS proforma_invoices (
      id TEXT PRIMARY KEY,
      number TEXT UNIQUE NOT NULL,
      client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
      client_name TEXT,
      status TEXT DEFAULT 'DRAFT' NOT NULL,
      invoice_date TEXT NOT NULL,
      valid_until TEXT,
      currency TEXT DEFAULT 'INR' NOT NULL,
      company_gstin TEXT,
      company_state TEXT,
      client_gstin TEXT,
      client_state TEXT,
      place_of_supply_state TEXT,
      gst_type TEXT DEFAULT 'CGST_SGST' NOT NULL,
      subtotal NUMERIC(14, 2) DEFAULT 0 NOT NULL,
      discount NUMERIC(14, 2) DEFAULT 0 NOT NULL,
      tax_amount NUMERIC(14, 2) DEFAULT 0 NOT NULL,
      cgst_amount NUMERIC(14, 2) DEFAULT 0 NOT NULL,
      sgst_amount NUMERIC(14, 2) DEFAULT 0 NOT NULL,
      igst_amount NUMERIC(14, 2) DEFAULT 0 NOT NULL,
      total NUMERIC(14, 2) DEFAULT 0 NOT NULL,
      line_items JSONB DEFAULT '[]'::jsonb NOT NULL,
      notes TEXT,
      terms_and_conditions TEXT,
      bank_details JSONB,
      converted_invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
    )`,
    // Phase 2, 3, 4, 5, 6 additions
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS monthly_retainer REAL DEFAULT 0`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS deliverable_quotas JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_kit JSONB DEFAULT '{}'::jsonb`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_token TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS gstin TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS state TEXT`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS assignee_id TEXT`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS linked_task_id TEXT`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS asset_versions JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS ideation_assigned_to TEXT`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS videographer_id TEXT`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS editor_id TEXT`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS approver_id TEXT`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS current_owner_id TEXT`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS concept_hook TEXT`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS script_body TEXT`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS script_scenes JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS trending_audio_url TEXT`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS shot_list JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS shoot_location TEXT`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS shoot_time_slot TEXT`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS shoot_equipment_props JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS raw_footage_url TEXT`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS shoot_completed_at TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS videographer_notes TEXT`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS media_files JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS cover_image_url TEXT`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS qc_checklist JSONB DEFAULT '{}'::jsonb`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS internal_approval_status TEXT DEFAULT 'PENDING'`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS internal_approved_by TEXT`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS internal_approved_at TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS is_fast_track TEXT DEFAULT 'false'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_cost_rate REAL DEFAULT 500`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_salary REAL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account_no TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_ifsc TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS pan_number TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS designation TEXT`,
    `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS work_mode TEXT DEFAULT 'WFO'`,
    `ALTER TABLE attendance ADD COLUMN IF NOT EXISTS location_note TEXT`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_type TEXT DEFAULT 'VENDOR'`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS instagram_handle TEXT`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS youtube_handle TEXT`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS niche TEXT`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS follower_count INTEGER DEFAULT 0`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS engagement_rate TEXT`,
    `ALTER TABLE vendors ADD COLUMN IF NOT EXISTS commercial_rate_per_reel REAL DEFAULT 0`,
    `ALTER TABLE proposals ADD COLUMN IF NOT EXISTS share_token TEXT`,
    `ALTER TABLE proposals ADD COLUMN IF NOT EXISTS pricing_tiers JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE proposals ADD COLUMN IF NOT EXISTS optional_add_ons JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE proposals ADD COLUMN IF NOT EXISTS selected_tier_id TEXT`,
    `ALTER TABLE proposals ADD COLUMN IF NOT EXISTS selected_add_on_ids JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE proposals ADD COLUMN IF NOT EXISTS signature_name TEXT`,
    `ALTER TABLE proposals ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS tds_amount REAL DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS holidays (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      type TEXT DEFAULT 'NATIONAL' NOT NULL,
      is_paid BOOLEAN DEFAULT true NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS shoots (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      shoot_date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      location_name TEXT,
      google_maps_url TEXT,
      status TEXT DEFAULT 'PLANNED' NOT NULL,
      crew_assignees JSONB DEFAULT '[]'::jsonb,
      equipment_list JSONB DEFAULT '[]'::jsonb,
      shot_list JSONB DEFAULT '[]'::jsonb,
      call_sheet_notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS project_milestones (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      due_date TIMESTAMP WITH TIME ZONE,
      status TEXT DEFAULT 'PENDING' NOT NULL,
      completed_at TIMESTAMP WITH TIME ZONE,
      order_index INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )`
  ];

  for (const stmt of statements) {
    try {
      await db.execute(sql.raw(stmt));
    } catch (err) {
      logger.warn({ err, stmt }, "Bootstrap statement execution warning");
    }
  }
  logger.info("Bootstrap: subprojects table & task/subproject detail columns verified/created successfully.");

  try {
    const existingHolidays = await db.execute(sql.raw(`SELECT count(*) as cnt FROM holidays`));
    const count = Number((existingHolidays.rows?.[0] as any)?.cnt || 0);
    if (count === 0) {
      const defaultHolidays = [
        { name: "Republic Day", date: "2026-01-26", type: "NATIONAL" },
        { name: "Holi", date: "2026-03-04", type: "FESTIVAL" },
        { name: "Independence Day", date: "2026-08-15", type: "NATIONAL" },
        { name: "Ganesh Chaturthi", date: "2026-09-14", type: "FESTIVAL" },
        { name: "Gandhi Jayanti", date: "2026-10-02", type: "NATIONAL" },
        { name: "Dussehra", date: "2026-10-20", type: "FESTIVAL" },
        { name: "Diwali", date: "2026-11-08", type: "FESTIVAL" },
        { name: "Christmas", date: "2026-12-25", type: "FESTIVAL" },
      ];
      for (const h of defaultHolidays) {
        await db.execute(sql.raw(`
          INSERT INTO holidays (id, name, date, type, is_paid)
          VALUES ('${crypto.randomUUID()}', '${h.name}', '${h.date}', '${h.type}', true)
        `));
      }
      logger.info("Bootstrap: seeded default Indian holidays.");
    }
  } catch (err) {
    logger.warn({ err }, "Bootstrap: holiday seeding check warning");
  }
}

/**
 * Main database and service startup initialization workflow.
 * Executes environment checks, admin seeding, and user entity synchronization deterministically.
 */
export async function bootstrapDatabase(): Promise<void> {
  try {
    verifyEnvironment();
    await ensureSubprojectsTable();
    await seedDefaultAdmin();
    await syncAllUsers();
    dbLogger.info("Bootstrap: database initialization completed successfully.");
  } catch (err) {
    dbLogger.error({ err }, "Bootstrap: database initialization failed.");
    throw err;
  }
}

