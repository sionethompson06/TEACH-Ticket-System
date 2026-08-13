import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { getRuntimeDatabaseUrl } from "./env";

type Database = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;
let db: Database | undefined;

// Lazy on purpose: importing this module must never require DATABASE_URL
// or open a connection. The pool is only created the first time a caller
// actually needs a database handle.
export function getDb(): Database {
  if (!db) {
    pool = new Pool({ connectionString: getRuntimeDatabaseUrl() });
    db = drizzle(pool, { schema });
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    db = undefined;
  }
}
