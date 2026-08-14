# TEACH Ticket System — Deployment

This document is the sequential production setup order for the first real deployment. It is written for whoever performs that deployment; it does not perform any of these steps itself, and none of them have been performed by this repository's automated work. No production database, Google Cloud project, or Vercel environment variable exists yet (see [`DECISION_LOG.md`](DECISION_LOG.md) and [`PHASE_PLAN.md`](PHASE_PLAN.md)).

Complete these steps **in order**. Each one assumes the previous steps are done.

1. **Create a production PostgreSQL database.** Any managed PostgreSQL provider works — none is assumed by the schema or application code (see [`DATABASE.md`](DATABASE.md)). Record its connection string somewhere safe; do not paste it into this repository, a commit, a pull request, or an issue.

2. **Configure an administrative `DATABASE_MIGRATION_URL` locally**, in a git-ignored file (`.env.local`) or your shell environment — never in `.env.example` or source control. This is the same connection used by `db:migrate`, `db:seed`, and (later, in step 12) `admin:bootstrap`.

3. **Run migrations** against the production database:

   ```bash
   npm run db:migrate
   ```

4. **Run the reference-data seed:**

   ```bash
   npm run db:seed
   ```

5. **Verify the database state** — confirm the expected tables exist and the canonical reference data (one organization, three schools, six service locations, two departments and their categories) is present, matching [`DATABASE.md`](DATABASE.md). No department membership, ticket, or user should exist yet.

6. **Create a Google OAuth web client** in Google Cloud, scoped to the TEACH Workspace. Record the client ID and client secret; treat both as secrets.

7. **Configure the exact production callback URL** on that OAuth client: `<production-origin>/api/auth/callback/google`, where `<production-origin>` is the final production domain (e.g. `https://tickets.teachps.org`). This must match exactly — Better Auth compares it literally.

8. **Add the production environment variables in Vercel**: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the production origin, no path), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Do **not** add `DATABASE_MIGRATION_URL` to Vercel — see [Keeping `DATABASE_MIGRATION_URL` Operator-Only](#keeping-database_migration_url-operator-only) below.

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

`npm run readiness:check` inspects the running configuration without ever printing a secret value. It reports one of `ready`, `not configured`, or `invalid` for each of:

- **Database configuration** (`DATABASE_URL`) — present, a valid `postgres`/`postgresql` connection URL, not an example/placeholder value.
- **Authentication secret** (`BETTER_AUTH_SECRET`) — present, long enough, not an obvious placeholder.
- **Application origin** (`BETTER_AUTH_URL`) — present, a valid absolute origin with no path/query/fragment, `https` in production.
- **Google OAuth configuration** (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) — both present together, neither an obvious placeholder.

It exits nonzero if anything is missing or invalid. It is intentionally **not** part of `npm run check` — CI runs without production secrets by design, and this command is meant to be run against a real deployed environment instead. Run `npm run readiness:check -- --help` for full usage.

## First-Administrator Bootstrap

`npm run admin:bootstrap` designates an already-existing, active, TEACH-organization user as the first system administrator. It is the same "direct, separately approved database operation" that [`AUTHENTICATION.md`](AUTHENTICATION.md) and [`DATABASE.md`](DATABASE.md) describe as the only way the very first administrator can ever be created, now formalized as a guarded command rather than an ad hoc query. It:

- Connects using `DATABASE_MIGRATION_URL` — the same operator-only connection used for migrations and seeding, never a browser or client configuration.
- Never prints the database connection string or any credential.
- Defaults to a **dry run**: it describes what would change and makes no changes.
- Requires `--apply` together with a matching `--confirm-email` before making a real change.
- Accepts only an exact, normalized `@teachps.org` address — a personal or malformed email is rejected.
- Requires the target user to already exist from a successful Google Workspace sign-in, to be active, and to belong to the canonical TEACH organization — it never creates a user and never changes a user's organization.
- Is idempotent: running it again against an account that is already a system administrator makes no further change and is reported as such.
- Exits with a nonzero code on any failure.

Do not run this command against a real database outside of a deliberate deployment step like the one above.

## Keeping `DATABASE_MIGRATION_URL` Operator-Only

`DATABASE_MIGRATION_URL` is an administrative connection string — the same one used by `db:migrate`, `db:seed`, and `admin:bootstrap` — and it should remain something only an operator running these commands from their own machine (or a controlled deployment step) ever holds. Do not add it to Vercel's environment variables alongside the application's runtime configuration unless a later, separately approved deployment design specifically calls for it. The running application itself never needs it; only `DATABASE_URL` is required at runtime.

## What This Document Does Not Cover

This is a setup sequence, not a full operations runbook. It does not cover monitoring, backup scheduling, incident response, or scaling — those remain open items for a later phase (see [`PHASE_PLAN.md`](PHASE_PLAN.md)). It also does not include any real project credential, database URL, staff email address, or secret value — every example above is illustrative only.
