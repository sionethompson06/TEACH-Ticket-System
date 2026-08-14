# TEACH Ticket System — Database Foundation

This document covers the Phase 2 database foundation: the PostgreSQL schema, migration workflow, and canonical reference data. Phase 3 added the authentication tables described briefly below (see [`AUTHENTICATION.md`](AUTHENTICATION.md) for the full authentication design); Phase 4 added a minimal access-control model (departments, department agents, and a single system-administrator flag); Phase 5 added the core ticket data model and server-only ticket service. No ticket UI, SLA calculation, department-manager role, or confidential-access grant exists yet (see [`PHASE_PLAN.md`](PHASE_PLAN.md)).

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

Four additional tables — `user`, `account`, `session`, and `verification` — support Google Workspace authentication and first-login provisioning. They are described fully in [`AUTHENTICATION.md`](AUTHENTICATION.md), including the `CHECK` constraints that fix every user to the canonical organization and the Requester role, forbid persisting any OAuth token or password, and forbid any provider other than `google`. Phase 3 also added two plain columns to `user` used only starting in Phase 4: `is_active` (boolean, default `true`) and `is_system_administrator` (boolean, default `false`, described below).

## Phase 4 Tables — Minimal Access Control (MVP)

Two additional tables implement the smallest access-control model needed before real tickets exist. No category, SLA, queue, or ticket-related table exists yet.

### `departments`

UUID primary key, `organization_id` (FK to `organizations`, delete-restricted), `code` (unique per organization), `name`, `is_active`, timestamps. Seeded with exactly two rows — `IT` and `FACILITIES` — no other department exists.

### `department_memberships`

UUID primary key, `user_id` (FK to `user`, cascades on delete), `department_id` (FK to `departments`, delete-restricted), `organization_id` (FK to `organizations`, delete-restricted), `created_at`. A row means "this user is a department agent for this department" — there are no manager levels, expiring grants, or other richer concepts.

- `(user_id, department_id)` is unique — a duplicate membership is rejected.
- A composite foreign key ties `(department_id, organization_id)` to `departments(id, organization_id)`, so a membership can never claim an organization different from its department's actual organization — the same organization-scoping pattern already used by `service_locations` against `schools`.
- No department membership is seeded. Assigning a real user as a department agent is a future, separately performed operation once real users exist.

### System Administrator Designation

`user.is_system_administrator` is the entire administrator model for the MVP — one boolean column, defaulting `false`. It is:

- **Never** set by the seed, by any request the client can make, or by a bootstrap/development account.
- Declared `input: false` wherever it is exposed through Better Auth, so no API request can set it.
- Once at least one real administrator exists, settable by that administrator through `/admin` (Phase 8 — see `setSystemAdministrator` in `src/admin/admin-service.ts`), which itself only runs after the acting user is confirmed active and already a system administrator.
- The **first** real administrator can only ever be designated by a direct, separately approved database operation — `/admin` requires an existing administrator to sign in and use it, so it cannot bootstrap itself.

### Authorization Module

`src/authz/policy.ts` is a small, pure, framework-agnostic function (`authorize`) that decides whether a `ResolvedActor` may perform an `AuthorizationAction` — creating a ticket, accessing a ticket resource descriptor, managing a ticket (status/priority/assignment), or performing an administrative action. It has no dependency on Better Auth, Next.js, or a database, so it is fully unit-testable with synthetic data. `src/authz/resolve-actor.ts` builds the `ResolvedActor` strictly from a validated session's user id and a fresh database read (current `is_active`/`is_system_administrator` values and current department memberships) — it takes no role or membership parameter of any kind, so there is no channel through which a client-supplied claim could influence the result. The same module also exports `isSupportStaff(actor)` (Phase 7) — an actor-shape predicate, not a resource decision — used to gate the `/support` routes and the shared navigation's Support Queue link. Phase 8's `/admin` page and its entire `src/admin/` module reuse the existing `administer` action directly rather than adding a fifth authorization decision or a separate roles/permissions framework.

## Phase 5 Tables — Core Ticket Foundation

Four additional tables and a small server-only ticket service (`src/tickets/`) implement the fewest tables and concepts needed for a basic help-desk ticket, before any user interface exists.

### `ticket_categories`

UUID primary key, `organization_id` (FK, delete-restricted), `department_id` (FK, delete-restricted), `code`, `name`, `is_active`, `display_order`, timestamps.

- `(department_id, code)` is unique — a category code is unique **within a department**, not globally.
- A composite foreign key ties `(department_id, organization_id)` to `departments(id, organization_id)` — the same organization-scoping pattern already used by `department_memberships`.
- Seeded with the confirmed IT (7) and Facilities (8) categories from [`PROJECT_FOUNDATION.md`](PROJECT_FOUNDATION.md) Sections 4–5 — categories only, not the representative request types listed alongside them, and not any form-field or SLA configuration (Phase 6+ catalog scope).

