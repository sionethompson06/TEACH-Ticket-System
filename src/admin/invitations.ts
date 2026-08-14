import { desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { authorize, type ResolvedActor } from "../authz/policy";
import * as schema from "../db/schema";
import { authInvitations } from "../db/schema";
import {
  findLatestInvitation,
  insertPendingInvitation,
  normalizeInviteEmail,
  type InvitationStatus,
} from "../auth/invitations";
import { AdminAuthorizationError, AdminValidationError } from "./errors";

// Admin-authorized mutations and queries for the Phase 9A "Pilot
// Invitations" section of /admin — reuses the same `administer`
// authorization action every other admin/ module already uses, and the
// same low-level invitation store the Better Auth provisioning hooks and
// the guarded access:invite CLI both use. Only ever active while the
// deployment's AUTH_ACCESS_MODE is invite_only (the page hides this
// section entirely otherwise); this module itself does not read that
// configuration, since the caller has already decided to render it.

type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

type ActiveActor = Extract<ResolvedActor, { status: "active" }>;

function assertAdministrator(
  actor: ResolvedActor,
): asserts actor is ActiveActor {
  if (actor.status !== "active" || !authorize(actor, { kind: "administer" })) {
    throw new AdminAuthorizationError();
  }
}

export interface AdminInvitationSummary {
  id: string;
  email: string;
  status: InvitationStatus;
  createdAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}

// Never selects created_by_user_id, accepted_by_user_id,
// revoked_by_user_id, or the invitation's own id as visible text — only
// the email, status, and plain dates the Pilot Invitations section
// renders. The row id is still returned for binding the Revoke action's
// Server Action argument, the same way admin/page.tsx binds a staff
// member's id without ever printing it.
export async function listInvitationsForAdmin(
  db: Database,
  actor: ResolvedActor,
): Promise<AdminInvitationSummary[]> {
  assertAdministrator(actor);

  const rows = await db
    .select({
      id: authInvitations.id,
      email: authInvitations.email,
      status: authInvitations.status,
      createdAt: authInvitations.createdAt,
      acceptedAt: authInvitations.acceptedAt,
      revokedAt: authInvitations.revokedAt,
    })
    .from(authInvitations)
    .where(eq(authInvitations.organizationId, actor.organizationId))
    .orderBy(desc(authInvitations.createdAt));

  return rows as AdminInvitationSummary[];
}

// Creating an invitation never grants any access by itself — it only
// allows a first Google sign-in from this address, in invite-only mode, to
// provision a plain requester. A duplicate pending invitation to the same
// address is rejected outright (never silently merged or replaced),
// distinguishing this admin-facing action from the guarded CLI's
// idempotent-by-design create.
export async function createInvitation(
  db: Database,
  actor: ResolvedActor,
  rawEmail: string,
): Promise<void> {
  assertAdministrator(actor);

  const normalizedEmail = normalizeInviteEmail(rawEmail);
  if (!normalizedEmail) {
    throw new AdminValidationError("Enter a valid email address.");
  }

  const latest = await findLatestInvitation(
    db,
    actor.organizationId,
    normalizedEmail,
  );
  if (latest?.status === "pending") {
    throw new AdminValidationError(
      "An invitation to this address is already pending.",
    );
  }

  await insertPendingInvitation(db, {
    organizationId: actor.organizationId,
    email: normalizedEmail,
    createdSource: "admin_ui",
    createdByUserId: actor.userId,
  });
}

// Only ever revokes a still-pending invitation — an accepted invitation's
// history is left untouched; removing that person's access is done by
// deactivating their user account at /admin instead (revoking history is
// never a substitute for that).
export async function revokeInvitation(
  db: Database,
  actor: ResolvedActor,
  invitationId: string,
): Promise<void> {
  assertAdministrator(actor);

  const [row] = await db
    .select()
    .from(authInvitations)
    .where(eq(authInvitations.id, invitationId));

  if (!row || row.organizationId !== actor.organizationId) {
    throw new AdminValidationError("That invitation could not be found.");
  }

  if (row.status !== "pending") {
    throw new AdminValidationError("Only a pending invitation can be revoked.");
  }

  await db
    .update(authInvitations)
    .set({
      status: "revoked",
      revokedByUserId: actor.userId,
      revokedAt: new Date(),
    })
    .where(eq(authInvitations.id, invitationId));
}
