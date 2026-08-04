import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import * as schema from "./schema/index.js";

// Load .env from workspace root
let currentDir = process.cwd();
while (currentDir && currentDir !== "/") {
  const envPath = path.resolve(currentDir, ".env");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
    break;
  }
  currentDir = path.dirname(currentDir);
}

const { Pool } = pg;

const rawUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!rawUrl) {
  console.error("[Database] FATAL: No DATABASE_URL or NEON_DATABASE_URL set.");
  process.exit(1);
}

// Strip channel_binding (not supported by pg < 8.9 and causes errors on some Neon plans)
// Keep sslmode=require so Neon accepts the connection
function buildConnectionString(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    return url;
  }
}

const connectionString = buildConnectionString(rawUrl);

// Expose cleaned URL so bootstrap and other modules see the same value
process.env.DATABASE_URL = connectionString;
process.env.NEON_DATABASE_URL = connectionString;

try {
  const parsed = new URL(connectionString);
  const provider = parsed.hostname.includes("neon.tech") ? "Neon PostgreSQL" : "PostgreSQL";
  console.log("===================================================");
  console.log("[Database] Provider:", provider);
  console.log("[Database] Host:", parsed.hostname);
  console.log("[Database] Database:", parsed.pathname.replace(/^\//, ""));
  console.log("===================================================");
} catch (_) {}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: parseInt(process.env.DB_POOL_MAX || "10", 10),
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  console.error("[Database] Pool background error:", err.message);
});

// PgBouncer (Neon pooler) transaction mode does not support named prepared statements.
// Strip the 'name' field from every query object before sending.
const _origQuery = pool.query.bind(pool);
(pool as any).query = function (sql: any, params?: any, cb?: any): any {
  let q = sql;
  if (q && typeof q === "object") {
    q = { ...q };
    delete q.name;
  }
  if (typeof params === "function") return _origQuery(q, params);
  if (cb !== undefined) return _origQuery(q, params, cb);
  if (params !== undefined) return _origQuery(q, params);
  return _origQuery(q);
};

const db = drizzle(pool, { schema });

export { pool, db };
export * from "./schema/index.js";
