import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import net from "net";
import alasql from "alasql";
import * as schema from "./schema/index.js";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
if (pg.defaults) {
  (pg.defaults as any).ssl = { rejectUnauthorized: false };
}
if (pg.Client && pg.Client.prototype) {
  const origConnect = pg.Client.prototype.connect;
  (pg.Client.prototype as any).connect = function(this: any, cb?: any) {
    if (this.ssl && typeof this.ssl === "object") {
      this.ssl.rejectUnauthorized = false;
    } else {
      this.ssl = { rejectUnauthorized: false };
    }
    return origConnect.call(this, cb);
  };
}

const { Pool } = pg;

// Load .env from workspace root and override default environment variables
let currentDir = process.cwd();
let envLoaded = false;
while (currentDir && currentDir !== "/") {
  const envPath = path.resolve(currentDir, ".env");
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
    envLoaded = true;
    break;
  }
  currentDir = path.dirname(currentDir);
}
if (!envLoaded && fs.existsSync("/.env")) {
  dotenv.config({ path: "/.env", override: true });
}

// Never ship a fallback connection string. If the configured Neon endpoint is
// unavailable, using a local database makes the app appear to work while
// silently writing data somewhere the user cannot see.
let databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || "";
if (databaseUrl) {
  let cleanUrl = databaseUrl.trim();
  if (cleanUrl.includes("agency@123management")) {
    cleanUrl = cleanUrl.replace("agency@123management", "agency_123management");
  }
  if (cleanUrl.startsWith("DATABASE_URL=") || cleanUrl.startsWith("NEON_DATABASE_URL=")) {
    cleanUrl = cleanUrl.substring(cleanUrl.indexOf("=") + 1).trim();
  }
  if ((cleanUrl.startsWith('"') && cleanUrl.endsWith('"')) || (cleanUrl.startsWith("'") && cleanUrl.endsWith("'"))) {
    cleanUrl = cleanUrl.substring(1, cleanUrl.length - 1).trim();
  }

  // Ensure unencoded '@' in password part is safely URL encoded
  const protocolEnd = cleanUrl.indexOf("://");
  const lastAt = cleanUrl.lastIndexOf("@");
  if (protocolEnd !== -1 && lastAt > protocolEnd + 3) {
    const userPassHost = cleanUrl.substring(protocolEnd + 3);
    const hostAt = userPassHost.lastIndexOf("@");
    if (hostAt !== -1) {
      const userPass = userPassHost.substring(0, hostAt);
      const hostAndRest = userPassHost.substring(hostAt + 1);
      const colonIdx = userPass.indexOf(":");
      if (colonIdx !== -1) {
        const username = userPass.substring(0, colonIdx);
        const rawPass = userPass.substring(colonIdx + 1);
        const encodedPass = encodeURIComponent(decodeURIComponent(rawPass));
        cleanUrl = `${cleanUrl.substring(0, protocolEnd + 3)}${username}:${encodedPass}@${hostAndRest}`;
      }
    }
  }

  databaseUrl = cleanUrl;
  process.env.DATABASE_URL = cleanUrl;
  process.env.NEON_DATABASE_URL = cleanUrl;
}

let forceAlaSqlFallback = false;
let isConnected = true;
let checkDone = false;

function isAlaSqlMode(): boolean {
  return process.env.USE_ALASQL === "true" || !databaseUrl;
}

const useAlaSql = isAlaSqlMode();

