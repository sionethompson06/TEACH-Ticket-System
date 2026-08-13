# TEACH Ticket System — Database Foundation

This document covers the Phase 2 database foundation: the PostgreSQL schema, migration workflow, and canonical reference data. Phase 3 added the authentication tables described briefly below; see [`AUTHENTICATION.md`](AUTHENTICATION.md) for the full authentication design. Neither phase includes role/permission enforcement beyond the fixed Requester role, department membership, or ticket functionality — none of that exists yet (see [`PHASE_PLAN.md`](PHASE_PLAN.md)).

## Dialect and Tooling

- **Dialect:** PostgreSQL. The schema, migrations, and constraints are written for PostgreSQL specifically (native `uuid`, `timestamptz`, `enum`, and `CHECK` constraint support).
- **Drizzle ORM** (`drizzle-orm`) defines the typed schema in TypeScript (`src/db/schema/`) and provides the typed query builder used by application code and scripts.
- **Drizzle Kit** (`drizzle-kit`) generates versioned SQL migrations from the typed schema and validates migration-folder consistency. It is a development-time tool only — it is never invoked at runtime, build, or deploy time.
- **node-postgres** (`pg`) is the PostgreSQL driver used for real server-side connections (migration and seed scripts today; application runtime connections in later phases).
- **PGlite** (`@electric-sql/pglite`) is an in-memory, PostgreSQL-compatible database used exclusively by the automated test suite (`npm run db:verify`). It is not a production database option.

## Provider-Neutral by Design

No managed PostgreSQL provider has been selected yet (see [`DECISION_LOG.md`](DECISION_LOG.md)). Nothing in this phase assumes a specific provider:

- The connection pattern is plain `pg.Pool` + a connection string — no provider-specific SDK or client library.
- SSL behavior is controlled entirely by the connection URL/provider, not hard-coded in application code.
- Pool configuration takes no provider-specific options.

## Phase 2 Tables

Exactly three reference-data tables exist. No department, queue, ticket, comment, attachment, notification, or audit table has been created.

### `organizations`

UUID primary key, unique `code`, `name`, `is_active`, `created_at`/`updated_at` (timezone-aware).

### `schools`

UUID primary key, `organization_id` (FK to `organizations`, delete-restricted), `code` (unique per organization), `name`, `grade_band`, `is_active`, timestamps. A school may have multiple service locations.

### `service_locations`

UUID primary key, `organization_id` (FK, delete-restricted), nullable `school_id` (FK, delete-restricted), `code` (unique per organization), `name`, `location_type` (`school_campus` | `central_office` | `system_wide`), nullable `grade_band`, nullable structured address fields (`address_line1`, `address_line2`, `city`, `state`, `postal_code`), `is_active`, timestamps.

Structural rules are enforced **in the database**, not just in application code:

- A composite foreign key ties `(school_id, organization_id)` to `schools(id, organization_id)`, so a location can never reference a school belonging to a different organization.
- A `CHECK` constraint (`service_locations_type_structure_check`) enforces that:
  - `school_campus` locations have a school and a full physical address.
  - `central_office` locations have no school but a full physical address.
  - `system_wide` locations have no school and no address fields at all.

## Canonical Reference Data

Seeded by `npm run db:seed` (see [`src/db/reference-data.ts`](../src/db/reference-data.ts)):

- **1 organization** — `TEACHPS` (TEACH Public Schools)
- **3 schools** — `TPE`, `TAT`, `TTHS`
- **6 service locations** — `TPE`, `TAT-56`, `TAT-78`, `TTHS`, `CMO`, `SYSTEM`

`TAT-56` and `TAT-78` are two separate service-location records that both reference the same `TAT` school record — one school, two physical campuses, matching [`PROJECT_FOUNDATION.md`](PROJECT_FOUNDATION.md). `CMO` and `SYSTEM` have no school association; `SYSTEM` additionally has no physical address, matching its system-wide, nonphysical nature.

Every reference record uses a **stable, hand-assigned UUID** that never changes between seed runs or environments.

## Phase 3 Tables

Four additional tables — `user`, `account`, `session`, and `verification` — support Google Workspace authentication and first-login provisioning. They are described fully in [`AUTHENTICATION.md`](AUTHENTICATION.md), including the `CHECK` constraints that fix every user to the canonical organization and the Requester role, forbid persisting any OAuth token or password, and forbid any provider other than `google`. No department, role beyond Requester, permission, or ticket-related table exists.

## Environment Variables

| Variable                 | Purpose                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`           | Future application/runtime PostgreSQL connection.                                                                        |
| `DATABASE_MIGRATION_URL` | Optional direct migration/seed connection, for providers that distinguish a pooled runtime connection from a direct one. |

Migration and seed scripts prefer `DATABASE_MIGRATION_URL` and fall back to `DATABASE_URL`. **Neither variable is required to build, test, or preview the application.** Importing any `src/db/*` module never requires an environment variable and never opens a connection — the database client is created lazily, only when a caller actually requests it. If a database command that needs a connection runs with neither variable set, it fails immediately with a concise error and never prints the value of either variable.

Document any real values only in a local, git-ignored file (`.env`, `.env.local`) or in managed deployment secrets — never in `.env.example` or anywhere in source control.

## Migration Workflow

Migrations are generated from the typed schema under `src/db/schema/` and committed to `drizzle/` as plain SQL, alongside Drizzle's migration journal and snapshot metadata (`drizzle/meta/`).

```bash
npm run db:generate   # generate a new versioned migration from the schema
npm run db:check      # validate migration-folder consistency (offline, no DB connection)
```

Review every generated migration's SQL before committing it. Do not hand-write a migration that disagrees with the typed schema — change the schema and regenerate instead.

## Applying Migrations and Seeding

```bash
npm run db:migrate    # apply committed migrations to the configured database
npm run db:seed       # apply canonical reference data (transactional, idempotent)
npm run db:setup      # migrate, then seed
```

These are **explicit, administrative commands only**. Migrations are never applied automatically during `npm install`, `npm run build`, `npm run start`, Next.js module import, or a Vercel deployment. Nothing in the application or its build process touches a real database.

**Take a backup before running migrations against any database containing real data.** This applies from the first production migration onward.

The seed is idempotent: it inserts any canonical record that's missing and safely updates descriptive fields on records that already exist (matched by their stable code), all inside one transaction. It never creates duplicates, never deletes unrelated records, and never truncates or resets anything.

## Verifying the Database Foundation

```bash
npm run db:verify
```

This runs `src/db/database-foundation.test.ts` against a completely fresh, in-memory PGlite instance: it applies the committed migrations, confirms only the seven approved tables exist (the three Phase 2 reference tables plus the four Phase 3 authentication tables), runs the seed, verifies exact record counts and relationships, reseeds to confirm idempotency, and confirms the database itself rejects duplicate codes, invalid foreign keys, invalid location-type structural combinations, and every authentication invariant described in [`AUTHENTICATION.md`](AUTHENTICATION.md). No external credentials or real database are involved — this is how a fresh clone proves the schema and seed work correctly, in CI and locally alike.

## Open Item

The **managed production PostgreSQL provider remains an open decision** (see [`DECISION_LOG.md`](DECISION_LOG.md)) — nothing here assumes or provisions one.

## Explicitly Not Included

Beyond the fixed Requester role provisioned on first sign-in (Phase 3), the database contains **no department, no elevated role or permission, and no ticket-related table**. It remains a database schema, reference-data, and authentication foundation only.
