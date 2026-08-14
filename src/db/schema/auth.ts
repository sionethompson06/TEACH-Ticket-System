import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { REFERENCE_ORGANIZATION } from "../reference-data";
import { organizations } from "./organizations";

// Better Auth's core identity/session models, doubling as the Phase 3 local
// application user profile. Every Phase 3 user belongs to the fixed TEACH
// organization and holds only the nonprivileged "requester" base role —
// both are database-enforced, not just defaulted in application code.
// Elevated roles and permissions are Phase 4 scope and do not exist here.
export const user = pgTable(
  "user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    organizationId: uuid("organization_id")
      .notNull()
      .default(REFERENCE_ORGANIZATION.id)
      .references(() => organizations.id, { onDelete: "restrict" }),
    baseRole: text("base_role").notNull().default("requester"),
    isActive: boolean("is_active").notNull().default(true),
    // Phase 4 MVP: the smallest possible administrator designation — one
    // boolean, defaulting false, settable only by a direct database
    // operation (never client input, never a seed, never a bootstrap
    // account). See docs/AUTHENTICATION.md for how the first real
    // administrator is configured.
    isSystemAdministrator: boolean("is_system_administrator")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("user_email_unique_idx").on(table.email),
    // Composite unique target so Phase 5 ticket tables can enforce, at the
    // database level, that a ticket's requester/assignee belongs to the
    // same organization as the ticket itself.
    unique("user_id_org_unique").on(table.id, table.organizationId),
    check(
      "user_base_role_requester_check",
      sql`${table.baseRole} = 'requester'`,
    ),
    check(
      "user_organization_fixed_check",
      // sql.raw is required here: a plain template interpolation would be
      // sent as a bound query parameter, which is not valid inside a
      // static CHECK constraint definition. REFERENCE_ORGANIZATION.id is a
      // fixed, hand-authored constant, not external input.
      sql`${table.organizationId} = ${sql.raw(`'${REFERENCE_ORGANIZATION.id}'`)}::uuid`,
    ),
    // Phase 9A: domain eligibility (either the strict @teachps.org
    // requirement or invite-only acceptance) is an application-layer
    // decision (src/auth/google-identity-policy.ts) selected by the
    // deployment's AUTH_ACCESS_MODE — it can no longer be a single static
    // database constraint, since the same schema now supports either mode.
    // Verification and lowercase normalization remain database-enforced
    // regardless of mode.
    check(
      "user_verified_email_check",
      sql`${table.emailVerified} = true
        AND ${table.email} = lower(${table.email})
        AND ${table.email} ~ '^[^@[:space:]]+@[^@[:space:]]+$'`,
    ),
  ],
);

// Google is the only linked provider in Phase 3. `account_id` stores
// Google's immutable `sub`; provider tokens and passwords are never
// persisted — a database hook strips them before insert/update, and the
// check constraint below guarantees it regardless of application code.
export const account = pgTable(
  "account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("account_provider_account_unique").on(
      table.providerId,
      table.accountId,
    ),
    index("account_user_id_idx").on(table.userId),
    check(
      "account_provider_google_only_check",
      sql`${table.providerId} = 'google'`,
    ),
    check(
      "account_no_persisted_credentials_check",
      sql`${table.accessToken} IS NULL
        AND ${table.refreshToken} IS NULL
        AND ${table.idToken} IS NULL
        AND ${table.password} IS NULL`,
    ),
  ],
);

export const session = pgTable(
  "session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("session_token_unique_idx").on(table.token),
    index("session_user_id_idx").on(table.userId),
  ],
);

// Required by the Drizzle adapter for compatibility. No magic-link,
// email/password-reset, or OTP feature reads or writes this table in
// Phase 3.
export const verification = pgTable(
  "verification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);