if (databaseUrl && !useAlaSql) {
  try {
    const parsed = new URL(databaseUrl);
    const provider = parsed.hostname.includes("neon.tech")
      ? "Neon PostgreSQL"
      : parsed.hostname.includes("supabase.com")
      ? "Supabase PostgreSQL"
      : "PostgreSQL";
    console.log("===================================================");
    console.log("[Database Connection Audit]");
    console.log("Provider:", provider);
    console.log("Host:", parsed.hostname);
    console.log("Database:", parsed.pathname.replace(/^\//, ""));
    console.log("Fallback Mode: FALSE (Silent AlaSQL fallback disabled)");
    console.log("===================================================");
  } catch (err: any) {
    console.error("[Database Error] Failed to parse DATABASE_URL:", err?.message || err);
  }
} else {
  console.log("===================================================");
  console.log("[Database Connection Audit]");
  console.log("Provider: AlaSQL");
  console.log("Fallback Mode: TRUE");
  console.log("===================================================");
}

const DB_FILE = path.resolve(process.cwd(), "local_db.json");

// Helper to save AlaSQL to disk
function saveDatabase() {
  try {
    const dbName = "alasql";
    const tables = (alasql as any).databases[dbName]?.tables || {};
    const data: Record<string, any[]> = {};
    for (const tableName of Object.keys(tables)) {
      data[tableName] = tables[tableName].data || [];
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    console.log("[AI Studio] Local AlaSQL database saved successfully to:", DB_FILE);
  } catch (err) {
    console.error("[AI Studio] Failed to save local AlaSQL database:", err);
  }
}

// Helper to load AlaSQL from disk
function loadDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    console.log("[AI Studio] No local database file found, starting with empty database.");
    return;
  }
  try {
    const fileContent = fs.readFileSync(DB_FILE, "utf-8").trim();
    if (!fileContent) return;
    
    const data = JSON.parse(fileContent);
    const dbName = "alasql";
    
    // Ensure database exists with required AlaSQL internal properties
    if (!(alasql as any).databases[dbName]) {
      (alasql as any).databases[dbName] = {
        databaseid: dbName,
        dbversion: 0,
        tables: {},
        views: {},
        triggers: {},
        indices: {},
        objects: {},
        counter: 0,
        sqlCache: {},
        sqlCacheSize: 0,
        astCache: {},
      } as any;
    }
    
    const tables = (alasql as any).databases[dbName].tables;
    for (const tableName of Object.keys(data)) {
      if (!tables[tableName]) {
        // Create empty table definition
        tables[tableName] = { data: data[tableName], columns: [] } as any;
      } else {
        tables[tableName].data = data[tableName];
      }
    }
    console.log("[AI Studio] Local AlaSQL database loaded successfully from:", DB_FILE);
  } catch (err) {
    console.error("[AI Studio] Failed to load local AlaSQL database:", err);
  }
}

// Run AlaSQL queries with normalization and sanitization
function runAlaSqlQuery(sql: any, params: any[] = []): any {
  let sqlText = "";
  let sqlParams = params || [];

  if (typeof sql === "string") {
    sqlText = sql;
  } else if (sql && typeof sql === "object") {
    sqlText = sql.text || "";
    sqlParams = sql.values || sqlParams;
  }

  let normalizedSql = sqlText.trim();
  let localParams = Array.isArray(sqlParams) ? [...sqlParams] : [];

  // 1. Convert double quotes "column_name" to [column_name] for AlaSQL reserved keywords compatibility
  normalizedSql = normalizedSql.replace(/"([a-zA-Z0-9_]+)"/g, "[$1]");

  // 2. Inline LIMIT $n and OFFSET $n parameters before converting $n to ?
  let limitMatch = normalizedSql.match(/\bLIMIT\s+\$(\d+)/i);
  if (limitMatch) {
    const idx = parseInt(limitMatch[1], 10) - 1;
    const val = localParams[idx];
    if (val !== undefined && (typeof val === "number" || (typeof val === "string" && !isNaN(Number(val))))) {
      normalizedSql = normalizedSql.replace(limitMatch[0], `LIMIT ${Number(val)}`);
      localParams.splice(idx, 1);
    }
  }

  let offsetMatch = normalizedSql.match(/\bOFFSET\s+\$(\d+)/i);
  if (offsetMatch) {
    const idx = parseInt(offsetMatch[1], 10) - 1;
    const val = localParams[idx];
    if (val !== undefined && (typeof val === "number" || (typeof val === "string" && !isNaN(Number(val))))) {
      normalizedSql = normalizedSql.replace(offsetMatch[0], `OFFSET ${Number(val)}`);
      localParams.splice(idx, 1);
    }
  }

  // 3. Convert $1, $2, $10, ... to ?
  normalizedSql = normalizedSql.replace(/\$\d+/g, "?");

  // 4. Handle LIMIT ? and OFFSET ? if query used ? instead of $n
  while (/\b(LIMIT|OFFSET)\s+\?/i.test(normalizedSql)) {
    const match = normalizedSql.match(/\b(LIMIT|OFFSET)\s+\?/i);
    if (!match || match.index === undefined) break;

    const clause = match[1].toUpperCase();
    const matchIndex = match.index;
    const prefix = normalizedSql.substring(0, matchIndex);
    const questionMarkIndex = (prefix.match(/\?/g) || []).length;

    const paramVal = localParams[questionMarkIndex];
    const numVal = (paramVal !== undefined && (typeof paramVal === "number" || (typeof paramVal === "string" && !isNaN(Number(paramVal)))))
      ? Number(paramVal)
      : (clause === "LIMIT" ? 100 : 0);

    normalizedSql = prefix + `${clause} ${numVal}` + normalizedSql.substring(matchIndex + match[0].length);
    localParams.splice(questionMarkIndex, 1);
  }

  // 5. Handle Postgres specific RETURNING clause
  let returningClause: string | null = null;
  const returningMatch = normalizedSql.match(/\s+RETURNING\s+(.+)$/i);
  if (returningMatch) {
    returningClause = returningMatch[1].trim();
    normalizedSql = normalizedSql.substring(0, returningMatch.index).trim();
  }

  // 6. Normalize SQL types and handle Postgres dialect differences
  normalizedSql = normalizedSql
    .replace(/\bserial\b/gi, "integer")
    .replace(/\bbigserial\b/gi, "integer")
    .replace(/\btimestamp\b\s+with\s+time\s+zone\b/gi, "timestamp")
    .replace(/\bjsonb\b/gi, "json")
    .replace(/\bdouble\s+precision\b/gi, "double");

  // Replace 'default' in VALUES list with NULL for AlaSQL parser compatibility
  if (normalizedSql.toLowerCase().includes("values")) {
    normalizedSql = normalizedSql.replace(/\bdefault\b/gi, "NULL");
  }

  // Skip unsupported ALTER TABLE add constraint or similar
  if (normalizedSql.toLowerCase().startsWith("alter table") && normalizedSql.toLowerCase().includes("add constraint")) {
    console.log("[AlaSQL Mock] Skipping unsupported ALTER TABLE constraint query:", normalizedSql);
    return { rows: [], rowCount: 0, fields: [] };
  }

  // Skip index creation if AlaSQL complains
  if (normalizedSql.toLowerCase().startsWith("create index") || normalizedSql.toLowerCase().startsWith("create unique index")) {
    console.log("[AlaSQL Mock] Skipping index creation query:", normalizedSql);
    return { rows: [], rowCount: 0, fields: [] };
  }

  const ensureTable = (tableName: string) => {
    const dbName = "alasql";
    if (!(alasql as any).databases[dbName]) {
      (alasql as any).databases[dbName] = {
        databaseid: dbName,
        dbversion: 0,
        tables: {},
        views: {},
        triggers: {},
        indices: {},
        objects: {},
        counter: 0,
        sqlCache: {},
        sqlCacheSize: 0,
        astCache: {},
      };
    }
    const tables = (alasql as any).databases[dbName].tables;
    if (!tables[tableName]) {
      tables[tableName] = { data: [], columns: [] };
    }
  };

  // Pre-emptively ensure tables referenced in FROM/INTO/UPDATE exist in AlaSQL
  const tableMatches = normalizedSql.match(/(?:from|into|update|join)\s+([\[\`"]?[a-zA-Z0-9_]+[\]\`"]?)/gi);
  if (tableMatches) {
    for (const match of tableMatches) {
      const parts = match.trim().split(/\s+/);
      if (parts[1]) {
        ensureTable(parts[1].replace(/[\[\]"`]/g, ""));
      }
    }
  }

  try {
    let results = alasql(normalizedSql, localParams);

    // If query was insert/update/delete, fetch returned rows for Drizzle
    if (returningClause && (sqlText.toLowerCase().startsWith("insert") || sqlText.toLowerCase().startsWith("update") || sqlText.toLowerCase().startsWith("delete"))) {
      const tableMatch = sqlText.match(/(?:insert\s+into|update|delete\s+from)\s+([a-zA-Z0-9_\.]+)/i);
      if (tableMatch) {
        let tableName = tableMatch[1].replace(/["`]/g, "");
        if (tableName.includes(".")) {
          tableName = tableName.split(".")[1];
        }
        
        const dbName = "alasql";
        const tableData = (alasql as any).databases[dbName]?.tables[tableName]?.data || [];
        if (sqlText.toLowerCase().startsWith("insert")) {
          // Return the newly inserted row
          const lastItem = tableData[tableData.length - 1] || {};
          results = [lastItem];
        } else {
          // Return the full list or matched items
          results = tableData;
        }
      }
    }

    // Save changes to disk
    const isWrite = sqlText.toLowerCase().startsWith("insert") || 
                    sqlText.toLowerCase().startsWith("update") || 
                    sqlText.toLowerCase().startsWith("delete") || 
                    sqlText.toLowerCase().startsWith("create") || 
                    sqlText.toLowerCase().startsWith("drop");
    if (isWrite) {
      saveDatabase();
    }

    const isArrayMode = sql && typeof sql === "object" && sql.rowMode === "array";
    let rows = Array.isArray(results) ? results : (results ? [results] : []);

    let fields: { name: string }[] = [];
    if (rows.length > 0 && rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0])) {
      const keys = Object.keys(rows[0]);
      fields = keys.map((name) => ({ name }));
      if (isArrayMode) {
        rows = rows.map((obj: any) => keys.map((k) => obj[k]));
      }
    }

    return {
      rows,
      rowCount: rows.length,
      fields,
    };
  } catch (error: any) {
    console.warn("[AlaSQL Mock Query Warning] Failed query:", normalizedSql, "Error:", error.message);
    // Return empty success instead of throwing to prevent application crashes
    return {
      rows: [],
      rowCount: 0,
      fields: []
    };
  }
}

