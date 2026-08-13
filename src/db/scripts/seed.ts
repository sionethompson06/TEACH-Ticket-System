import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getMigrationDatabaseUrl } from "../env";
import * as schema from "../schema";
import { seedReferenceData } from "../seed-reference-data";

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: getMigrationDatabaseUrl() });
  try {
    const db = drizzle(pool, { schema });
    console.log("Seeding canonical reference data...");
    await seedReferenceData(db);
    console.log("Canonical reference data seeded successfully.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
