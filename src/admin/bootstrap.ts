import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "../db/schema";
import { account, authInvitations, user } from "../db/schema";
import { REFERENCE_ORGANIZATION } from "../db/reference-data";
import type { AuthAccessMode } from "../auth/access-mode";
import { normalizeInviteEmail } from "../auth/invitations";

// A separate, purpose-built path for designating the very first system
// administrator — used only by the guarded src/db/scripts/admin-bootstrap.ts
// CLI. It intentionally does NOT call authorize()/assertAdministrator()
// from src/admin/admin-service.ts: at this point in a fresh deployment, no
// administrator exists yet to authorize the action, so this operates with
// direct, operator-level database authority instead (see
// docs/AUTHENTICATION.md and docs/DEPLOYMENT.md).
//
// Phase 9A: the eligibility rule for the target account now depends on the
// deployment's AUTH_ACCESS_MODE — workspace mode preserves the original
// exact-domain requirement; invite_only mode instead requires a linked
// Google account and an accepted pilot invitation, and never requires any
// particular email domain.

type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

export interface BootstrapParams {
  email: string;
  confirmEmail?: string;
  apply: boolean;
  accessMode: AuthAccessMode;
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

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Exact, normalized match only — no wildcard, no case-insensitive domain
// tricks, no subdomain allowance. In workspace mode the domain must match
// AUTH_ALLOWED_DOMAIN exactly; in invite_only mode any valid-shape email is
// accepted, since an invited address may belong to any domain.
export function normalizeEmailForAccessMode(
  rawEmail: string,
  accessMode: AuthAccessMode,
): string | null {
  if (accessMode.kind === "invite_only") {
    return normalizeInviteEmail(rawEmail);
  }

  const trimmed = rawEmail.trim().toLowerCase();
  const domainPattern = new RegExp(
    `^[^\\s@]+@${escapeForRegExp(accessMode.allowedDomain)}$`,
  );
  return domainPattern.test(trimmed) ? trimmed : null;
}

export async function bootstrapFirstSystemAdministrator(
  db: Database,
  params: BootstrapParams,
): Promise<BootstrapOutcome> {
  const normalizedEmail = normalizeEmailForAccessMode(
    params.email,
    params.accessMode,
  );
  if (!normalizedEmail) {
    return {
      kind: "error",
      reason:
        params.accessMode.kind === "workspace"
          ? `The --email value must be an exact @${params.accessMode.allowedDomain} address, not a personal or malformed email.`
          : "The --email value is not a valid email address.",
    };
  }

  if (params.apply) {
    if (!params.confirmEmail) {
      return {
        kind: "error",
        reason: "--confirm-email is required together with --apply.",
      };
    }
    const normalizedConfirmEmail = normalizeEmailForAccessMode(
      params.confirmEmail,
      params.accessMode,
    );
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
        "No user with that email has signed in yet. The target account must already exist from a successful Google sign-in before it can be designated as a system administrator.",
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

  if (params.accessMode.kind === "invite_only") {
    const [linkedGoogleAccount] = await db
      .select()
      .from(account)
      .where(and(eq(account.userId, row.id), eq(account.providerId, "google")));
    if (!linkedGoogleAccount) {
      return {
        kind: "error",
        reason:
          "That user has no linked Google account and cannot be made an administrator.",
      };
    }

    const [acceptedInvitation] = await db
      .select()
      .from(authInvitations)
      .where(
        and(
          eq(authInvitations.organizationId, REFERENCE_ORGANIZATION.id),
          eq(authInvitations.acceptedByUserId, row.id),
          eq(authInvitations.status, "accepted"),
        ),
      );
    if (!acceptedInvitation) {
      return {
        kind: "error",
        reason:
          "That user does not have an accepted pilot invitation and cannot be made an administrator.",
      };
    }
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