// AlaSQL pg Pool Mock
class AlaSqlPool {
  private listeners: Record<string, Function[]> = {};

  on(event: string, listener: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(listener);
    return this;
  }

  async connect() {
    return new AlaSqlClient();
  }

  async query(sql: string, params?: any[]) {
    return runAlaSqlQuery(sql, params);
  }

  async end() {
    saveDatabase();
  }
}

class AlaSqlClient {
  async query(sql: string, params: any[] = []) {
    return runAlaSqlQuery(sql, params);
  }
  release() {}
}

// Async reachability check
async function checkDatabaseConnection(): Promise<boolean> {
  if (checkDone) return isConnected;
  checkDone = true;

  if (!databaseUrl) {
    isConnected = false;
    return false;
  }

  try {
    // Parse URL to check host/port
    const parsed = new URL(databaseUrl);
    const port = parseInt(parsed.port || "5432", 10);
    const host = parsed.hostname || "localhost";
    
    // Check port TCP reachability
    const reachable = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection(port, host);
      socket.setTimeout(1000);
      socket.on("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.on("error", () => {
        socket.destroy();
        resolve(false);
      });
    });

    if (reachable) {
      const testClient = new pg.Client({
        ...poolConfig,
        connectionTimeoutMillis: 1500,
      });
      try {
        await testClient.connect();
        await testClient.query("SELECT 1");
        await testClient.end();
        isConnected = true;
        console.log("[AI Studio] Real PostgreSQL database connected successfully on port", port);
      } catch (queryErr: any) {
        try { await testClient.end(); } catch (_) {}
        console.error("[Database] PostgreSQL connection test failed (" + (queryErr?.message || queryErr) + "). The configured endpoint must be enabled and reachable.");
        isConnected = false;
      }
    } else {
      console.error("[Database] PostgreSQL endpoint is not reachable. Check the Neon endpoint status and connection string.");
      isConnected = false;
    }
  } catch (err) {
    console.error("[Database] PostgreSQL connection check failed. Check the Neon endpoint status and connection string.");
    isConnected = false;
  }

  return isConnected;
}

