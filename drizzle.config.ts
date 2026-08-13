import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
  // Only present when a real connection is configured. db:generate and
  // db:check work entirely offline against ./drizzle and never need this;
  // commands that need a live connection are handled by our own scripts
  // (src/db/scripts/migrate.ts, seed.ts), which fail fast with a clear
  // error instead of silently falling back to a fake local URL.
  ...(url ? { dbCredentials: { url } } : {}),
});
