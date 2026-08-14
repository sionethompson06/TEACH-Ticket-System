# Local Development — TEACH Ticket System

This document covers local setup and day-to-day development commands, including the Phase 2 database foundation, Phase 3 authentication, the Phase 4 minimal access-control model, the Phase 5 core ticket foundation (categories, tickets, comments, activity, and the server-only ticket service), the Phase 6 requester-facing experience (`/requests`, `/requests/new`, `/requests/[ticketNumber]`), and the Phase 7 IT/Facilities support workspace (`/support`, `/support/[ticketNumber]`). It does not cover department-manager roles, campus/principal grants, confidential-access grants, dashboards, or SLA calculations — none of that exists yet (see [`PHASE_PLAN.md`](PHASE_PLAN.md)).

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

Both require an active user with at least one department membership or system-administrator status — an ordinary requester gets a safe access-denied message at `/support` and a generic not-found page at `/support/[ticketNumber]`, and never sees the Support Queue link at all. There is still no dashboard, SLA timer, internal-notes feature, or admin configuration page (Phase 8+).

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

### Accessibility Approach

The Phase 6/7 pages reuse the existing Tailwind-based visual system (no new UI framework) and follow the same approach as the Phase 3 sign-in/account pages:

- Every form field has a visible, associated `<label>`; every error message is linked to its field with `aria-describedby` and announced via `role="alert"`.
- Headings follow a logical order (page `<h1>`, section `<h2>`s) on every page, and interactive elements (links, buttons, radio/select inputs, filter forms) are reachable and operable by keyboard alone, using the browser's native focus indicators.
- Status is never conveyed by color alone: the friendly status pill on My Requests, the requester ticket page, and the support queue/workspace all carry their own text, and a support-team message carries a visible "Support Team" text label (a requester's own message is labeled "Requester" on the support side) rather than relying on a background color to distinguish participants.
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

## Production Build and Local Start

```bash
npm run build
npm run start
```

`npm run build` produces an optimized production build; `npm run start` serves that build locally (also on port 3000 by default). Use `npm run dev` for day-to-day development instead.

## Environment Files

- `.env.example` is tracked in the repository and documents environment-variable names and safe placeholders only.
- Phase 2 introduces `DATABASE_URL` and `DATABASE_MIGRATION_URL`; Phase 3 introduces `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` — all as documented placeholders only. None is required to build, test, or preview the application (see [`docs/DATABASE.md`](DATABASE.md) and [`docs/AUTHENTICATION.md`](AUTHENTICATION.md)); sign-in itself renders a safe "configuration pending" notice when they are absent, instead of erroring.
- Real values belong in a local, git-ignored file (e.g. `.env`, `.env.local`) or in managed deployment secrets — never in `.env.example` and never committed to source control.
- **Never commit real credentials, tokens, keys, connection strings, OAuth client secrets, or other secrets under any filename.**

## What This Repository Does Not Yet Include

The application remains intentionally minimal beyond sign-in, the Phase 4 access-control foundation, the Phase 5 ticket data model, the Phase 6 requester experience, and the Phase 7 support workspace. It contains no dashboards, charts, saved views, search, bulk actions, SLA/business-calendar calculation, internal/private notes, attachments, admin configuration pages, email/chat notifications, department-manager role, or confidential-access grant. A PostgreSQL schema and reference data exist (Phase 2), Google Workspace authentication and first-login provisioning exist (Phase 3, see [`docs/AUTHENTICATION.md`](AUTHENTICATION.md)), a minimal Requester/Department-Agent/System-Administrator model exists (Phase 4), a core ticket data model with a server-only ticket service exists (Phase 5, see [`docs/DATABASE.md`](DATABASE.md)), a requester can sign in, request help, see My Requests, and send a message on their own ticket (Phase 6), and a department agent or system administrator can see their department's queue, open a ticket, reply, assign it, and change its status and priority (Phase 7) — but no live production database or Google Cloud OAuth client has been provisioned as part of this repository's automated work, and no real user, department membership, administrator, ticket, or comment has been created. Later items are addressed in later, separately approved phases.

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
