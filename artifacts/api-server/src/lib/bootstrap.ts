import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

function requireAdminConfig(): { email: string; password: string; name: string } {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin";

  if (process.env.NODE_ENV === "production" && (!email || !password)) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required in production."
    );
  }

  const resolvedEmail = email ?? "admin@agencyos.com";
  const resolvedPassword = password ?? randomBytes(16).toString("hex");

  if (!password && process.env.NODE_ENV !== "production") {
    logger.warn(
      { email: resolvedEmail },
      `Bootstrap: ADMIN_PASSWORD not set — generated a one-time password. Set ADMIN_PASSWORD env var to use a fixed password.`
    );
  }

  return { email: resolvedEmail, password: resolvedPassword, name };
}

export async function bootstrapDatabase(): Promise<void> {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT,
        role TEXT NOT NULL DEFAULT 'MANAGER',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        company_name TEXT NOT NULL,
        contact_person TEXT,
        email TEXT,
        phone TEXT,
        website TEXT,
        category TEXT DEFAULT 'RETAINER',
        health TEXT DEFAULT 'GREEN',
        notes TEXT,
        service_type TEXT,
        service_details TEXT,
        social_handles TEXT,
        website_url TEXT,
        content_frequency TEXT,
        target_audience TEXT,
        platforms TEXT,
        social_goals TEXT,
        content_types TEXT,
        website_type TEXT,
        website_features TEXT,
        cms_preference TEXT,
        budget_range TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    for (const col of [
      "service_type TEXT", "service_details TEXT", "social_handles TEXT",
      "website_url TEXT", "content_frequency TEXT", "target_audience TEXT",
      "platforms TEXT", "social_goals TEXT", "content_types TEXT",
      "website_type TEXT", "website_features TEXT", "cms_preference TEXT", "budget_range TEXT",
    ]) {
      const [colName] = col.split(" ");
      await db.execute(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS ${col}`).catch(() => {});
    }

    await db.execute(`
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        company_name TEXT NOT NULL,
        contact_person TEXT,
        email TEXT,
        phone TEXT,
        stage TEXT DEFAULT 'NEW',
        deal_value NUMERIC,
        source TEXT,
        notes TEXT,
        owner_id TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'PLANNING',
        start_date TEXT,
        end_date TEXT,
        budget NUMERIC,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        assignee_id TEXT,
        status TEXT DEFAULT 'TODO',
        priority TEXT DEFAULT 'MEDIUM',
        due_date TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS content_posts (
        id TEXT PRIMARY KEY,
        platform TEXT DEFAULT 'INSTAGRAM',
        content_type TEXT DEFAULT 'POST',
        status TEXT DEFAULT 'IDEA',
        caption TEXT,
        description TEXT,
        reference_url TEXT,
        scheduled_at TEXT,
        client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT,
        client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
        client_name TEXT,
        status TEXT DEFAULT 'DRAFT',
        invoice_date TEXT,
        due_date TEXT,
        subtotal NUMERIC DEFAULT 0,
        tax NUMERIC DEFAULT 0,
        total NUMERIC DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS quotations (
        id TEXT PRIMARY KEY,
        quotation_number TEXT,
        client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
        client_name TEXT,
        status TEXT DEFAULT 'DRAFT',
        valid_until TEXT,
        subtotal NUMERIC DEFAULT 0,
        tax NUMERIC DEFAULT 0,
        total NUMERIC DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
        client_name TEXT,
        status TEXT DEFAULT 'DRAFT',
        valid_until TEXT,
        total NUMERIC DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const { email, password, name } = requireAdminConfig();
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
    if (!existing) {
      const passwordHash = await hash(password, 12);
      await db.insert(usersTable).values({
        name,
        email,
        password: passwordHash,
        role: "SUPER_ADMIN",
        isActive: true,
      });
      logger.info({ email }, "Bootstrap: admin user created");
      if (!process.env.ADMIN_PASSWORD) {
        logger.info({ email, generatedPassword: password }, "Bootstrap: one-time generated password — save this now");
      }
    } else {
      logger.info({ email }, "Bootstrap: admin user already exists");
    }
  } catch (err) {
    logger.error({ err }, "Bootstrap failed");
    throw err;
  }
}