### `tickets`

UUID primary key, a database-generated `ticket_number` (`integer GENERATED ALWAYS AS IDENTITY`, unique), `organization_id`, `requester_id`, `department_id`, `service_location_id`, `category_id`, `subject`, `description`, `status`, `priority`, nullable `assigned_agent_id`, and `created_at`/`updated_at`/`resolved_at`/`closed_at` timestamps.

- **Ticket number:** never derived from a record count, timestamp, random value, or client-side logic — a Postgres identity sequence guarantees uniqueness under concurrent inserts. Format one for display with `formatTicketNumber()` from [`src/tickets/ticket-number.ts`](../src/tickets/ticket-number.ts) (e.g. `TKT-000001`).
- **Status** (`ticket_status` enum): `submitted` (initial), `in_progress`, `waiting_for_requester`, `resolved`, `closed`, `reopened` — a deliberately small subset of the full lifecycle documented in `PROJECT_FOUNDATION.md` Section 6; see that section for exactly which states are deferred and why. `resolved_at`/`closed_at` are set when a ticket enters that status and are never cleared by a later transition (they stand as history, even after a reopen). Allowed transitions are a small, hardcoded, non-configurable rule in [`src/tickets/ticket-status.ts`](../src/tickets/ticket-status.ts) (`canTransitionTicketStatus`): closed is final (no transition out of it at all); resolved may move to reopened or closed; every other status may move freely among the non-closed states or into resolved, but never directly into closed.
- **Closed is final everywhere (Phase 7):** beyond blocking further status transitions, `src/tickets/ticket-service.ts` also rejects a new comment, a priority change, and a reassignment on a closed ticket (`assertNotClosed`) — enforced in the service layer itself, not only by hiding controls in the UI, so it holds even against a direct call.
- **Priority** (`ticket_priority` enum): `low`, `normal`, `urgent`, `critical`. Every new ticket defaults to `normal`; no SLA deadline is calculated from it yet (Phase 10).
- **Friendly labels (Phase 6):** [`src/tickets/labels.ts`](../src/tickets/labels.ts) maps each internal status/priority value to plain, staff-friendly text for display — `submitted` → "Received", `in_progress` → "In progress", `waiting_for_requester` → "Waiting for you", `resolved` → "Resolved", `reopened` → "Reopened", `closed` → "Closed" (priorities use their capitalized form, e.g. `urgent` → "Urgent"). This is a presentation-only mapping; the underlying enum values and transition rules above are unchanged. No requester-facing page renders a raw enum value.
- **Content limits:** `subject` and `description` must be non-blank (after trimming) and within a maximum length, enforced by `CHECK` constraints (`tickets_subject_not_blank_check`, `tickets_description_not_blank_check`) — the same limits the service layer validates before ever reaching the database (see [`src/tickets/limits.ts`](../src/tickets/limits.ts), the single source of truth both layers import from).
- **Organization-scoping composite foreign keys**, extending the same pattern used since Phase 4: `(department_id, organization_id)` → `departments`, `(category_id, department_id)` → `ticket_categories` (this is the database-level enforcement that a ticket's category belongs to its selected department), `(service_location_id, organization_id)` → `service_locations`, `(requester_id, organization_id)` → `user`, and `(assigned_agent_id, organization_id)` → `user` (skipped automatically by Postgres when a ticket is unassigned, since a NULL column in a composite foreign key means the constraint doesn't apply).

### `ticket_comments`

UUID primary key, `ticket_id` (FK, cascades on delete), `organization_id`, `author_id`, `body`, `created_at`.

- Ordinary shared conversation only — visible to the ticket's requester and any authorized department agent/administrator, the same audience as ticket access itself. No internal/private notes, attachments, editing, deletion, reactions, rich text, or email ingestion exist. The service layer exposes no update or delete function at all — comments are append-only by construction, not merely by convention.
- `body` must be non-blank and within a maximum length, enforced by a `CHECK` constraint mirroring the service layer's validation.
- A composite foreign key ties `(ticket_id, organization_id)` to `tickets(id, organization_id)`.

### `ticket_activity`

