import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "../db/schema";
import { REFERENCE_ORGANIZATION } from "../db/reference-data";
import type { AuthAccessMode } from "./access-mode";
import {
  findLatestInvitation,
  insertPendingInvitation,
  normalizeInviteEmail,
  type InvitationStatus,
} from "./invitations";

type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

// The guarded, operator-level path for creating a pilot invitation from
// the command line (src/db/scripts/access-invite.ts) — mirrors
// src/admin/bootstrap.ts's separation from the admin-authorized service:
// the very first invitation must be creatable before any administrator
// (or even any user) exists yet to use the admin UI, so this operates
// with direct database authority instead of authorize().

export type InvitationLifecycleState = "none" | InvitationStatus;

export interface InviteBootstrapParams {
  email: string;
  confirmEmail?: string;
  apply: boolean;
  accessMode: AuthAccessMode | null;
}

export type InviteBootstrapOutcome =
  | {
      kind: "dry_run";
      email: string;
      currentState: InvitationLifecycleState;
      wouldCreate: boolean;
    }
  | { kind: "created"; email: string; currentState: InvitationLifecycleState }
  | { kind: "unchanged"; email: string; currentState: InvitationLifecycleState }
  | { kind: "error"; reason: string };

export async function bootstrapInvitation(
  db: Database,
  params: InviteBootstrapParams,
): Promise<InviteBootstrapOutcome> {
  if (!params.accessMode || params.accessMode.kind !== "invite_only") {
    return {
      kind: "error",
      reason:
        "AUTH_ACCESS_MODE must be set to invite_only to create a pilot invitation.",
    };
  }

  const normalizedEmail = normalizeInviteEmail(params.email);
  if (!normalizedEmail) {
    return {
      kind: "error",
      reason: "The --email value is not a valid email address.",
    };
  }

  if (params.apply) {
    if (!params.confirmEmail) {
      return {
        kind: "error",
        reason: "--confirm-email is required together with --apply.",
      };
    }
    const normalizedConfirmEmail = normalizeInviteEmail(params.confirmEmail);
    if (!normalizedConfirmEmail || normalizedConfirmEmail !== normalizedEmail) {
      return {
        kind: "error",
        reason: "--confirm-email must exactly match --email.",
      };
    }
  }

  const latest = await findLatestInvitation(
    db,
    REFERENCE_ORGANIZATION.id,
    normalizedEmail,
  );
  const currentState: InvitationLifecycleState = latest?.status ?? "none";
  // A pending or already-accepted invitation is left exactly as-is; only
  // "none" (never invited) or "revoked" (a past invitation, never
  // silently reactivated) result in a brand-new pending row.
  const wouldCreate = currentState === "none" || currentState === "revoked";

  if (!params.apply) {
    return {
      kind: "dry_run",
      email: normalizedEmail,
      currentState,
      wouldCreate,
    };
  }

  if (!wouldCreate) {
    return { kind: "unchanged", email: normalizedEmail, currentState };
  }

  await insertPendingInvitation(db, {
    organizationId: REFERENCE_ORGANIZATION.id,
    email: normalizedEmail,
    createdSource: "cli",
  });

  return { kind: "created", email: normalizedEmail, currentState };
}
