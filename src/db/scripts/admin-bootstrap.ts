import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { bootstrapFirstSystemAdministrator } from "../../admin/bootstrap";
import * as schema from "../schema";
import { getMigrationDatabaseUrl } from "../env";

const HELP_TEXT = `Usage: npm run admin:bootstrap -- --email <address> [--confirm-email <address>] [--apply]

Designates an existing, active, TEACH-organization user as the first
system administrator. The target user must have already signed in at
least once through Google Workspace sign-in — this command never creates
a user and never changes a user's organization.

Without --apply, this is a dry run: it reports what would change and
makes no changes. To make the real change, pass --apply together with
--confirm-email set to the exact same address as --email.

Examples:
  npm run admin:bootstrap -- --email administrator@teachps.org
  npm run admin:bootstrap -- --email administrator@teachps.org --confirm-email administrator@teachps.org --apply

Options:
  --email <address>          Required. The @teachps.org address to designate.
  --confirm-email <address>  Required together with --apply. Must exactly match --email.
  --apply                    Make the real change. Omit for a safe dry run.
  --help, -h                 Show this help message and exit.
`;

interface ParsedArgs {
  email?: string;
  confirmEmail?: string;
  apply: boolean;
  help: boolean;
}

function parseArgv(argv: string[]): ParsedArgs {
  const result: ParsedArgs = { apply: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") {
      result.apply = true;
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--email") {
      result.email = argv[++i];
    } else if (arg === "--confirm-email") {
      result.confirmEmail = argv[++i];
    }
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgv(process.argv.slice(2));

  if (args.help) {
    console.log(HELP_TEXT);
    return;
  }

  if (!args.email) {
    console.error("Error: --email is required.");
    console.error(HELP_TEXT);
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: getMigrationDatabaseUrl() });
  try {
    const db = drizzle(pool, { schema });
    const outcome = await bootstrapFirstSystemAdministrator(db, {
      email: args.email,
      confirmEmail: args.confirmEmail,
      apply: args.apply,
    });

    switch (outcome.kind) {
      case "dry_run":
        if (outcome.alreadyAdministrator) {
          console.log(
            `[DRY RUN] ${outcome.targetName} <${outcome.targetEmail}> is already a system administrator. No changes are needed.`,
          );
        } else {
          console.log(
            `[DRY RUN] Would grant system-administrator access to ${outcome.targetName} <${outcome.targetEmail}>. No changes were made.`,
          );
          console.log(
            `Re-run with --confirm-email ${outcome.targetEmail} --apply to make this change.`,
          );
        }
        break;
      case "applied":
        console.log(
          `System-administrator access granted to ${outcome.targetName} <${outcome.targetEmail}>.`,
        );
        break;
      case "no_change":
        console.log(
          `${outcome.targetName} <${outcome.targetEmail}> is already a system administrator. No changes were made.`,
        );
        break;
      case "error":
        console.error(`Error: ${outcome.reason}`);
        process.exitCode = 1;
        break;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Administrator bootstrap failed:",
    error instanceof Error ? error.message : "an unexpected error occurred",
  );
  process.exit(1);
});