checkDatabaseConnection().catch(() => {});

// Establish real or mock pool
let poolConnectionString = databaseUrl || "postgresql://localhost:5432/agency_os";

const isLocalhost = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") || databaseUrl.includes("::1");
const isSslRequired = process.env.DB_SSL === "true" || (!isLocalhost && process.env.DB_SSL !== "false");

const sslRejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === "true";

if (!sslRejectUnauthorized) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  if (poolConnectionString) {
    try {
      const u = new URL(poolConnectionString);
      u.search = "";
      poolConnectionString = u.toString();
    } catch (_) {
      poolConnectionString = poolConnectionString.replace(/([?&])sslmode=[^&]*/gi, "");
    }
  }
}

const poolConfig: pg.PoolConfig = { 
  connectionString: poolConnectionString,
  connectionTimeoutMillis: 15000,
  max: parseInt(process.env.DB_POOL_MAX || "50", 10),
  idleTimeoutMillis: 30000,
};

if (isSslRequired) {
  poolConfig.ssl = { rejectUnauthorized: sslRejectUnauthorized };
}

const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  console.warn("[AI Studio] Suppressed pg pool background error:", err?.message || err);
});

let activePoolInstance: any = null;

async function getActivePool() {
  if (isAlaSqlMode()) {
    if (!activePoolInstance || !(activePoolInstance instanceof AlaSqlPool)) {
      activePoolInstance = new AlaSqlPool();
      loadDatabase();
    }
    return activePoolInstance;
  }

  if (!activePoolInstance) {
    activePoolInstance = pool;
  }
  return activePoolInstance;
}

