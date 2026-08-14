# TEACH Ticket System — Authentication and First-Login Provisioning

This document covers the Phase 3 authentication foundation: Google Workspace sign-in, the identity-verification rules the server enforces before issuing a session, session/cookie handling, and first-login user provisioning. It does not cover role/permission enforcement beyond the default Requester role, department membership, or ticket functionality — none of that exists yet (see [`PHASE_PLAN.md`](PHASE_PLAN.md)).

## Summary

Staff sign in with their **Google Workspace account**. The server verifies the identity Google asserts and only issues a session if every check below passes. On a verified staff member's first sign-in, the server creates exactly one profile: the canonical TEACH organization and the fixed **Requester** base role. No other role, department, or ticket data is created or assumed.

## Library and Versions

- **[Better Auth](https://www.better-auth.com/)** `1.6.27` (pinned) — session/cookie management, the OAuth/OIDC authorization-code + PKCE flow with Google, and CSRF protection. Authentication is never hand-rolled: no custom JWT, OAuth, session, or CSRF code exists in this repository.
- **`@better-auth/drizzle-adapter`** `1.6.27` (pinned) — persists Better Auth's user/account/session/verification records through the project's existing Drizzle ORM setup, using database-generated UUIDs (Postgres `gen_random_uuid()`), not application-generated IDs.
- Both packages are pinned to the exact stable `1.6.27` release — no `1.7` beta/RC/pre-release version is used.

## Identity Verification (Enforced Before Any Session Is Issued)

Google Sign-In alone does not grant access. Every one of the following checks must pass, in [`src/auth/google-identity-policy.ts`](../src/auth/google-identity-policy.ts), a small, pure, framework-agnostic policy module with no dependency on Better Auth, Next.js, or a database:

1. **Subject (`sub`) present.** Google's immutable, per-account subject identifier must be a non-empty string. This — never the email address — is the identity anchor stored against the account record, because an email address can change but `sub` cannot.
2. **Email present and well-formed.**
3. **`email_verified` is strictly `true`.** Compared with `!== true`, never a truthy check — a string `"true"` or any other truthy-but-not-boolean value is rejected.
4. **Email domain is exactly `teachps.org`.** The normalized (trimmed, lowercased) email's domain is compared with strict equality — never `String.prototype.endsWith`, which would also match a lookalike domain such as `evil-teachps.org` or a subdomain such as `teachps.org.evil.com`.
5. **Hosted domain (`hd`) claim present and exactly `teachps.org`.** The `hd` claim is Google's own signal that the account belongs to a specific Workspace domain. It must be present (a personal `@gmail.com` account never carries this claim at all) and must exactly match, with the same anti-lookalike, anti-subdomain strict comparison as the email domain check.

Any failure returns a discriminated denial (`{ allowed: false, reason: ... }`) with a machine-readable `reason` for tests and logs — never rendered to the end user. The `/sign-in` page shows only a single generic message ("Sign-in was not completed. Please try again with an authorized @teachps.org Google Workspace account.") regardless of which check failed, so a failed attempt never reveals whether an account, organization, or user record exists.

The ID token itself is verified with full signature, issuer, and audience validation (`verifyGoogleIdToken`, from Better Auth's Google provider) before any of its claims are trusted — the server never trusts a client-supplied, unverified token. Direct client-supplied ID-token sign-in is disabled (`disableIdTokenSignIn: true`); the only supported flow is the server-driven authorization-code exchange.

## First-Login Provisioning

The **first** time a verified `@teachps.org` account signs in, Better Auth's `user.create` flow runs. A `databaseHooks.user.create.before` hook unconditionally overwrites two fields on the record about to be inserted, regardless of what Better Auth's default field population would otherwise produce:

- `organizationId` → the canonical TEACH organization's fixed UUID (`c5a6e372-c2b7-4692-82e2-6af9057f7b06`).
- `baseRole` → the fixed string `"requester"`.

These two fields are also declared `input: false` in `user.additionalFields`, so no client-supplied value for either field is ever accepted through the API in the first place — the hook is defense-in-depth, not the only layer. The database itself enforces both invariants a third and final time with `CHECK` constraints (below), so even a direct, non-Better-Auth SQL write cannot create a user in a different organization or with a different base role.

No department membership, elevated role, permission grant, or ticket-related record is created at any point in this flow. A returning user's existing `sub` is matched against their stored `account` record — a returning sign-in never creates a second user.

## Database Enforcement (Defense in Depth)

The Phase 3 schema (`src/db/schema/auth.ts`) adds four tables — `user`, `account`, `session`, `verification` — matching Better Auth's expected shape, with additional `CHECK` constraints and foreign keys that hold even against a direct database write:

| Table     | Constraint                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `user`    | `base_role` must equal `'requester'` — no other value is possible.                                                                      |
| `user`    | `organization_id` must equal the canonical TEACH organization's UUID, and references `organizations(id)` (delete-restricted).           |
| `user`    | `email_verified` must be `true`, the stored email must already be lowercased, and it must match `@teachps.org` exactly.                 |
| `account` | `provider_id` must equal `'google'` — no other provider is possible.                                                                    |
| `account` | `access_token`, `refresh_token`, `id_token`, and `password` must all be `NULL` — Google OAuth tokens and passwords are never persisted. |
| `account` | `(provider_id, account_id)` is unique — the same Google `sub` cannot be attached to more than one account record.                       |
| `account` | `user_id` references `user(id)`, cascading on delete.                                                                                   |
| `session` | `user_id` references `user(id)`, cascading on delete; `token` is unique.                                                                |

Migration `drizzle/0002_low_meteorite.sql` is the forward-only migration that creates these four tables. It does not modify migrations `0000` or `0001` (the Phase 2 database foundation) in any way.

## Why No Tokens Are Persisted

Better Auth's `account` table can optionally store a provider's access/refresh/ID tokens for later use (e.g. calling a provider API on the user's behalf). This project never needs that: the only use of Google here is identity verification at sign-in. Accordingly:

- The Google provider requests only the minimal OpenID Connect scopes: `openid`, `email`, `profile` (`disableDefaultScope: true`, explicit `scope` list) — no Drive, Gmail, Calendar, or Admin SDK scope is requested.
- `databaseHooks.account.create.before` and `databaseHooks.account.update.before` unconditionally null out `accessToken`, `refreshToken`, `idToken`, and `password` on every write, regardless of what Better Auth would otherwise populate.
- The `account_no_persisted_credentials_check` constraint enforces the same rule at the database level, so it holds even if application code changes later without corresponding test coverage.
- Password authentication is disabled entirely (`emailAndPassword.enabled: false`) and account linking is disabled (`account.accountLinking.enabled: false`) — a Google account can never be merged with a password-based or another provider's account.

## Sessions and Cookies

- **Strategy:** database-backed sessions (a `session` table row per active session), not stateless JWTs — a session can be revoked server-side by deleting its row.
- **Maximum lifetime:** 8 hours (`session.expiresIn = 28800` seconds), after which re-authentication with Google is required.
- **Rolling renewal:** `session.updateAge = 3600` seconds — an active session's expiry is refreshed at most once per hour of use, never beyond the 8-hour maximum from session creation... i.e., ordinary continued use keeps a session alive, but a session is never extended past what Better Auth's session-refresh mechanics allow within that maximum.
- **Cookies:** Secure, `HttpOnly`, and `SameSite=Lax` — Better Auth's defaults for a same-site deployment, never weakened. Cookies are never readable from client-side JavaScript and are never sent cross-site on unsafe requests.

## Routes and Pages

| Route                | Purpose                                                                                                                                                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/auth/[...all]` | Better Auth's own request handler (OAuth start/callback, session, sign-out, etc.). A thin, lazily-constructed wrapper — no custom auth logic lives in this route.                                                                                                                                                                                      |
| `/sign-in`           | A minimal page: states the `@teachps.org`-only restriction, a single "Continue with Google" action, and a generic denial message on a failed attempt. Never reveals why a specific attempt failed. Renders a safe "Authentication configuration pending" notice instead of a broken sign-in action when the required environment variables are absent. |
| `/account`           | A minimal, session-gated page: name, email, and the fixed **Requester** role only. Never a dashboard, never ticket data. Unauthenticated or misconfigured requests are redirected to `/sign-in` server-side — the page is never rendered without a validated session. Includes a sign-out action.                                                      |

The home page (`/`) links to `/sign-in` when the required environment variables are present; otherwise it shows the same "configuration pending" notice, never a broken link.

### Post-Sign-In Destination (Phase 6)

`/sign-in` accepts an optional `callbackURL` query parameter (e.g. `/sign-in?callbackURL=/requests/TKT-000001`) naming where to return the user after a successful sign-in — set automatically by every Phase 6 requester page (`src/auth/current-actor.ts`'s `requireActiveActor`) when it redirects an unauthenticated visitor. The value is validated by `resolveSafeCallbackPath` (`src/auth/safe-redirect.ts`): only a same-origin relative path (starting with a single `/`, never `//` or an embedded `://`) is honored; anything else, or a missing parameter, falls back to `/requests` — the normal destination after signing in. This prevents the parameter from being used as an open redirect to an external site.

## Configuration

| Variable               | Purpose                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`   | Session/cookie signing secret.                                                                    |
| `BETTER_AUTH_URL`      | The application's own public base URL, used to build OAuth redirect URIs and cookie attributes.   |
| `GOOGLE_CLIENT_ID`     | The Google Cloud OAuth client ID for the Google Workspace sign-in provider.                       |
| `GOOGLE_CLIENT_SECRET` | The corresponding OAuth client secret. Never prefixed `NEXT_PUBLIC_`; never sent to the browser.  |
| `DATABASE_URL`         | Required at request time for the Better Auth database adapter (see [`DATABASE.md`](DATABASE.md)). |

None of these are required to install, lint, type-check, test, or build the application — `src/auth/auth.ts` constructs the Better Auth instance lazily, only inside a request-time function, exactly like the existing database client. `isAuthConfigured()` (`src/auth/env.ts`) lets `/`, `/sign-in`, and `/account` detect a missing configuration and render a safe notice instead of throwing.

## What Is Deliberately Not Included

Phase 3 contains **no department membership, no elevated role or permission of any kind, no admin/staff-specific accounts, no ticket functionality, and no Google Drive/Gmail/Calendar/Admin SDK integration.** Every account that signs in — with no exception — receives the same fixed Requester role in the same fixed organization. Password, magic-link, OTP, and passkey authentication are not implemented and are not planned; Google Workspace is the sole identity provider (see [`DECISION_LOG.md`](DECISION_LOG.md), D-002).

## Testing

- **Identity policy** (`src/auth/google-identity-policy.test.ts`) — table-driven positive/negative cases covering every rule above with no framework, database, or network dependency.
- **Configuration builder** (`src/auth/auth-options.test.ts`) — asserts the exact shape of the Better Auth options object (scopes, hosted domain, disabled features, session lifetime, credential-stripping hooks, provisioning hooks) against a fake in-memory database handle — no real database or network call.
- **Database integration** (`src/db/database-foundation.test.ts`, run via `npm run db:verify`) — applies all committed migrations to a fresh in-memory PGlite database and proves every constraint above holds: default organization/role assignment, rejection of any other base role, rejection of an unverified or non-`teachps.org` email, rejection of a duplicate Google subject, rejection of an account or session referencing a nonexistent user, rejection of any persisted token/password field, and rejection of a non-Google provider.
- **UI** (`src/app/sign-in/page.test.tsx`, `src/app/account/page.test.tsx`) — the sign-in page's restriction notice, generic error state, and configuration-pending fallback; the account page's redirect-to-sign-in behavior when unauthenticated or misconfigured, and its minimal, Requester-only rendering when authenticated.

No test in this repository contacts Google, Vercel, or a real external database, and no real employee data appears anywhere in source, fixtures, or tests.
