# TEACH Ticket System — Authentication and First-Login Provisioning

This document covers the Phase 3 authentication foundation: Google Workspace sign-in, the identity-verification rules the server enforces before issuing a session, session/cookie handling, and first-login user provisioning. It does not cover role/permission enforcement beyond the default Requester role, department membership, or ticket functionality — none of that exists yet (see [`PHASE_PLAN.md`](PHASE_PLAN.md)).

## Summary

Every sign-in verifies the identity Google asserts and only issues a session if every check below passes. On a verified account's first sign-in, the server creates exactly one profile: the canonical TEACH organization and the fixed **Requester** base role. No other role, department, or ticket data is created or assumed.

**Two authentication-access modes exist (Phase 9A), selected by `AUTH_ACCESS_MODE`:**

- **`workspace`** — the original, strict mode: only a verified `@teachps.org` Google Workspace account may sign in. Intended for the eventual TEACH-owned Workspace deployment.
- **`invite_only`** — a controlled-pilot mode: any verified Google account (a personal Gmail account, or an account from any Workspace domain) may sign in, but only once its email has a current, accepted invitation. Intended for letting the owner and selected testers use the completed application before TEACH Workspace/OAuth infrastructure is ready.

A missing, unknown, or incomplete `AUTH_ACCESS_MODE` leaves authentication unavailable — there is no permissive default. See [Two Authentication-Access Modes](#two-authentication-access-modes-phase-9a) below for the full detail.

## Library and Versions

- **[Better Auth](https://www.better-auth.com/)** `1.6.27` (pinned) — session/cookie management, the OAuth/OIDC authorization-code + PKCE flow with Google, and CSRF protection. Authentication is never hand-rolled: no custom JWT, OAuth, session, or CSRF code exists in this repository.
- **`@better-auth/drizzle-adapter`** `1.6.27` (pinned) — persists Better Auth's user/account/session/verification records through the project's existing Drizzle ORM setup, using database-generated UUIDs (Postgres `gen_random_uuid()`), not application-generated IDs.
- Both packages are pinned to the exact stable `1.6.27` release — no `1.7` beta/RC/pre-release version is used.

## Identity Verification (Enforced Before Any Session Is Issued)

Google Sign-In alone does not grant access. In both modes, every check runs in [`src/auth/google-identity-policy.ts`](../src/auth/google-identity-policy.ts), a small, pure, framework-agnostic policy module with no dependency on Better Auth, Next.js, or a database. The ID token itself is verified with full signature, issuer, and audience validation (`verifyGoogleIdToken`, from Better Auth's Google provider) before any of its claims are trusted — the server never trusts a client-supplied, unverified token. Direct client-supplied ID-token sign-in is disabled (`disableIdTokenSignIn: true`); the only supported flow is the server-driven authorization-code exchange. Only the minimal OpenID Connect scopes are ever requested, in either mode: `openid`, `email`, `profile` — no Gmail, Drive, Calendar, or offline-access scope, and no refresh token is ever requested or persisted (see [Why No Tokens Are Persisted](#why-no-tokens-are-persisted)).

### Workspace Mode (`evaluateGoogleWorkspaceIdentity`)

1. **Subject (`sub`) present.** Google's immutable, per-account subject identifier must be a non-empty string. This — never the email address — is the identity anchor stored against the account record, because an email address can change but `sub` cannot.
2. **Email present and well-formed.**
3. **`email_verified` is strictly `true`.** Compared with `!== true`, never a truthy check — a string `"true"` or any other truthy-but-not-boolean value is rejected.
4. **Email domain is exactly `AUTH_ALLOWED_DOMAIN`** (`teachps.org` for the TEACH deployment). The normalized (trimmed, lowercased) email's domain is compared with strict equality — never `String.prototype.endsWith`, which would also match a lookalike domain such as `evil-teachps.org` or a subdomain such as `teachps.org.evil.com`.
5. **Hosted domain (`hd`) claim present and exactly `AUTH_ALLOWED_DOMAIN`.** The `hd` claim is Google's own signal that the account belongs to a specific Workspace domain. It must be present (a personal `@gmail.com` account never carries this claim at all) and must exactly match, with the same anti-lookalike, anti-subdomain strict comparison as the email domain check. The `hd` value is also sent to Google as an authorization-request hint in this mode.

### Invite-Only Mode (`evaluateGoogleInviteOnlyIdentity`)

Only checks 1–3 above (stable subject, well-formed email, verified email) — **no domain or `hd` requirement at all**, and `hd` is never sent to Google as a hint in this mode. Whether the specific address is actually invited is a separate, database-backed decision made after identity verification passes (see [Two Authentication-Access Modes](#two-authentication-access-modes-phase-9a)).

Any failure returns a discriminated denial (`{ allowed: false, reason: ... }`) with a machine-readable `reason` for tests and logs — never rendered to the end user. `/sign-in` shows only a single generic message regardless of which check failed (worded per the active mode — see [Friendly Sign-In and Authentication-Unavailable States](#friendly-sign-in-and-authentication-unavailable-states-phase-9)), so a failed attempt never reveals whether an account, organization, or invitation exists.

## First-Login Provisioning

The **first** time a verified account signs in, Better Auth's `user.create` flow runs. A `databaseHooks.user.create.before` hook unconditionally overwrites two fields on the record about to be inserted, regardless of what Better Auth's default field population would otherwise produce:

- `organizationId` → the canonical TEACH organization's fixed UUID (`c5a6e372-c2b7-4692-82e2-6af9057f7b06`).
- `baseRole` → the fixed string `"requester"`.

These two fields are also declared `input: false` in `user.additionalFields`, so no client-supplied value for either field is ever accepted through the API in the first place — the hook is defense-in-depth, not the only layer. The database itself enforces both invariants a third and final time with `CHECK` constraints (below), so even a direct, non-Better-Auth SQL write cannot create a user in a different organization or with a different base role.

**In `invite_only` mode**, this same `before` hook adds one more condition: it looks up a pending invitation for the normalized email in the canonical organization, and returns `false` — aborting the user-creation transaction entirely — if none exists. Better Auth surfaces an aborted creation as a generic OAuth failure, routed to the same friendly `/sign-in?error=1` denial state as any other failed sign-in attempt; no user row, account link, or session is ever created for a noninvited address. If a pending invitation does exist, a `databaseHooks.user.create.after` hook marks it accepted (`status`, `acceptedByUserId`, `acceptedAt`) once the user row is committed — see [Pilot Invitations](#pilot-invitations-phase-9a) below. **In `workspace` mode**, this invitation check is skipped entirely; eligibility is decided solely by the identity check above.

No department membership, elevated role, permission grant, or ticket-related record is created at any point in this flow, in either mode. A returning user's existing `sub` is matched against their stored `account` record (Better Auth's own account-linking-by-provider-identity mechanism, unchanged since Phase 3, and disabled for any _other_ provider or unlinked account via `account.accountLinking.enabled: false`) — a returning sign-in never creates a second user and never silently links an unrelated account.

## Database Enforcement (Defense in Depth)

The Phase 3 schema (`src/db/schema/auth.ts`) adds four tables — `user`, `account`, `session`, `verification` — matching Better Auth's expected shape, with additional `CHECK` constraints and foreign keys that hold even against a direct database write:

| Table     | Constraint                                                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `user`    | `base_role` must equal `'requester'` — no other value is possible.                                                                      |
| `user`    | `organization_id` must equal the canonical TEACH organization's UUID, and references `organizations(id)` (delete-restricted).           |
| `user`    | `email_verified` must be `true` and the stored email must already be lowercased and well-formed (`user_verified_email_check`).          |
| `account` | `provider_id` must equal `'google'` — no other provider is possible.                                                                    |
| `account` | `access_token`, `refresh_token`, `id_token`, and `password` must all be `NULL` — Google OAuth tokens and passwords are never persisted. |
| `account` | `(provider_id, account_id)` is unique — the same Google `sub` cannot be attached to more than one account record.                       |
| `account` | `user_id` references `user(id)`, cascading on delete.                                                                                   |
| `session` | `user_id` references `user(id)`, cascading on delete; `token` is unique.                                                                |

Migration `drizzle/0002_low_meteorite.sql` is the forward-only migration that creates these four tables. It does not modify migrations `0000` or `0001` (the Phase 2 database foundation) in any way.

**Phase 9A note:** the `user` table's email `CHECK` constraint was originally `@teachps.org`-exact (`user_verified_teachps_email_check`). Since the same schema must now support both `workspace` and `invite_only` modes — and a shared database cannot apply a domain restriction conditionally based on a runtime environment variable — migration `drizzle/0005_phase9a_invite_only_access.sql` replaces it with a domain-agnostic `user_verified_email_check` (verified, lowercased, well-formed — any domain). Domain eligibility is now an application-layer decision only (`src/auth/google-identity-policy.ts`, selected by `AUTH_ACCESS_MODE`); the database still enforces verification and normalization unconditionally in either mode. This migration also adds the `auth_invitations` table — see [Pilot Invitations](#pilot-invitations-phase-9a) below — and does not modify migrations `0000`–`0004` in any way.

## Two Authentication-Access Modes (Phase 9A)

`AUTH_ACCESS_MODE` selects exactly one of two modes (`src/auth/access-mode.ts`). It fails closed: absent, empty, or any value other than the two below leaves `isAuthConfigured()` returning `false` — the same safe "configuration pending" state as any other missing credential, never a permissive default.

| Mode          | Additional variable                        | Who can sign in                                                             | Intended use                                                                                                       |
| ------------- | ------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `workspace`   | `AUTH_ALLOWED_DOMAIN` (e.g. `teachps.org`) | Only a verified account on the exact configured Workspace domain.           | The eventual TEACH-owned Google Workspace deployment.                                                              |
| `invite_only` | _(none — must not be set)_                 | Any verified Google account whose email has a current, accepted invitation. | A controlled pilot, using an External Google OAuth client if TEACH Workspace/OAuth infrastructure isn't ready yet. |

Both modes share everything else described in this document: the same minimal OIDC scopes, the same no-persisted-tokens rule, the same fixed canonical-organization/Requester provisioning, the same 8-hour session, and the same disabled account-linking/password/magic-link/dev-login guarantees. Only the identity-eligibility check (workspace domain vs. invitation lookup) and the `hd` OAuth hint (sent only in workspace mode) differ.

## Pilot Invitations (Phase 9A)

Invite-only mode's access list lives in one small database table, `auth_invitations` (`src/db/schema/auth-invitations.ts`), not an email allowlist or a role. A row means "this email is, or was, invited" — nothing more:

- **Columns:** id, organization id (fixed to the canonical organization), normalized email, `status` (`pending` | `accepted` | `revoked`), `created_source` (`cli` | `admin_ui`), an optional creating-administrator user id, `created_at`, an optional accepted-user id and `accepted_at`, an optional revoking-administrator user id and `revoked_at`.
- **At most one _pending_ invitation per email** within the organization (a partial unique index) — but accepted/revoked history is never deleted, so a fresh invitation can always be created for a previously revoked address.
- **A `CHECK` constraint enforces the status/timestamp shape** — a `pending` row has no acceptance/revocation columns set, an `accepted` row has exactly the acceptance columns set, a `revoked` row has exactly the revocation columns set. No row can be in an inconsistent state, even from a direct write.
- **Invitation is never a role.** Accepting an invitation only allows the _first_ sign-in to provision a plain Requester — it grants no department-agent or system-administrator access on its own, exactly like any other sign-in.
- **No email is ever sent.** Both the guarded CLI and the `/admin` Pilot Invitations UI simply record the invitation; the administrator (or operator) is expected to tell the invited person directly to visit the sign-in page.

**Creating an invitation** — two paths, both landing on the same shared store (`src/auth/invitations.ts`):

- **Guarded CLI:** `npm run access:invite -- --email <address>` (`src/auth/invite-bootstrap.ts`, invoked by `src/db/scripts/access-invite.ts`). Defaults to a dry run; requires `--apply` together with a matching `--confirm-email`; requires `AUTH_ACCESS_MODE=invite_only` and `DATABASE_MIGRATION_URL`; never creates a user; is idempotent (a repeat `--apply` against an already-pending or already-accepted address makes no change; against a previously revoked address it creates a genuinely new invitation rather than reactivating the old row).
- **`/admin` Pilot Invitations section:** visible only while `AUTH_ACCESS_MODE=invite_only`, and only to an active system administrator (the same `administer` authorization action every other `/admin` action already uses). An administrator can create an invitation, view pending/accepted invitations, and revoke a pending one. A duplicate pending invitation is rejected outright (unlike the CLI's idempotent no-op) so the administrator gets immediate, specific feedback.

**Revoking** only ever affects a still-_pending_ invitation — an already-accepted invitation's history is left untouched. Removing an already-signed-in pilot user's access is done the existing way: deactivating their account at `/admin`'s People and Access section (`is_active`), not by touching invitation history. This mirrors the existing rule that department/administrator access is managed separately from sign-in itself.

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

| Route                | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/auth/[...all]` | Better Auth's own request handler (OAuth start/callback, session, sign-out, etc.). A thin, lazily-constructed wrapper — no custom auth logic lives in this route.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `/sign-in`           | A minimal page whose wording matches the active `AUTH_ACCESS_MODE`: the `@teachps.org`-only restriction in workspace mode, or an invited-account/contact-your-administrator message in invite-only mode — never both, and invite-only mode never claims a domain restriction. A single "Continue with Google" action either way, and a generic denial message on a failed attempt that never reveals why a specific attempt failed. Renders a safe "Authentication configuration pending" notice instead of a broken sign-in action when the required environment variables (including a valid `AUTH_ACCESS_MODE`) are absent. |
| `/account`           | A minimal, session-gated page: name, email, and the fixed **Requester** role only. Never a dashboard, never ticket data. Unauthenticated or misconfigured requests are redirected to `/sign-in` server-side — the page is never rendered without a validated session. Includes a sign-out action.                                                                                                                                                                                                                                                                                                                              |

The home page (`/`) links to `/sign-in` when the required environment variables are present; otherwise it shows the same "configuration pending" notice, never a broken link.

### Post-Sign-In Destination (Phase 6)

`/sign-in` accepts an optional `callbackURL` query parameter (e.g. `/sign-in?callbackURL=/requests/TKT-000001`) naming where to return the user after a successful sign-in — set automatically by every Phase 6 requester page (`src/auth/current-actor.ts`'s `requireActiveActor`) when it redirects an unauthenticated visitor. The value is validated by `resolveSafeCallbackPath` (`src/auth/safe-redirect.ts`): only a same-origin relative path (starting with a single `/`, never `//` or an embedded `://`) is honored; anything else, or a missing parameter, falls back to `/requests` — the normal destination after signing in. This prevents the parameter from being used as an open redirect to an external site.

### Signing In Never Grants Elevated Access (Phase 8)

Signing in through this flow — first-time or returning — only ever produces or updates the same fixed Requester profile described above; it never grants department-agent or system-administrator access on its own. Those are managed separately, after sign-in, at `/admin` by an existing system administrator (see [`DATABASE.md`](DATABASE.md) and [`DEVELOPMENT.md`](DEVELOPMENT.md)) — and the very first system administrator can only be designated by a direct, separately approved database operation, since `/admin` itself requires an administrator to already exist and sign in to use it. This repository's automated work never performs that operation and never will without explicit, separate approval.

### First-Administrator Bootstrap Command (Phase 9)

That "direct, separately approved database operation" is `npm run admin:bootstrap` (`src/admin/bootstrap.ts`, invoked by `src/db/scripts/admin-bootstrap.ts`) — a guarded command, not an ad hoc query. It defaults to a dry run, requires an explicit `--apply` together with a matching `--confirm-email`, never creates a user, never changes an organization, and is idempotent. **The target's eligibility depends on the active `AUTH_ACCESS_MODE` (Phase 9A):** in workspace mode, the target must be an already-existing active user with an exact `@AUTH_ALLOWED_DOMAIN` address; in invite-only mode, the target must be an already-existing active user with a linked Google account and an accepted pilot invitation — no particular email domain is required in invite-only mode. See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full safeguards and the sequential deployment steps that use it. Running it against a real database remains a separately approved operational step — it is not performed as part of this repository's automated work.

### Friendly Sign-In and Authentication-Unavailable States (Phase 9)

`/sign-in`'s wording matches the active `AUTH_ACCESS_MODE` (Phase 9A): in workspace mode it states the system is for TEACH staff, that sign-in requires a TEACH `@teachps.org` Google Workspace account, and that personal Google accounts are not permitted; in invite-only mode it states sign-in is limited to an invited Google account and to contact the system administrator for access — it never claims a `@teachps.org` requirement in this mode. Either mode states that staff can request IT or Facilities help once signed in. If authentication is not configured (`isAuthConfigured()` returns `false`, which now also requires a valid `AUTH_ACCESS_MODE`), the page shows a generic "Sign-in is not available yet" notice instead of a broken button — it never states which environment variable is missing. A failed sign-in attempt (whether the identity provider denies it, producing the existing `?error=1` redirect, or the client-side request to start sign-in fails outright) always shows a generic, safe message matching the active mode's wording and leaves the page in a retryable state; no account, organization, or provider detail is ever exposed.

## Configuration

| Variable               | Purpose                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `BETTER_AUTH_SECRET`   | Session/cookie signing secret.                                                                                                       |
| `BETTER_AUTH_URL`      | The application's own public base URL, used to build OAuth redirect URIs and cookie attributes.                                      |
| `GOOGLE_CLIENT_ID`     | The Google Cloud OAuth client ID. A TEACH-owned project in workspace mode; may be an External OAuth client in invite-only mode.      |
| `GOOGLE_CLIENT_SECRET` | The corresponding OAuth client secret. Never prefixed `NEXT_PUBLIC_`; never sent to the browser.                                     |
| `DATABASE_URL`         | Required at request time for the Better Auth database adapter (see [`DATABASE.md`](DATABASE.md)).                                    |
| `AUTH_ACCESS_MODE`     | (Phase 9A) `invite_only` or `workspace` — selects the active access mode. Fails closed if absent or any other value.                 |
| `AUTH_ALLOWED_DOMAIN`  | (Phase 9A) Required only when `AUTH_ACCESS_MODE=workspace`. The exact Workspace domain allowed to sign in (`teachps.org` for TEACH). |

None of these are required to install, lint, type-check, test, or build the application — `src/auth/auth.ts` constructs the Better Auth instance lazily, only inside a request-time function, exactly like the existing database client. `isAuthConfigured()` (`src/auth/env.ts`) lets `/`, `/sign-in`, and `/account` detect a missing configuration and render a safe notice instead of throwing.

## What Is Deliberately Not Included

**No department membership, no elevated role or permission of any kind beyond what `/admin` already manages, no ticket functionality, and no Google Drive/Gmail/Calendar/Admin SDK integration.** Every newly provisioned account — with no exception, in either access mode — receives the same fixed Requester role in the same fixed organization; agent and administrator access remain entirely database-controlled, never automatic. Password, magic-link, OTP, and passkey authentication are not implemented and are not planned; public self-registration does not exist; there is no email allowlist, no development login, no shared demo account, and no seeded invitation, agent, or administrator. Google is the sole identity provider (see [`DECISION_LOG.md`](DECISION_LOG.md), D-002).

## Testing

- **Identity policy** (`src/auth/google-identity-policy.test.ts`) — table-driven positive/negative cases for both `evaluateGoogleWorkspaceIdentity` and `evaluateGoogleInviteOnlyIdentity`, with no framework, database, or network dependency.
- **Access mode** (`src/auth/access-mode.test.ts`) — missing/unknown mode fails closed, invite-only never requires a domain, workspace mode requires a valid one.
- **Configuration builder** (`src/auth/auth-options.test.ts`) — asserts the exact shape of the Better Auth options object in both modes (scopes, hosted-domain hint only in workspace mode, disabled features, session lifetime, credential-stripping hooks, and the invite-only provisioning gate) against a fake in-memory database handle — no real database or network call.
- **Database integration** (`src/db/database-foundation.test.ts`, `src/db/invitations.test.ts`, `src/db/admin-bootstrap.test.ts`, `src/db/auth-provisioning.test.ts`, run via `npm run db:verify`) — applies all committed migrations to a fresh in-memory PGlite database and proves: default organization/role assignment; rejection of any other base role; rejection of an unverified, non-lowercased, or malformed email (any domain); rejection of a duplicate Google subject; the full invitation lifecycle (dry-run CLI, idempotent create, revoked-not-reactivated, accepted history retained); the real `databaseHooks.user.create` before/after flow denying a noninvited address, accepting an invited personal Gmail or other-Workspace-domain address, denying a revoked invitation, and safely no-oping on a retried accept; the Pilot Invitations admin service's authorization and organization scoping; and both access modes' administrator-bootstrap eligibility rules.
- **UI** (`src/app/sign-in/page.test.tsx`, `src/app/account/page.test.tsx`, `src/app/admin/page.test.tsx`, `src/app/admin/create-invitation-form.test.tsx`) — the sign-in page's mode-specific restriction notice, generic error state, and configuration-pending fallback; the account page's redirect-to-sign-in behavior when unauthenticated or misconfigured; the `/admin` Pilot Invitations section rendering only in invite-only mode with no internal id displayed.

No test in this repository contacts Google, Vercel, or a real external database, and no real employee data or real email address appears anywhere in source, fixtures, or tests.