UUID primary key, `ticket_id` (FK, cascades on delete), `organization_id`, `acting_user_id`, `activity_type` (`created` | `status_changed` | `priority_changed` | `assignment_changed`), nullable `previous_value`/`new_value` (short, safe text — a status/priority string or an assignee's user id, never comment text or personal information), `created_at`.

- A single narrow, append-only log — not a generic audit platform. Only the four listed activity types are recorded.
- Every ticket mutation and its activity record are written inside the same database transaction, so a failed mutation can never leave an orphaned activity row.
- A composite foreign key ties `(ticket_id, organization_id)` to `tickets(id, organization_id)`.

### Ticket Service

`src/tickets/ticket-service.ts` exposes exactly seven functions: `createTicket`, `getTicket`, `listTicketsForActor`, `addTicketComment`, `updateTicketStatus`, `updateTicketPriority`, `assignTicket`. Every function takes an already-resolved `ResolvedActor` (never a raw request body) and enforces the Phase 4/5 authorization model before touching the database:

- The requester on a new ticket is always the actor themselves — `createTicket`'s input type has no field for a caller to name a different requester or organization.
- `getTicket` and `addTicketComment` require the `access_ticket` action (the requester's own ticket, or a department agent/administrator for the ticket's department). `getTicket` returns `null` uniformly whether the ticket doesn't exist or simply isn't accessible, so a caller can never learn which case occurred.
- `updateTicketStatus`, `updateTicketPriority`, and `assignTicket` require the stricter `manage_ticket` action — a department agent for the ticket's department, or a system administrator, but **never** the requester, even for their own ticket.
- `listTicketsForActor` scopes its query in SQL before returning anything (organization + ownership/department-membership conditions in the `WHERE` clause) — it never fetches every ticket and filters in application memory.
- `assignTicket` additionally verifies the proposed assignee is an active department-membership holder for the ticket's own department; an unrelated requester or a member of a different department is rejected before any write happens.

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

This runs `src/db/database-foundation.test.ts`, `src/db/tickets.test.ts`, and `src/db/admin.test.ts` against a completely fresh, in-memory PGlite instance: it applies the committed migrations, confirms only the thirteen approved tables exist (the three Phase 2 reference tables, the four Phase 3 authentication tables, the two Phase 4 access-control tables, and the four Phase 5 ticket tables — Phases 6, 7, and 8 add no new tables), runs the seed, verifies exact record counts and relationships (including that IT and Facilities are the only two departments, with exactly their 7 and 8 confirmed categories), reseeds to confirm idempotency, and confirms the database itself rejects duplicate codes, invalid foreign keys, invalid location-type structural combinations, duplicate department memberships, cross-organization memberships, a category/department mismatch, blank ticket/comment content, and every authentication invariant described in [`AUTHENTICATION.md`](AUTHENTICATION.md). It also confirms the seed creates no user, department membership, administrator, ticket, comment, or activity record, and exercises the full `ticket-service.ts` authorization surface (requester/department-agent/administrator access, cross-organization denial, status/priority/assignment rules, activity-history writes, and that a rejected mutation leaves no activity record behind), including the Phase 7 closed-ticket rule (a closed ticket rejects a new comment, a reassignment, and a priority change alike). It also exercises the Phase 6 read-only query layer (`src/tickets/ticket-queries.ts`) and the Phase 7 support query layer (`src/tickets/support-queries.ts`) — see the earlier phase notes below for exactly what each proves. It also exercises the Phase 8 administration module (`src/admin/`): that `listOrganizationUsers` is denied to anyone but an active system administrator, scopes strictly to the actor's own organization, sorts by name, supports a case-insensitive name/email search, and never selects a field beyond display name, email, active status, administrator status, and department codes; that `setDepartmentMembership` adds/removes access idempotently and rejects an invalid department code; that `setUserActive` deactivates/reactivates a target user, refuses to let an administrator deactivate themselves, and leaves that user's tickets and comments untouched; that a deactivated user's next `resolveActor()` call immediately returns `"inactive"`, failing both requester and support authorization; and that `setSystemAdministrator` grants/removes access while refusing to let an administrator remove their own. No external credentials or real database are involved — this is how a fresh clone proves the schema and seed work correctly, in CI and locally alike.

## Open Item

The **managed production PostgreSQL provider remains an open decision** (see [`DECISION_LOG.md`](DECISION_LOG.md)) — nothing here assumes or provisions one.

## Explicitly Not Included

Beyond the fixed Requester role (Phase 3), the minimal department/agent/administrator model (Phase 4), the core ticket foundation (Phase 5), the requester-facing interface (Phase 6), the IT/Facilities support workspace (Phase 7), and the minimal administration page (Phase 8), the database contains **no department-manager role, no campus/principal grant, no confidential-access grant, no expiring permission grant, no SLA/business-calendar calculation, and no internal/private-note visibility rule**. Phases 6, 7, and 8 added no new tables or columns — all three read and write the existing Phase 3–5 tables only, through authorization-scoped queries and services. A future phase will add requester-visible internal notes and a follower model on top of what exists here.
