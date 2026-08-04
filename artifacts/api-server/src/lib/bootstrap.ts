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
  const email = process.env.DEFAULT_ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@agencyos.com";
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
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS objective TEXT`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requirements TEXT`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deliverables TEXT`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS co_assignees JSONB DEFAULT '[]'::jsonb`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignment_note TEXT`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS manager_approved_by TEXT`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMP WITH TIME ZONE`,
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