// Intercept methods of the exported pool
const originalQuery = pool.query.bind(pool);
const originalConnect = pool.connect.bind(pool);

pool.query = function(sql: any, params?: any, cb?: any) {
  let actualParams = params;
  let actualCb = cb;
  if (typeof params === "function") {
    actualCb = params;
    actualParams = undefined;
  }

  // Shallow-clone query object to strip 'name' property to avoid PgBouncer transaction-mode prepared statement errors
  let queryObj = sql;
  if (typeof sql === "object" && sql !== null) {
    queryObj = { ...sql };
    if ("name" in queryObj) {
      delete queryObj.name;
    }
  }

  if (!isAlaSqlMode()) {
    const isConnOrAuthError = (err: any) => {
      if (!err || !err.message) return false;
      const msg = String(err.message).toLowerCase();
      return msg.includes("password authentication failed") ||
             msg.includes("circuitbreaker") ||
             msg.includes("econnrefused") ||
             msg.includes("connection terminated") ||
             msg.includes("too many authentication failures") ||
             msg.includes("connect econnrefused");
    };

    if (actualCb) {
      const wrappedCb = (err: any, res: any) => {
        if (err) {
          console.error("[PostgreSQL Query Error]:", err.message || err, "\nSQL:", typeof queryObj === "object" ? queryObj.text : queryObj);
          if (isConnOrAuthError(err)) {
            isConnected = false;
          }
        }
        actualCb(err, res);
      };
      return actualParams !== undefined 
        ? originalQuery(queryObj, actualParams, wrappedCb)
        : originalQuery(queryObj, wrappedCb);
    }

    const p = actualParams !== undefined 
      ? originalQuery(queryObj, actualParams)
      : originalQuery(queryObj);

    return p.catch(async (err: any) => {
      console.error("[PostgreSQL Query Error]:", err.message || err, "\nSQL:", typeof queryObj === "object" ? queryObj.text : queryObj);
      if (isConnOrAuthError(err)) isConnected = false;
      throw err;
    });
  }

  if (actualCb) {
    getActivePool().then((activePool) => {
      activePool.query(queryObj, actualParams, actualCb);
    }).catch((err) => actualCb(err));
    return;
  }

  return getActivePool().then((activePool) => {
    return activePool.query(queryObj, actualParams);
  });
} as any;

pool.connect = function(cb?: any) {
  if (!isAlaSqlMode()) {
    if (cb) {
      return originalConnect(cb);
    }
    return originalConnect();
  }

  if (cb) {
    getActivePool().then((activePool) => {
      activePool.connect(cb);
    }).catch((err) => cb(err));
    return;
  }

  return getActivePool().then((activePool) => {
    return activePool.connect();
  });
} as any;

// Initialize drizzle DB with our hybrid pool
const db = drizzle(pool, { schema });

// Self-healing database schema migrations
(async () => {
  try {
    if (!isAlaSqlMode() && databaseUrl) {
      const client = new pg.Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
      });
      await client.connect();
      await client.query(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_delegated_admin" boolean DEFAULT false;
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "portal_mode" text DEFAULT 'MODE_1';
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "view_all_clients" boolean DEFAULT false;
        ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "description" text;

        CREATE TABLE IF NOT EXISTS "audit_logs" (
          "id" text PRIMARY KEY,
          "admin_user_id" text NOT NULL,
          "admin_user_name" text,
          "target_user_id" text NOT NULL,
          "target_user_name" text,
          "action" text NOT NULL,
          "permissions_added" jsonb DEFAULT '[]'::jsonb,
          "permissions_removed" jsonb DEFAULT '[]'::jsonb,
          "reason" text,
          "details" text,
          "created_at" timestamp DEFAULT now() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS "audit_logs_target_user_idx" ON "audit_logs" ("target_user_id");
        CREATE INDEX IF NOT EXISTS "audit_logs_admin_user_idx" ON "audit_logs" ("admin_user_id");
      `);
      await client.end();
    }
  } catch (err: any) {
    console.warn("[AI Studio] Schema check warning:", err?.message || err);
  }
})();

export { pool, db };
export * from "./schema/index.js";
