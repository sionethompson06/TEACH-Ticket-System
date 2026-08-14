# Local Development — TEACH Ticket System

This document covers local setup and day-to-day development commands, including the Phase 2 database foundation, Phase 3 authentication, the Phase 4 minimal access-control model, the Phase 5 core ticket foundation (categories, tickets, comments, activity, and the server-only ticket service), the Phase 6 requester-facing experience (`/requests`, `/requests/new`, `/requests/[ticketNumber]`), the Phase 7 IT/Facilities support workspace (`/support`, `/support/[ticketNumber]`), and the Phase 8 minimal administration page (`/admin`). It does not cover department-manager roles, campus/principal grants, confidential-access grants, dashboards, notifications, or SLA calculations — none of that exists yet (see [`PHASE_PLAN.md`](PHASE_PLAN.md)).

## Prerequisites

- **Node.js 24 (LTS)** — the version pinned in [`.nvmrc`](../.nvmrc) and declared in `package.json`'s `engines` field. If you use [nvm](https://github.com/nvm-sh/nvm), running `nvm use` in the repository root will select the correct version automatically.
- **npm** (ships with Node.js) — this project uses npm exclusively. Do not use Yarn, pnpm, or Bun; only one lockfile (`package-lock.json`) is maintained.

## Initial Setup

```bash
npm ci
```

`npm ci` installs exactly what is recorded in `package-lock.json`. Use it instead of `npm install` for a clean, reproducible install (including in CI).

## Local Development

```bash
npm run dev
```

The app starts at **http://localhost:3000**. The root route (`/`) renders a static application-status page linking to `/sign-in` when Google Workspace authentication is configured (see [`docs/AUTHENTICATION.md`](AUTHENTICATION.md)). Once signed in, a staff member lands on the requester experience:

| Route                      | Purpose                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/requests`                | **My Requests** — the signed-in user's own tickets only, most recently updated first.                     |
| `/requests/new`            | **Request Help** — a single-page form (department, category, location, subject, description).             |
| `/requests/[ticketNumber]` | Ticket detail and conversation (e.g. `/requests/TKT-000001`), with a **Send Message** form at the bottom. |

All three routes require a valid signed-in session — an unauthenticated visitor is redirected to `/sign-in?callbackURL=...` and returns to the page they wanted after signing in.

A department agent (IT or Facilities) or system administrator additionally sees a **Support Queue** link and has access to:

| Route                     | Purpose                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/support`                | **Support Queue** — active tickets for the agent's own department(s), with Department/Location/Status/Assignment filters. |
| `/support/[ticketNumber]` | The support workspace for one ticket: details, conversation, reply, assignment, status, priority, and activity history.   |

Both require an active user with at least one department membership or system-administrator status — an ordinary requester gets a safe access-denied message at `/support` and a generic not-found page at `/support/[ticketNumber]`, and never sees the Support Queue link at all.

A system administrator additionally sees an **Administration** link and has access to:

| Route    | Purpose                                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `/admin` | **People and Access** — activate/deactivate staff, grant/remove IT or Facilities agent access, grant/remove administrator access. |

This requires an active system administrator specifically — an ordinary requester or a department agent who is not also an administrator gets the same safe access-denied message, whether they follow a link or type the URL directly, and never sees the Administration link at all. There is still no dashboard, SLA timer, internal-notes feature, or category/location/department administration (Phase 9+).

### Request Help and Send Message Behavior

