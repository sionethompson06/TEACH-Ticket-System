import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { getMigrationDatabaseUrl } from "../env";

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: getMigrationDatabaseUrl() });
  try {
    const db = drizzle(pool);
    console.log("Applying committed migrations from ./drizzle ...");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations applied successfully.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Migration failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
