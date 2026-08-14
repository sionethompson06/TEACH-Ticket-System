import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "../db/schema";
import { user } from "../db/schema";
import { REFERENCE_ORGANIZATION } from "../db/reference-data";

// A separate, purpose-built path for designating the very first system
// administrator — used only by the guarded src/db/scripts/admin-bootstrap.ts
// CLI. It intentionally does NOT call authorize()/assertAdministrator()
// from src/admin/admin-service.ts: at this point in a fresh deployment, no
// administrator exists yet to authorize the action, so this operates with
// direct, operator-level database authority instead (see
// docs/AUTHENTICATION.md and docs/DEPLOYMENT.md).

type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

export interface BootstrapParams {
  email: string;
  confirmEmail?: string;
  apply: boolean;
}

export type BootstrapOutcome =
  | {
      kind: "dry_run";
      targetName: string;
      targetEmail: string;
      alreadyAdministrator: boolean;
    }
  | { kind: "applied"; targetName: string; targetEmail: string }
  | { kind: "no_change"; targetName: string; targetEmail: string }
  | { kind: "error"; reason: string };

const TEACH_EMAIL_PATTERN = /^[^\s@]+@teachps\.org$/;

// Exact, normalized match only — no wildcard, no case-insensitive domain
// tricks, no subdomain allowance.
export function normalizeTeachEmail(rawEmail: string): string | null {
  const trimmed = rawEmail.trim().toLowerCase();
  if (!TEACH_EMAIL_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export async function bootstrapFirstSystemAdministrator(
  db: Database,
  params: BootstrapParams,
): Promise<BootstrapOutcome> {
  const normalizedEmail = normalizeTeachEmail(params.email);
  if (!normalizedEmail) {
    return {
      kind: "error",
      reason:
        "The --email value must be an exact @teachps.org address, not a personal or malformed email.",
    };
  }

  if (params.apply) {
    if (!params.confirmEmail) {
      return {
        kind: "error",
        reason: "--confirm-email is required together with --apply.",
      };
    }
    const normalizedConfirmEmail = normalizeTeachEmail(params.confirmEmail);
    if (!normalizedConfirmEmail || normalizedConfirmEmail !== normalizedEmail) {
      return {
        kind: "error",
        reason: "--confirm-email must exactly match --email.",
      };
    }
  }

  const [row] = await db
    .select()
    .from(user)
    .where(eq(user.email, normalizedEmail));

  if (!row) {
    return {
      kind: "error",
      reason:
        "No user with that email has signed in yet. The target account must already exist from a successful Google Workspace sign-in before it can be designated as a system administrator.",
    };
  }

  if (!row.isActive) {
    return {
      kind: "error",
      reason:
        "That user's account is inactive and cannot be made an administrator.",
    };
  }

  if (row.organizationId !== REFERENCE_ORGANIZATION.id) {
    return {
      kind: "error",
      reason:
        "That user does not belong to the canonical TEACH organization and cannot be made an administrator.",
    };
  }

  if (row.isSystemAdministrator) {
    return params.apply
      ? { kind: "no_change", targetName: row.name, targetEmail: row.email }
      : {
          kind: "dry_run",
          targetName: row.name,
          targetEmail: row.email,
          alreadyAdministrator: true,
        };
  }

  if (!params.apply) {
    return {
      kind: "dry_run",
      targetName: row.name,
      targetEmail: row.email,
      alreadyAdministrator: false,
    };
  }

  await db
    .update(user)
    .set({ isSystemAdministrator: true, updatedAt: new Date() })
    .where(eq(user.id, row.id));

  return { kind: "applied", targetName: row.name, targetEmail: row.email };
}