Both the Request Help form (`/requests/new`) and the Send Message form (on a ticket's detail page) use a Next.js Server Action (not a REST API route), and share the same behavior:

- The submit button disables itself and shows a pending label ("Submitting request…" / "Sending…") for the duration of the submission, preventing an accidental duplicate submission from a second click.
- A validation failure (e.g. a missing department or a blank message) returns field-level errors next to the relevant field, and every value the requester already entered is preserved — nothing is cleared or lost.
- On success, the Request Help form redirects to the new ticket's detail page with a friendly confirmation naming the formatted ticket number; the Send Message form clears itself and the conversation updates in place, both via `revalidatePath`.
- Neither form ever renders a field for requester identity, organization, priority, status, or assignee — those are always set by trusted server-side logic (the resolved actor and the Phase 5 ticket service's defaults), never accepted from form input.

### Support Workspace Behavior (Phase 7)

The support queue's Department/Location/Status/Assignment filters are plain `GET` form fields — no client-side JavaScript is required, so the current filters live entirely in the URL's query string, are bookmarkable, and survive a page refresh. Every filter value is re-validated server-side in `src/tickets/support-queries.ts` against the agent's own authorized departments and the documented status/assignment sets; an invalid or unauthorized value is silently ignored (falling back to its default) rather than erroring. By default only active tickets (Received, Reopened, In progress, Waiting for you) appear, ordered by priority then age — resolved and closed tickets only appear when explicitly filtered in.

The three support controls (assignment, status, priority) are small, separate Server Action forms, following the same pending-state/duplicate-submission-prevention/friendly-error pattern as the Request Help and Send Message forms, and each revalidates the support queue, the support workspace, the requester's My Requests list, and the requester's own ticket detail page on success — so a change is visible everywhere immediately:

- **Assignment** offers a one-click "Assign to me" (which never reads a client-supplied user id — it always uses the resolved actor's own id) and a general assignee `<select>` populated only with active agents of the ticket's own department, plus "Unassigned." `assignTicket()` in the ticket service re-validates the selected id regardless.
- **Status** only ever offers the valid next statuses for the ticket's current status, computed from the existing `canTransitionTicketStatus` rule (`src/tickets/ticket-status.ts`) — closed remains final; no arbitrary value reaches the service.
- **Priority** offers every documented priority except the ticket's current one, with a persistent reminder that an active emergency must still follow TEACH emergency procedures, not this form alone.

A closed ticket hides all three controls and the Send Message form, on both `/support/[ticketNumber]` and the requester's own `/requests/[ticketNumber]`, replaced by a plain "this request is closed" message — and the same rule is enforced independently in the ticket service (`addTicketComment`, `updateTicketPriority`, and `assignTicket` all reject a closed ticket), so it holds even if a UI control were ever mistakenly left enabled.

### Administration Behavior (Phase 8)

`/admin` lists every user in the canonical organization — display name, email, active/inactive status, requester status (always "yes" — the fixed base role from Phase 3), IT agent access, Facilities agent access, and system-administrator status — sorted by name, capped at 200 results, with one optional server-side search field matching name or email. No provider account id, Google subject, session data, token, or other authentication metadata is ever selected from the database for this page, so none of it can leak into the UI by accident.

Each row offers up to four small Server Action buttons, one per attribute, each showing only the direction that currently applies (e.g. a user without IT access sees "Add IT Access"; a user who already has it sees "Remove IT Access" instead of both at once):

- **Add/Remove IT Access** and **Add/Remove Facilities Access** add or remove a `department_memberships` row — department membership already _is_ department-agent access; there is no separate "agent role" to manage. Adding an existing membership or removing a missing one are both safe no-ops.
- **Activate User** / **Deactivate User** flips the same `is_active` flag every existing active-actor check already reads — a deactivated user fails their very next request on both the requester and support sides, but their account, tickets, and comments are never deleted.
- **Grant Admin Access** / **Remove Admin Access** flips `is_system_administrator`. An administrator can never deactivate their own account or remove their own administrator access — both buttons are hidden for the acting administrator's own row, and the same rule is enforced in `src/admin/admin-service.ts` itself, not only in the UI.

Deactivating a user and granting or removing administrator access all require a native confirmation (`window.confirm`) before submitting, since these are the actions most consequential to undo quickly; adding/removing department access and activating a user do not. Every button follows the same pending-state/disabled-while-submitting/friendly-error pattern as the rest of the app, and a successful mutation revalidates `/admin`, `/support`, and `/requests` together, since a membership or activation change can immediately change what those pages show.

Building `/admin` grants no one administrator access on its own: the first real system administrator's designation remains a separately approved, manual database operation, exactly as already documented for Phase 3/4 (see [`docs/AUTHENTICATION.md`](AUTHENTICATION.md)).

### Accessibility Approach

The Phase 6/7/8 pages reuse the existing Tailwind-based visual system (no new UI framework) and follow the same approach as the Phase 3 sign-in/account pages:

- Every form field has a visible, associated `<label>`; every error message is linked to its field with `aria-describedby` and announced via `role="alert"`, and every admin-action success message is announced via `role="status"`.
- Headings follow a logical order (page `<h1>`, section `<h2>`s) on every page, and interactive elements (links, buttons, radio/select inputs, filter and search forms) are reachable and operable by keyboard alone, using the browser's native focus indicators — no page sets `outline: none` or otherwise removes them.
- Status is never conveyed by color alone: the friendly status pill on My Requests, the requester ticket page, and the support queue/workspace all carry their own text, a support-team message carries a visible "Support Team" text label (a requester's own message is labeled "Requester" on the support side) rather than relying on a background color to distinguish participants, and the People and Access badges ("Active"/"Inactive," "IT agent"/"No IT access," and so on) are plain bordered text with no color coding at all.
- The shared navigation (`src/app/app-nav.tsx`) uses one consistent label style (Title Case) for every item, and shows Support Queue and Administration only to the roles that can use them, so a requester's navigation stays uncluttered.
- Buttons and links are sized for comfortable touch targets, and there is no decorative animation, autoplay, or unnecessary motion — the support queue is a practical work list, not a dashboard.

## Quality Commands

| Command                | Purpose                                                                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`         | Run ESLint.                                                                                                                                                 |
| `npm run typecheck`    | Run the TypeScript compiler in check-only mode (`tsc --noEmit`).                                                                                            |
| `npm test`             | Run the Vitest suite once (non-watch).                                                                                                                      |
| `npm run test:watch`   | Run Vitest in watch mode while developing.                                                                                                                  |
| `npm run format`       | Apply Prettier formatting to the repository.                                                                                                                |
| `npm run format:check` | Verify formatting without writing changes.                                                                                                                  |
| `npm run check`        | Run, in order: format check → lint → typecheck → migration-consistency check → tests → database integration tests. This is the single command CI relies on. |

## Database Commands

See [`docs/DATABASE.md`](DATABASE.md) for the full database foundation (schema, provider-neutral approach, canonical reference data). Quick reference:

| Command               | Purpose                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| `npm run db:generate` | Generate a new versioned SQL migration from the Drizzle schema.                                      |
| `npm run db:check`    | Validate migration-folder consistency. Runs offline — no database connection needed.                 |
| `npm run db:migrate`  | Apply committed migrations to the database configured via `DATABASE_MIGRATION_URL`/`DATABASE_URL`.   |
| `npm run db:seed`     | Apply canonical reference data transactionally and idempotently.                                     |
| `npm run db:setup`    | Run `db:migrate` then `db:seed`.                                                                     |
| `npm run db:verify`   | Run the database integration tests against a fresh in-memory PGlite database. No credentials needed. |

**Safety rules:**

- Migrations and seeds are explicit, administrative commands only — never run automatically during `npm install`, `npm run build`, `npm run start`, module import, or a Vercel deployment.
- Neither `DATABASE_URL` nor `DATABASE_MIGRATION_URL` is required to build, test, or preview the application — only `db:migrate` and `db:seed` read them, and both fail immediately with a concise error (never printing the value) if neither is set.
- Take a backup before running migrations against any database containing real data.
- PGlite (used by `db:verify`) is a fully in-memory, test-only database — it is never the production database choice and never persists anything to disk.

## Release Readiness Commands (Phase 9/9A)

See [`docs/DEPLOYMENT.md`](DEPLOYMENT.md) for the full sequential production/pilot setup order these commands are part of.

| Command                   | Purpose                                                                                                                                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run readiness:check` | Inspect the running environment configuration and print a `ready`/`not configured`/`invalid` checklist. Never prints a secret or domain value. Deliberately **not** part of `npm run check` — CI runs without production secrets.                         |
| `npm run admin:bootstrap` | Guarded first-system-administrator designation. Defaults to a dry run; requires `--apply` with a matching `--confirm-email` to make a real change. Never creates a user or changes an organization. Eligibility depends on the active `AUTH_ACCESS_MODE`. |
| `npm run access:invite`   | (Phase 9A, invite_only mode only) Guarded pilot-invitation creation. Defaults to a dry run; requires `--apply` with a matching `--confirm-email`. Never creates a user or grants agent/administrator access.                                              |

None of these commands is run against a real database as part of this repository's automated work; all three are exercised only against fake configuration objects and a synthetic (PGlite) database in the test suite.

## Two Authentication-Access Modes (Phase 9A)

`AUTH_ACCESS_MODE` selects `invite_only` (a controlled pilot — any verified Google account may sign in once invited) or `workspace` (the strict original mode — only `@teachps.org` Google Workspace accounts). See [`docs/AUTHENTICATION.md`](AUTHENTICATION.md) for the full design and [`docs/DEPLOYMENT.md`](DEPLOYMENT.md) for the setup sequence for each. A missing or invalid value leaves authentication unavailable — there is no permissive default.

The `/admin` "Pilot Invitations" section (create/list/revoke pilot invitations) is visible only while `AUTH_ACCESS_MODE=invite_only`, alongside the existing "People and Access" section (unchanged, both modes).

## Friendly Failure Handling (Phase 9)

Beyond the accessibility approach above, every unexpected or unavailable-service state shows plain language and a useful next action, using the shared `FriendlyState` component (`src/components/friendly-state.tsx`):

- `src/app/error.tsx` catches any unexpected error from a nested page or layout (including a database-connection failure) with one generic message and a "Try Again"/"Return Home" action — it never renders the underlying error's message or stack.
- `src/app/global-error.tsx` is the fallback if the root layout itself fails, and renders its own complete `<html>`/`<body>` rather than relying on the layout that just failed.
- `src/app/not-found.tsx` handles any unmatched URL app-wide; the existing ticket-specific `not-found.tsx` pages under `/requests/[ticketNumber]` and `/support/[ticketNumber]` take precedence within their own segment.
- The existing `/support` and `/admin` access-denied blocks now reuse the same shared component, rather than near-duplicate inline JSX.

None of this changes what any page is authorized to show — it only changes how a failure or an empty/denied state is presented.

## Production Build and Local Start

```bash
npm run build
npm run start
```

`npm run build` produces an optimized production build; `npm run start` serves that build locally (also on port 3000 by default). Use `npm run dev` for day-to-day development instead.

## Environment Files

- `.env.example` is tracked in the repository and documents environment-variable names and safe placeholders only.
- Phase 2 introduces `DATABASE_URL` and `DATABASE_MIGRATION_URL`; Phase 3 introduces `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`; Phase 9A introduces `AUTH_ACCESS_MODE` and (workspace mode only) `AUTH_ALLOWED_DOMAIN` — all as documented placeholders only. None is required to build, test, or preview the application (see [`docs/DATABASE.md`](DATABASE.md) and [`docs/AUTHENTICATION.md`](AUTHENTICATION.md)); sign-in itself renders a safe "configuration pending" notice when they are absent, instead of erroring.
- Real values belong in a local, git-ignored file (e.g. `.env`, `.env.local`) or in managed deployment secrets — never in `.env.example` and never committed to source control.
- **Never commit real credentials, tokens, keys, connection strings, OAuth client secrets, or other secrets under any filename.**

## What This Repository Does Not Yet Include

The application remains intentionally minimal beyond sign-in, the Phase 4 access-control foundation, the Phase 5 ticket data model, the Phase 6 requester experience, the Phase 7 support workspace, and the Phase 8 minimal administration page. It contains no dashboards, charts, saved views, bulk actions, SLA/business-calendar calculation, internal/private notes, attachments, category/location/department administration, custom fields or workflow configuration, email/chat/Slack/SMS notifications, webhooks, background jobs, department-manager role, or confidential-access grant. A PostgreSQL schema and reference data exist (Phase 2), Google Workspace authentication and first-login provisioning exist (Phase 3, see [`docs/AUTHENTICATION.md`](AUTHENTICATION.md)), a minimal Requester/Department-Agent/System-Administrator model exists (Phase 4), a core ticket data model with a server-only ticket service exists (Phase 5, see [`docs/DATABASE.md`](DATABASE.md)), a requester can sign in, request help, see My Requests, and send a message on their own ticket (Phase 6), a department agent or system administrator can see their department's queue, open a ticket, reply, assign it, and change its status and priority (Phase 7), a system administrator can activate/deactivate staff and manage IT/Facilities agent and administrator access at `/admin` (Phase 8), the application has friendly failure/empty/access-denied states, a safe environment-readiness command, and a guarded first-administrator bootstrap command (Phase 9), and the application now supports two configurable authentication-access modes — a controlled `invite_only` pilot mode alongside the original strict `workspace` mode — with a guarded invitation-creation command and an `/admin` Pilot Invitations section (Phase 9A, see [`docs/AUTHENTICATION.md`](AUTHENTICATION.md) and [`docs/DEPLOYMENT.md`](DEPLOYMENT.md)) — but no live production database, Google Cloud OAuth client, or Vercel environment variable has been provisioned as part of this repository's automated work, and no real user, invitation, department membership, administrator, ticket, or comment has been created, seeded, or added. Later items are addressed in later, separately approved phases.

## Continuous Integration

Every push and pull request runs the [`quality`](../.github/workflows/quality.yml) GitHub Actions workflow, which performs (on Ubuntu, Node.js 24):

1. `npm ci`
2. `npm run check` (format check, lint, typecheck, migration-consistency check, tests, database integration tests)
3. `npm run build`

No database secrets are required — `db:check` runs offline and `db:verify` uses an in-memory PGlite database.

The workflow uses read-only repository contents permission, no repository secrets, and does not deploy anything.

## Troubleshooting: Node Version Mismatches

If `npm run dev`, `npm ci`, or the test/build commands behave unexpectedly, first confirm your active Node version matches the pinned version:

```bash
node --version   # should match the major version in .nvmrc
```

If it doesn't match and you use nvm, run `nvm install` followed by `nvm use` from the repository root. Mismatched Node major versions are the most common cause of otherwise-unexplained install or build failures in this project.
