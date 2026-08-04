import { defineConfig } from "drizzle-kit";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

let dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || "postgresql://neondb_owner:npg_G8ClxfpYR6WU@ep-bold-sun-adfekmu3-pooler.c-2.us-east-1.aws.neon.tech/agencyos_db?sslmode=require&channel_binding=require";
if (dbUrl) {
  let cleanUrl = dbUrl.trim();
  if (cleanUrl.startsWith("DATABASE_URL=") || cleanUrl.startsWith("NEON_DATABASE_URL=")) {
    cleanUrl = cleanUrl.substring(cleanUrl.indexOf("=") + 1).trim();
  }
  if ((cleanUrl.startsWith('"') && cleanUrl.endsWith('"')) || (cleanUrl.startsWith("'") && cleanUrl.endsWith("'"))) {
    cleanUrl = cleanUrl.substring(1, cleanUrl.length - 1).trim();
  }
  process.env.DATABASE_URL = cleanUrl;
}

export default defineConfig({
  schema: "./src/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
