import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
  dbCredentials: {
    // Only used by db:migrate-style drizzle-kit commands that need a live
    // connection; db:generate and db:check work offline against ./drizzle
    // and never need a real value here.
    url:
      process.env.DATABASE_MIGRATION_URL ??
      process.env.DATABASE_URL ??
      "postgresql://localhost:5432/placeholder",
  },
});
