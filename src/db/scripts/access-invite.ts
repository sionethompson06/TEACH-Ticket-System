import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { resolveAuthAccessMode } from "../../auth/access-mode";
import { bootstrapInvitation } from "../../auth/invite-bootstrap";
import * as schema from "../schema";
import { getMigrationDatabaseUrl } from "../env";

const HELP_TEXT = `Usage: npm run access:invite -- --email <address> [--confirm-email <address>] [--apply]

Creates a pilot invitation for invite_only access mode. An invited
address may sign in once with any verified Google account (a personal
Gmail account, or an account from any Google Workspace domain) and be
provisioned as a plain requester — this command never creates a user and
never grants agent or administrator access.

Requires AUTH_ACCESS_MODE=invite_only in the current environment.

Without --apply, this is a dry run: it reports what would happen and
makes no changes. To make the real change, pass --apply together with
--confirm-email set to the exact same address as --email.

Examples:
  npm run access:invite -- --email person@example.com
  npm run access:invite -- --email person@example.com --confirm-email person@example.com --apply

Options:
  --email <address>          Required. The address to invite.
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

function describeState(
  state: "none" | "pending" | "accepted" | "revoked",
): string {
  switch (state) {
    case "none":
      return "no prior invitation existed for this address";
    case "pending":
      return "an invitation to this address is already pending";
    case "accepted":
      return "this address has already accepted an invitation";
    case "revoked":
      return "a previous invitation to this address was revoked";
  }
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

  const accessMode = resolveAuthAccessMode(process.env);
  if (!accessMode || accessMode.kind !== "invite_only") {
    console.error(
      "Error: AUTH_ACCESS_MODE must be set to invite_only to use this command.",
    );
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: getMigrationDatabaseUrl() });
  try {
    const db = drizzle(pool, { schema });
    const outcome = await bootstrapInvitation(db, {
      email: args.email,
      confirmEmail: args.confirmEmail,
      apply: args.apply,
      accessMode,
    });

    switch (outcome.kind) {
      case "dry_run":
        if (outcome.wouldCreate) {
          console.log(
            `[DRY RUN] Would create a pending invitation for ${outcome.email} (${describeState(outcome.currentState)}). No changes were made.`,
          );
          console.log(
            `Re-run with --confirm-email ${outcome.email} --apply to make this change.`,
          );
        } else {
          console.log(
            `[DRY RUN] No change: ${describeState(outcome.currentState)} for ${outcome.email}.`,
          );
        }
        break;
      case "created":
        console.log(
          `Pending invitation created for ${outcome.email} (${describeState(outcome.currentState)} beforehand). Tell them to visit the sign-in page.`,
        );
        break;
      case "unchanged":
        console.log(
          `No changes made: ${describeState(outcome.currentState)} for ${outcome.email}.`,
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
    "Pilot invitation command failed:",
    error instanceof Error ? error.message : "an unexpected error occurred",
  );
  process.exit(1);
});
