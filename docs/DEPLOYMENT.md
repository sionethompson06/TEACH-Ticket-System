# TEACH Ticket System — Deployment

This document is the sequential production/pilot setup order for the first real deployment. It is written for whoever performs that deployment; it does not perform any of these steps itself, and none of them have been performed by this repository's automated work. No production database, Google Cloud project, or Vercel environment variable exists yet (see [`DECISION_LOG.md`](DECISION_LOG.md) and [`PHASE_PLAN.md`](PHASE_PLAN.md)).

Two authentication-access modes exist (Phase 9A — see [`AUTHENTICATION.md`](AUTHENTICATION.md)):

- **`invite_only`** — a controlled pilot: the owner and selected testers can use the completed application now, signing in with any verified Google account (a personal Gmail account, or an account from any Workspace domain), gated by a database invitation. **This is the path most first deployments should follow**, since it does not require TEACH Google Workspace or OAuth infrastructure to be ready yet.
- **`workspace`** — the strict, original mode: only a verified `@teachps.org` Google Workspace account may sign in. Use this once TEACH's own Google Workspace/OAuth infrastructure is ready.

Both paths share the same database setup. Complete these steps **in order**; each assumes the previous steps are done.

## Shared: Database Setup

1. **Create a production PostgreSQL database.** Any managed PostgreSQL provider works — none is assumed by the schema or application code (see [`DATABASE.md`](DATABASE.md)). Record its connection string somewhere safe; do not paste it into this repository, a commit, a pull request, or an issue.
2. **Configure an administrative `DATABASE_MIGRATION_URL` locally**, in a git-ignored file (`.env.local`) or your shell environment — never in `.env.example` or source control. This is the same connection used by `db:migrate`, `db:seed`, `admin:bootstrap`, and `access:invite`.
3. **Apply migrations:**
   ```bash
   npm run db:migrate
   ```
4. **Seed reference data:**
   ```bash
   npm run db:seed
   ```
5. **Verify the database state** — confirm the expected tables exist and the canonical reference data (one organization, three schools, six service locations, two departments and their categories) is present, matching [`DATABASE.md`](DATABASE.md). No department membership, invitation, ticket, or user should exist yet.

Then follow one of the two paths below, or — while Google OAuth infrastructure genuinely isn't ready yet — the temporary public-intake path described in [Temporary Public Ticket Intake](#temporary-public-ticket-intake-phase-9b) further down.

## Path A: Invite-Only Pilot Setup (recommended first deployment)

