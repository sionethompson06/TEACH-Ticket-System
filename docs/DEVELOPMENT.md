# Local Development — TEACH Ticket System

This document covers local setup and day-to-day development commands, including the Phase 2 database foundation, Phase 3 authentication, the Phase 4 minimal access-control model, the Phase 5 core ticket foundation (categories, tickets, comments, activity, and the server-only ticket service), and the Phase 6 requester-facing experience (`/requests`, `/requests/new`, `/requests/[ticketNumber]`). It does not cover any department-agent workspace, department-manager roles, campus/principal grants, or confidential-access grants — none of that exists yet (see [`PHASE_PLAN.md`](PHASE_PLAN.md)).

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

All three routes require a valid signed-in session — an unauthenticated visitor is redirected to `/sign-in?callbackURL=...` and returns to the page they wanted after signing in. There is still no department-agent workspace, queue view, or admin page (Phase 7+).

### Request Help and Send Message Behavior

Both the Request Help form (`/requests/new`) and the Send Message form (on a ticket's detail page) use a Next.js Server Action (not a REST API route), and share the same behavior:

- The submit button disables itself and shows a pending label ("Submitting request…" / "Sending…") for the duration of the submission, preventing an accidental duplicate submission from a second click.
- A validation failure (e.g. a missing department or a blank message) returns field-level errors next to the relevant field, and every value the requester already entered is preserved — nothing is cleared or lost.
- On success, the Request Help form redirects to the new ticket's detail page with a friendly confirmation naming the formatted ticket number; the Send Message form clears itself and the conversation updates in place, both via `revalidatePath`.
- Neither form ever renders a field for requester identity, organization, priority, status, or assignee — those are always set by trusted server-side logic (the resolved actor and the Phase 5 ticket service's defaults), never accepted from form input.

### Accessibility Approach

The Phase 6 requester pages reuse the existing Tailwind-based visual system (no new UI framework) and follow the same approach as the Phase 3 sign-in/account pages:

- Every form field has a visible, associated `<label>`; every error message is linked to its field with `aria-describedby` and announced via `role="alert"`.
- Headings follow a logical order (page `<h1>`, section `<h2>`s) on every page, and interactive elements (links, buttons, radio/select inputs) are reachable and operable by keyboard alone, using the browser's native focus indicators.
- Status is never conveyed by color alone: the friendly status pill on My Requests and the ticket detail page carries its own text, and a support-team message carries a visible "Support Team" text label rather than relying on a background color to distinguish it from a requester's own message.
- Buttons and links are sized for comfortable touch targets, and there is no decorative animation, autoplay, or unnecessary motion.

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

The application remains intentionally minimal beyond sign-in, the Phase 4 access-control foundation, the Phase 5 ticket data model, and the Phase 6 requester experience. It contains no department-agent workspace or work queue, no assignment/status/priority controls, no internal notes, no admin pages, no SLA/business-calendar calculation, no email notifications, no attachments, no search or reporting, no department-manager role, and no confidential-access grant. A PostgreSQL schema and reference data exist (Phase 2), Google Workspace authentication and first-login provisioning exist (Phase 3, see [`docs/AUTHENTICATION.md`](AUTHENTICATION.md)), a minimal Requester/Department-Agent/System-Administrator model exists (Phase 4), a core ticket data model with a server-only ticket service exists (Phase 5, see [`docs/DATABASE.md`](DATABASE.md)), and a requester can sign in, request help, see My Requests, and send a message on their own ticket (Phase 6) — but no live production database or Google Cloud OAuth client has been provisioned as part of this repository's automated work, and no real user, department membership, administrator, ticket, or comment has been created. Later items are addressed in later, separately approved phases.

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
