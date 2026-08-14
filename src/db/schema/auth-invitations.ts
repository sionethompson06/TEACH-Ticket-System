import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { REFERENCE_ORGANIZATION } from "../reference-data";
import { user } from "./auth";
import { organizations } from "./organizations";

// Phase 9A MVP: the smallest possible invitation model for a controlled
// pilot in invite_only access mode. A row means "this email is (or was)
// invited" — there is no generalized invitation platform, no expiry, and
// no email delivery; an administrator or the guarded CLI tells the invited
// person directly to visit the sign-in page. History is never deleted:
// accepting or revoking only ever updates status/timestamp columns.
export const authInvitations = pgTable(
  "auth_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .default(REFERENCE_ORGANIZATION.id)
      .references(() => organizations.id, { onDelete: "restrict" }),
    // Normalized (trimmed, lowercased) by application code before every
    // write; also enforced by a CHECK constraint below so the invariant
    // holds regardless of the calling code path.
    email: text("email").notNull(),
    status: text("status").notNull().default("pending"),
    createdSource: text("created_source").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedByUserId: uuid("revoked_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    // At most one current (pending) invitation per normalized email within
    // an organization — a partial unique index, not a plain unique
    // constraint, so accepted/revoked history rows never block a fresh
    // invitation to the same address.
    uniqueIndex("auth_invitations_pending_email_unique_idx")
      .on(table.organizationId, table.email)
      .where(sql`${table.status} = 'pending'`),
    index("auth_invitations_email_idx").on(table.email),
    index("auth_invitations_status_idx").on(table.status),
    check(
      "auth_invitations_organization_fixed_check",
      sql`${table.organizationId} = ${sql.raw(`'${REFERENCE_ORGANIZATION.id}'`)}::uuid`,
    ),
    check(
      "auth_invitations_status_check",
      sql`${table.status} IN ('pending', 'accepted', 'revoked')`,
    ),
    check(
      "auth_invitations_created_source_check",
      sql`${table.createdSource} IN ('cli', 'admin_ui')`,
    ),
    check(
      "auth_invitations_email_shape_check",
      sql`${table.email} = lower(${table.email})
        AND ${table.email} ~ '^[^@[:space:]]+@[^@[:space:]]+$'`,
    ),
    // A row's status and its acceptance/revocation columns must always
    // agree — enforced here, not just by the application's own read-modify
    // path, so an invariant violation is impossible regardless of how a
    // row is written.
    check(
      "auth_invitations_status_shape_check",
      sql`(
        ${table.status} = 'pending'
        AND ${table.acceptedByUserId} IS NULL AND ${table.acceptedAt} IS NULL
        AND ${table.revokedByUserId} IS NULL AND ${table.revokedAt} IS NULL
      ) OR (
        ${table.status} = 'accepted'
        AND ${table.acceptedByUserId} IS NOT NULL AND ${table.acceptedAt} IS NOT NULL
        AND ${table.revokedByUserId} IS NULL AND ${table.revokedAt} IS NULL
      ) OR (
        ${table.status} = 'revoked'
        AND ${table.revokedByUserId} IS NOT NULL AND ${table.revokedAt} IS NOT NULL
        AND ${table.acceptedByUserId} IS NULL AND ${table.acceptedAt} IS NULL
      )`,
    ),
    // Every acting user id (creator, accepter, revoker), when set, must
    // belong to this invitation's own organization — the same
    // organization-scoping pattern already used by tickets/comments.
    foreignKey({
      columns: [table.createdByUserId, table.organizationId],
      foreignColumns: [user.id, user.organizationId],
      name: "auth_invitations_created_by_org_fk",
    }),
    foreignKey({
      columns: [table.acceptedByUserId, table.organizationId],
      foreignColumns: [user.id, user.organizationId],
      name: "auth_invitations_accepted_by_org_fk",
    }),
    foreignKey({
      columns: [table.revokedByUserId, table.organizationId],
      foreignColumns: [user.id, user.organizationId],
      name: "auth_invitations_revoked_by_org_fk",
    }),
  ],
);
