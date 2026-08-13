export function getRuntimeDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Configure it in your environment before using the database.",
    );
  }
  return url;
}

export function getMigrationDatabaseUrl(): string {
  const url = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "No database connection is configured. Set DATABASE_MIGRATION_URL (preferred) or DATABASE_URL before running a migration or seed command.",
    );
  }
  return url;
}
