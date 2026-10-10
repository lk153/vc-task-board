import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Local runs read .env.local; on Vercel the variables are already set (and win).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Migrations prefer Neon's direct (unpooled) connection when available.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
  dbCredentials: { url: url ?? "" },
  strict: true,
  verbose: true,
});