6. **Create a Google OAuth web client.** In this mode the client does not need to belong to a TEACH-owned Google Cloud project — an External OAuth client controlled outside TEACH Workspace works, since invited accounts are not required to belong to any particular domain. Record the client ID and client secret; treat both as secrets.
7. **Configure the exact production callback URL** on that OAuth client: `<production-origin>/api/auth/callback/google`, where `<production-origin>` is the final production domain. This must match exactly — Better Auth compares it literally.
8. **Add the production environment variables in Vercel**: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the production origin, no path), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `AUTH_ACCESS_MODE=invite_only`. Do **not** set `AUTH_ALLOWED_DOMAIN` in this mode. Do **not** add `DATABASE_MIGRATION_URL` to Vercel — see [Keeping `DATABASE_MIGRATION_URL` Operator-Only](#keeping-database_migration_url-operator-only) below.
9. **Deploy the verified commit** — the exact commit that was tested and reviewed, not an ad hoc branch.
10. **Run the readiness command** against the deployed configuration:
    ```bash
    npm run readiness:check
    ```
    Every line must read `ready`, including `Access mode`. See [Environment Readiness](#environment-readiness) below.
11. **Create the first invitation** for the intended owner's real Google account, using the guarded CLI. Start with a dry run, then apply:
    ```bash
    npm run access:invite -- --email person@example.com
    npm run access:invite -- --email person@example.com --confirm-email person@example.com --apply
    ```
    See [Pilot Invitations](#pilot-invitations) below.
12. **Sign in with that Google account**, through the deployed application's normal sign-in flow. This creates a Requester profile and marks the invitation accepted — sign-in alone never grants administrator or department-agent access.
13. **Run the guarded administrator-bootstrap command** to designate that same account as the first system administrator. Start with a dry run, then apply:
    ```bash
    npm run admin:bootstrap -- --email person@example.com
    npm run admin:bootstrap -- --email person@example.com --confirm-email person@example.com --apply
    ```
    See [First-Administrator Bootstrap](#first-administrator-bootstrap) below.
14. **Sign out and sign back in**, so the new administrator flag is reflected in a fresh session.
15. **Use `/admin`** to invite each selected tester (Pilot Invitations section) and, once a tester has signed in, assign IT and/or Facilities department-agent access (People and Access section).
16. **Complete the pilot checklist** — [`PILOT_CHECKLIST.md`](PILOT_CHECKLIST.md) — before treating the deployment as ready for real (non-fictional) requests.

## Path B: TEACH Workspace Setup

6. **Create a Google OAuth web client** in Google Cloud, scoped to the TEACH Workspace. Record the client ID and client secret; treat both as secrets.
7. **Configure the exact production callback URL** on that OAuth client: `<production-origin>/api/auth/callback/google`. This must match exactly — Better Auth compares it literally.
8. **Add the production environment variables in Vercel**: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the production origin, no path), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_ACCESS_MODE=workspace`, and `AUTH_ALLOWED_DOMAIN=teachps.org`. Do **not** add `DATABASE_MIGRATION_URL` to Vercel — see [Keeping `DATABASE_MIGRATION_URL` Operator-Only](#keeping-database_migration_url-operator-only) below.
9. **Deploy the verified commit** — the exact commit that was tested and reviewed, not an ad hoc branch.
10. **Run the readiness command** against the deployed configuration to confirm every value is structurally valid before anyone signs in:
    ```bash
    npm run readiness:check
    ```
    Every line must read `ready`. See [Environment Readiness](#environment-readiness) below for what it checks.
11. **Sign in once** with the intended first administrator's real TEACH Google Workspace account, through the deployed application's normal sign-in flow. This creates their Requester profile — sign-in alone never grants administrator or department-agent access (see [`AUTHENTICATION.md`](AUTHENTICATION.md)).
12. **Run the guarded administrator-bootstrap command** to designate that same account as the first system administrator. Start with a dry run, then apply:
    ```bash
    npm run admin:bootstrap -- --email administrator@teachps.org
    npm run admin:bootstrap -- --email administrator@teachps.org --confirm-email administrator@teachps.org --apply
    ```
    See [First-Administrator Bootstrap](#first-administrator-bootstrap) below for the full safeguards.
13. **Sign out and sign back in** with that same account, so the new administrator flag is reflected in a fresh session.
14. **Use `/admin`** to assign IT and Facilities department-agent access to the appropriate staff accounts, once each has signed in at least once.
15. **Complete the pilot checklist** — [`PILOT_CHECKLIST.md`](PILOT_CHECKLIST.md) — before treating the deployment as ready for real (non-fictional) requests.

## Environment Readiness

`npm run readiness:check` inspects the running configuration without ever printing a secret value or a configured domain. It reports one of `ready`, `not configured`, or `invalid` for each of:

- **Database configuration** (`DATABASE_URL`) — present, a valid `postgres`/`postgresql` connection URL, not an example/placeholder value.
- **Authentication secret** (`BETTER_AUTH_SECRET`) — present, long enough, not an obvious placeholder.
- **Application origin** (`BETTER_AUTH_URL`) — present, a valid absolute origin with no path/query/fragment, `https` in production.
- **Google OAuth configuration** (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) — both present together, neither an obvious placeholder.
- **Access mode** (`AUTH_ACCESS_MODE` / `AUTH_ALLOWED_DOMAIN`) — a valid mode is set; in workspace mode, `AUTH_ALLOWED_DOMAIN` is additionally required and must be a plausible domain. Invite-only mode reports ready without any domain configured, and its detail line states that database invitations control access.
- **Public ticket intake** (`PUBLIC_TICKET_INTAKE` / `PUBLIC_INTAKE_RATE_LIMIT_SECRET`) — reports "not configured" whenever the flag isn't exactly `true` (the normal state for an ordinary authenticated deployment); once enabled, `PUBLIC_INTAKE_RATE_LIMIT_SECRET` must also be present, at least 32 characters, and not an obvious placeholder.

Overall readiness requires the database/secret/origin items plus **either** Google OAuth + Access mode both ready **or** Public ticket intake ready — not necessarily every item. A deployment can be fully ready with Google OAuth left unconfigured, as long as public intake is properly configured instead (see [Temporary Public Ticket Intake](#temporary-public-ticket-intake-phase-9b)). It exits nonzero if overall readiness isn't met. It is intentionally **not** part of `npm run check` — CI runs without production secrets by design, and this command is meant to be run against a real deployed environment instead. Run `npm run readiness:check -- --help` for full usage.

## Temporary Public Ticket Intake (Phase 9B)

Use this path when Google OAuth infrastructure genuinely isn't ready yet but real IT/Facilities requests still need to come in. It does **not** replace Path A/B above — staff sign-in, Support Queue, and Administration still require Google OAuth to be configured, either now or later. See [`AUTHENTICATION.md`](AUTHENTICATION.md) for the full security model.

1. **Complete [Shared: Database Setup](#shared-database-setup) above.** `seedReferenceData()` (`npm run db:seed`) creates the reserved, inactive Public Intake system user that every public submission is attributed to — this step is required even though no Google OAuth client exists yet.
2. **Generate a separate rate-limit secret**, distinct from `BETTER_AUTH_SECRET` (e.g. `openssl rand -base64 32`). Treat it as a secret.
3. **Add the production environment variables in Vercel**: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `PUBLIC_TICKET_INTAKE=true`, and `PUBLIC_INTAKE_RATE_LIMIT_SECRET=<the secret generated above>`. Leave `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `AUTH_ACCESS_MODE` unset for now — they are not required in this mode.
4. **Deploy the verified commit.**
5. **Run the readiness command** against the deployed configuration:
   ```bash
   npm run readiness:check
   ```
   `Public ticket intake` must read `ready`; `Google OAuth configuration` and `Access mode` are expected to read `not configured` — that combination is still overall `ready` (see [Environment Readiness](#environment-readiness) above).
6. **Confirm the public flow end-to-end**: the home page shows a "Submit a ticket" call to action with sign-in described as temporarily unavailable; `/requests/new` renders the public form for a signed-out visitor; a fictional submission reaches the confirmation page showing only a ticket number; `/requests`, `/support`, `/admin`, and `/account` still redirect to sign-in exactly as before.
7. **When Google OAuth infrastructure becomes ready**, follow Path A or B above to configure it — public intake can stay on during the transition (an already-signed-in actor always sees the normal authenticated form) or be turned off immediately by setting `PUBLIC_TICKET_INTAKE=false` and redeploying.

**Rollback:** set `PUBLIC_TICKET_INTAKE=false` (or remove it) and redeploy. This alone restores today's exact behavior — `/requests/new` requires an active authenticated actor again, and the home page reverts to its normal sign-in messaging. No data needs to be deleted or migrated to roll back; existing public tickets remain in place, correctly attributed to the reserved Public Intake user, and remain visible to support staff once they sign in.

## Pilot Invitations

`npm run access:invite` (invite-only mode only) creates a pilot invitation — a database row that lets one specific email sign in once with any verified Google account. It:

- Connects using `DATABASE_MIGRATION_URL`, same as the migration/seed/bootstrap commands.
- Requires `AUTH_ACCESS_MODE=invite_only` in the current environment.
- Never prints the database connection string or any credential.
- Defaults to a **dry run**: it describes what would happen and makes no changes.
- Requires `--apply` together with a matching `--confirm-email` before making a real change.
- Never creates a user and never grants agent or administrator access — accepting an invitation only allows a first sign-in to provision a plain requester.
- Is idempotent: re-running it against an already-pending or already-accepted address makes no change; against a previously revoked address it creates a fresh invitation rather than reactivating the old one.

Once an administrator exists, `/admin`'s Pilot Invitations section (visible only in invite-only mode) can also create, list, and revoke invitations — see [`AUTHENTICATION.md`](AUTHENTICATION.md). No invitation email is ever sent by either path; tell the invited person directly to visit the sign-in page.

## First-Administrator Bootstrap

`npm run admin:bootstrap` designates an already-existing, active user as the first system administrator. It is the same "direct, separately approved database operation" that [`AUTHENTICATION.md`](AUTHENTICATION.md) and [`DATABASE.md`](DATABASE.md) describe as the only way the very first administrator can ever be created, now formalized as a guarded command rather than an ad hoc query. It:

- Connects using `DATABASE_MIGRATION_URL` — the same operator-only connection used for migrations, seeding, and invitations, never a browser or client configuration.
- Never prints the database connection string or any credential.
- Defaults to a **dry run**: it describes what would change and makes no changes.
- Requires `--apply` together with a matching `--confirm-email` before making a real change.
- Requires the target user to already exist from a successful Google sign-in, to be active, and to belong to the canonical TEACH organization — it never creates a user and never changes a user's organization.
- **Eligibility depends on the active access mode:** in workspace mode, the target must have an exact `@AUTH_ALLOWED_DOMAIN` address; in invite-only mode, the target must have a linked Google account and an accepted pilot invitation, and no particular email domain is required.
- Is idempotent: running it again against an account that is already a system administrator makes no further change and is reported as such.
- Exits with a nonzero code on any failure.

Do not run this command against a real database outside of a deliberate deployment step like the ones above.

## Keeping `DATABASE_MIGRATION_URL` Operator-Only

`DATABASE_MIGRATION_URL` is an administrative connection string — the same one used by `db:migrate`, `db:seed`, `admin:bootstrap`, and `access:invite` — and it should remain something only an operator running these commands from their own machine (or a controlled deployment step) ever holds. Do not add it to Vercel's environment variables alongside the application's runtime configuration unless a later, separately approved deployment design specifically calls for it. The running application itself never needs it; only `DATABASE_URL` is required at runtime.

## Switching Modes Later

Moving from invite-only to workspace mode (once TEACH Workspace/OAuth infrastructure is ready) is a configuration change, not a data migration: update `AUTH_ACCESS_MODE`/`AUTH_ALLOWED_DOMAIN` and the Google OAuth client, then redeploy. Existing users, tickets, and administrator/agent access are untouched — only future sign-ins are affected. The reverse (workspace back to invite-only) works the same way. Invitation history is preserved either way; it is simply unused while workspace mode is active.

## What This Document Does Not Cover

This is a setup sequence, not a full operations runbook. It does not cover monitoring, backup scheduling, incident response, or scaling — those remain open items for a later phase (see [`PHASE_PLAN.md`](PHASE_PLAN.md)). It also does not include any real project credential, database URL, staff email address, or secret value — every example above is illustrative only.
