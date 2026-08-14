import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "../db/schema";
import { authInvitations } from "../db/schema";

// Shared, low-level invitation store — used by the Better Auth
// provisioning hooks (src/auth/auth-options.ts), the admin-authorized
// Pilot Invitations UI (src/admin/invitations.ts), and the guarded
// access:invite CLI (src/auth/invite-bootstrap.ts). None of the three
// callers duplicates the query/update shape below; each only adds its own
// authorization/validation framing on top.

export type Database =
  NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

export type InvitationStatus = "pending" | "accepted" | "revoked";
export type InvitationSource = "cli" | "admin_ui";

export interface InvitationRecord {
  id: string;
  organizationId: string;
  email: string;
  status: InvitationStatus;
  createdSource: InvitationSource;
  createdByUserId: string | null;
  createdAt: Date;
  acceptedByUserId: string | null;
  acceptedAt: Date | null;
  revokedByUserId: string | null;
  revokedAt: Date | null;
}

// A generic, domain-agnostic email shape check — deliberately not
// restricted to any particular domain, since invite-only mode must accept
// a personal Gmail address or any other Google Workspace domain equally.
const EMAIL_SHAPE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeInviteEmail(rawEmail: string): string | null {
  const trimmed = rawEmail.trim().toLowerCase();
  if (!EMAIL_SHAPE_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

// The most recent invitation "cycle" for this (organization, email) pair,
// if any. Accepting/revoking always updates an existing row in place, and
// a fresh invitation is only ever created when no pending row exists — so
// there is at most one pending row per email at a time, and the row with
// the latest created_at always reflects the email's current state.
export async function findLatestInvitation(
  db: Database,
  organizationId: string,
  normalizedEmail: string,
): Promise<InvitationRecord | null> {
  const [row] = await db
    .select()
    .from(authInvitations)
    .where(
      and(
        eq(authInvitations.organizationId, organizationId),
        eq(authInvitations.email, normalizedEmail),
      ),
    )
    .orderBy(desc(authInvitations.createdAt))
    .limit(1);
  return (row as InvitationRecord | undefined) ?? null;
}

export async function findPendingInvitation(
  db: Database,
  organizationId: string,
  normalizedEmail: string,
): Promise<InvitationRecord | null> {
  const latest = await findLatestInvitation(
    db,
    organizationId,
    normalizedEmail,
  );
  return latest?.status === "pending" ? latest : null;
}

export async function insertPendingInvitation(
  db: Database,
  params: {
    organizationId: string;
    email: string;
    createdSource: InvitationSource;
    createdByUserId?: string;
  },
): Promise<InvitationRecord> {
  const [row] = await db
    .insert(authInvitations)
    .values({
      organizationId: params.organizationId,
      email: params.email,
      status: "pending",
      createdSource: params.createdSource,
      createdByUserId: params.createdByUserId,
    })
    .returning();
  return row as InvitationRecord;
}

// Idempotent: a retry after the invitation has already been accepted (by
// this same call or a racing one) simply matches zero rows and is a safe
// no-op — it never overwrites an already-accepted row.
export async function acceptPendingInvitation(
  db: Database,
  params: { organizationId: string; email: string; acceptedByUserId: string },
): Promise<void> {
  await db
    .update(authInvitations)
    .set({
      status: "accepted",
      acceptedByUserId: params.acceptedByUserId,
      acceptedAt: new Date(),
    })
    .where(
      and(
        eq(authInvitations.organizationId, params.organizationId),
        eq(authInvitations.email, params.email),
        eq(authInvitations.status, "pending"),
      ),
    );
}
