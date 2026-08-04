import { defineConfig } from "drizzle-kit";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Use the direct (non-pooler) URL for schema introspection.
// Pooler URLs contain "-pooler" in the hostname; replace with direct host.
// Also strip channel_binding which drizzle-kit's pg driver doesn't support.
function getDirectUrl(): string {
  const raw = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "";
  if (!raw) throw new Error("DATABASE_URL or NEON_DATABASE_URL must be set for drizzle-kit");
  try {
    const u = new URL(raw);
    u.hostname = u.hostname.replace("-pooler", "");
    u.searchParams.delete("channel_binding");
    // Ensure SSL
    if (!u.searchParams.get("sslmode")) {
      u.searchParams.set("sslmode", "require");
    }
    return u.toString();
  } catch {
    return raw;
  }
}

const dbUrl = getDirectUrl();
process.env.DATABASE_URL = dbUrl;

export default defineConfig({
  schema: "./lib/db/src/schema/*.ts",
  out: "./lib/db/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
