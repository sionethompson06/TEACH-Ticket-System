# TEACH Ticket System — Phase Plan

This document lays out the planned implementation phases for the TEACH Ticket System. **It is a plan, not an implementation** beyond what is explicitly marked completed below. Each phase must be explicitly approved before work begins, and each phase's Claude Code prompt must stop at its stated boundary.

## Phase 0 — Project Foundation and Service-Design Documentation ✅ Completed

- **Objective:** Establish the written organizational, service-design, and decision-tracking foundation the rest of the project will build on.
- **Included scope:** `README.md`, `docs/PROJECT_FOUNDATION.md`, `docs/DECISION_LOG.md`, `docs/PHASE_PLAN.md`, and a preliminary `.gitignore`.
- **Explicit exclusions:** Application scaffolding, UI, authentication, database, API routes, ticket submission, dashboards, email delivery, Drive integration, AI features, deployment configuration.
- **Completion gate:** All four documentation files and the `.gitignore` exist, accurately reflect confirmed requirements, and contain no secrets or invented facts.

## Phase 1 — Application Scaffold and Development-Quality Baseline ✅ Completed

- **Objective:** Stand up an empty, deployable Next.js/TypeScript application shell with a working development and quality-check baseline.
- **Included scope:** Next.js/TypeScript project structure, linting, formatting, type checking, a minimal health/status page, test framework setup, environment-variable pattern (no real secrets).
- **Explicit exclusions:** Database connectivity, authentication, business logic, ticket data model, UI beyond a minimal shell.
- **Completion gate:** The app builds, runs locally, passes lint/type checks, and deploys a preview with no functional features yet.

## Phase 2 — Database Foundation and Seed Data ✅ Completed

- **Objective:** Introduce PostgreSQL, migrations, and a seeded, non-sensitive reference dataset (organizations, schools, service locations).
- **Included scope:** Database provider connection pattern, migration tooling, core reference tables, seed scripts using only synthetic/non-sensitive data.
- **Explicit exclusions:** User accounts, authentication, ticket tables, department workflow tables.
- **Completion gate:** Migrations run cleanly against a fresh database; seeded reference data matches `PROJECT_FOUNDATION.md`.

## Phase 3 — Google Workspace Authentication and User Provisioning — Implementation complete — external configuration and live OAuth acceptance deferred

- **Objective:** Allow verified `@teachps.org` accounts to sign in, and provision a Requester-role profile on first sign-in.
- **Included scope:** Google Workspace OAuth/OIDC sign-in, domain/verification checks, session handling, first-login user provisioning.
- **Explicit exclusions:** Role/permission enforcement beyond default Requester, department or admin role assignment, ticket features.
- **Completion gate:** Only verified `@teachps.org` accounts can sign in; personal/unverified accounts are denied; negative tests pass.
- **Status:** The code foundation (schema, migration, identity-policy module, Better Auth configuration, routes/pages, and automated tests — see [`AUTHENTICATION.md`](AUTHENTICATION.md)) is complete and tested against a fresh in-memory database with no real credentials. The completion gate's live element — a Google Cloud OAuth client accepting a real `@teachps.org` sign-in against a deployed instance, with a production database configured — has not been exercised. No Google credentials are requested or connected as part of Phase 4; live OAuth acceptance remains a deferred, separately approved operational step. Synthetic identities are used only in automated tests.

## Phase 4 — Minimal Access Control (MVP) ✅ Completed

- **Objective:** Build the smallest access-control foundation an actual help-desk ticket system needs — nothing more — so that the real ticket data model and workflow (Phase 5 onward) can be built against it next.
- **Included scope:**
  - A minimal `departments` table, seeded with exactly **IT** and **Facilities**.
  - A minimal `department_memberships` table: a row means "this user is an agent for this department." A user may hold memberships in IT, Facilities, or both; duplicates are rejected; memberships are organization-scoped at the database level.
  - A single explicit `is_system_administrator` boolean column on `user` (default `false`), settable only by a direct, separately approved database operation — never by seed, client input, or a bootstrap/dev account.
  - A small, centralized, server-only authorization module (`src/authz/`) answering: can this user create a ticket, access a ticket they requested, access a ticket for one of their assigned departments, or perform administrative actions? It is independent of Better Auth's initialization (testable without Google credentials) and never trusts a client-supplied role or membership claim — every decision is made from a `ResolvedActor` built fresh from the validated server session and current database state.
- **Explicit exclusions:** Ticket tables and ticket routes (Phase 5+), department-manager roles, principal/campus-administrator access, campus-specific permission grants, confidential ticket queues and confidential-access grants, expiring permission grants, complex capability matrices, advanced authorization audit workflows, and multiple administrator levels — see "Deferred Beyond the MVP" below. Locations remain routing/filtering information for tickets, not a permission scope, in this MVP.
- **Completion gate:** Table-driven authorization tests pass for every access rule and denial case (anonymous, missing database user, inactive user, cross-department, cross-organization, unknown action, forged client claims) — see [`DATABASE.md`](DATABASE.md) and the test files under `src/authz/` and `src/db/`.
- **Status:** No real users, department memberships, or administrators exist. The first real system administrator will be configured later through a separately approved operational step, not by this phase.

### Deferred Beyond the MVP (Post-MVP Access-Control Backlog)

The longer-term authorization vision from `docs/PROJECT_FOUNDATION.md` is preserved, but explicitly deferred until the basic help-desk workflow is working end-to-end:

- Department-manager roles (triage/reassignment/priority-override authority within a department).
- Principal or campus-administrator access (planned for Phase 9 — Principal Campus Visibility).
- Campus-specific permission grants.
- Confidential ticket queues and confidential-access grants (a separate, explicit grant beyond ordinary department membership).
- Expiring permission grants.
- Complex capability matrices.
- Advanced authorization audit workflows.
- Multiple administrator levels (configuration authority vs. confidential-content access remain conceptually separate per `PROJECT_FOUNDATION.md`, but only one simple administrator flag exists so far).

## Phase 5 — Core Ticket Foundation ✅ Completed

- **Objective:** Build the simple database and server-service foundation for a basic help-desk ticket — the fewest tables and concepts necessary — so Phase 6 can build the requester-facing interface directly against it. No UI is built in this phase.
- **Included scope:**
  - A minimal `ticket_categories` table, seeded with exactly the confirmed IT (7) and Facilities (8) categories from `PROJECT_FOUNDATION.md` Sections 4–5 — categories only, not the representative request types or any form-field/SLA detail.
  - A minimal `tickets` table: organization, requester, department, service location, category, subject, description, a small documented status subset (`submitted`, `in_progress`, `waiting_for_requester`, `resolved`, `closed`, `reopened`), a documented priority (`low`, `normal`, `urgent`, `critical`; new tickets default to `normal`), an optional assigned agent, and created/updated/resolved/closed timestamps. The human-friendly ticket number (`TKT-000001`) is generated by a database identity sequence — never a record count, timestamp, random value, or client-side logic.
  - A minimal, append-only `ticket_comments` table — ordinary shared conversation only, visible to the requester and authorized support staff. No internal notes, attachments, editing, deletion, reactions, rich text, or email ingestion.
  - A narrow, append-only `ticket_activity` table recording only ticket creation, status changes, priority changes, and assignment changes, each written in the same database transaction as the change it records.
  - A small server-only ticket service (`src/tickets/`) — `createTicket`, `getTicket`, `listTicketsForActor`, `addTicketComment`, `updateTicketStatus`, `updateTicketPriority`, `assignTicket` — built entirely on the Phase 4 authorization model (extended with one additional `manage_ticket` action distinguishing "may view/comment" from "may change status/priority/assignment," since a requester is only ever the former).
- **Explicit exclusions:** Any UI (intake form, My Requests page, ticket detail page, department queue, dashboards, admin pages, search/filters); a generalized workflow engine, event bus, permissions framework, or plugin system; a routing-rule engine or automated priority recommendation (the requester selects department/category directly; priority always starts at the fixed default and is changed only by an authorized agent/administrator); SLA deadline calculation; email notifications; attachments.
- **Completion gate:** Database constraints and tests confirm ticket numbers are unique, a category must belong to its selected department, cross-organization data is rejected, and blank subject/description/comment content is rejected; authorization tests confirm requester/department-agent/system-administrator ticket access exactly matches the Phase 4 model, including that an IT agent cannot access a Facilities ticket (and vice versa) without a separate membership.
- **Status:** No real users, tickets, or comments exist. Google Workspace live OAuth acceptance remains deferred exactly as stated in Phase 3 — this phase requested no credentials and added no bypass.

## Phase 6 — Requester-Facing Interface ✅ Completed

- **Objective:** Build the requester-facing interface on top of the Phase 5 ticket service: sign in, request help, see My Requests, open a request, read the conversation, and send a message — nothing more.
- **Included scope:**
  - Three new routes under `/requests`, all requiring a valid signed-in session (redirecting to `/sign-in` otherwise): `/requests` (My Requests — the requester's own tickets only), `/requests/new` (Request Help — a single-page form), and `/requests/[ticketNumber]` (ticket detail and conversation), addressed by the human-friendly ticket number (e.g. `TKT-000001`) rather than the internal database id.
  - A single-page Request Help form: IT/Facilities presented as two accessible choices, category filtered by the selected department and loaded from active Phase 5 reference data, a service-location choice, subject, and description. Requester identity, organization, priority, status, and assignee are never requester-selectable — they come from the trusted server-side actor and Phase 5 ticket defaults. A concise emergency-procedures note appears when Facilities is selected. Field-level validation errors and prior input are preserved on a failed submission.
  - A My Requests page showing only tickets the signed-in user created (even if they are also a department agent — department queues are Phase 7), using plain status/priority labels (see `docs/DATABASE.md`), sorted by most recently updated.
  - A ticket detail page showing the request's details, current status, and the public conversation, with a Send Message form using the existing Phase 5 public-comment behavior. Requester and support-team messages are visually and textually distinguished (not by color alone). An inaccessible or nonexistent ticket produces an identical, generic not-found result.
  - A small `src/tickets/ticket-queries.ts` read-only module (listing a requester's own tickets, loading an authorized ticket by ticket number, loading its comments, loading active form options) — every query re-checks Phase 4/5 authorization server-side and is scoped in SQL, never filtered in the browser.
- **Explicit exclusions:** Any IT/Facilities work queue, agent dashboard, assignment or status/priority controls, internal notes, admin pages, notifications, attachments, search, reporting, or additional roles/departments — all deferred to Phase 7 and later.
- **Completion gate:** A signed-in requester can submit a request, see it appear on My Requests with a friendly status, open it, and exchange a message with the support team; an unauthenticated visitor is redirected to sign in; a ticket the requester does not own is never distinguishable from a nonexistent one.
- **Status:** No department-agent interface exists yet (Phase 7). Google Workspace live OAuth acceptance remains deferred exactly as stated in Phase 3 — this phase requested no credentials and added no bypass.

## Phase 7 — IT and Facilities Support Workspace ✅ Completed

- **Objective:** Build one straightforward workspace where an authorized IT or Facilities agent (or a system administrator) can see their department's tickets, open one, read and reply to the conversation, assign it, and change its status and priority — nothing more.
- **Included scope:**
  - Two new routes, both requiring an active user with at least one department membership or system-administrator status (an ordinary requester gets a safe access-denied result and never sees the Support Queue link): `/support` (the queue) and `/support/[ticketNumber]` (the workspace), addressed by the same human-friendly ticket number the requester experience uses.
  - A shared authenticated navigation component (`src/app/app-nav.tsx`) used by both the requester and support layouts, showing **Support Queue** only to a department agent or system administrator.
  - A support queue showing active tickets (Received, Reopened, In progress, Waiting for you) by default — resolved and closed tickets are hidden unless explicitly filtered in — ordered by priority then age, with server-validated Department/Location/Status/Assignment (All/Mine/Unassigned) filters, a Clear filters action, a bounded result limit, and helpful empty states. Never a raw enum value, a raw database id, or a fetch-everything-then-filter-in-the-browser pattern.
  - A support ticket workspace showing the request's details (including the requester's display name, never their email), status, priority, assignment, the same public conversation and Send Message form the requester experience uses, and a simple, human-readable activity history (`src/tickets/activity-labels.ts`) — never raw metadata.
  - Assignment ("Assign to me" and a department-agent-only selector), status (limited to the valid next statuses from the existing Phase 5 transition rules), and priority controls, each a small, separate server-action form with a pending state, friendly errors, and revalidation of the queue, the workspace, and both requester-facing pages on success.
  - A closed ticket is enforced as final in the ticket service itself (`src/tickets/ticket-service.ts`): no further comment, assignment, or priority change is accepted regardless of what the UI shows, and both the support workspace and the requester's own ticket page replace their controls with a plain "this request is closed" message.
  - A small `src/tickets/support-queries.ts` read-only module (queue listing and filter options, ticket lookup by number, active department agents for the assignee selector, activity history) — every query re-checks Phase 4/5 authorization server-side and is scoped in SQL.
- **Explicit exclusions:** Dashboards, charts, saved views, search, bulk actions, pagination beyond a safe result limit, SLA timers or automatic escalation, internal/private notes, attachments, admin configuration pages, additional roles or departments, email/chat notifications, and any workflow automation that changes status/priority/assignment as a side effect of another action.
- **Completion gate:** An authorized department agent sees only their own department's active tickets by default, can open one, reply, assign it, and change its status/priority through the documented rules; a requester cannot reach the workspace; a closed ticket rejects every mutation and message, in the service layer as well as the UI.
- **Status:** No real agents, administrators, or support-workspace data exist. Google Workspace live OAuth acceptance remains deferred exactly as stated in Phase 3 — this phase requested no credentials and added no bypass.

## Phase 8 — Minimal Administration and MVP Usability Polish ✅ Completed

- **Objective:** Add one minimal administration page where an authorized system administrator can manage staff access, and complete a small usability/accessibility consistency pass across the existing MVP — nothing broader.
- **Included scope:**
  - A `/admin` route ("People and Access"), reachable only by an active system administrator (the existing `administer` authorization action from Phase 4) — an ordinary requester or department agent is denied identically whether they follow a link or type the URL directly, and the page is never listed for them in the shared navigation.
  - For each canonical-organization user: display name, email, active/inactive status, requester status (always true — the fixed base role from Phase 3), IT agent access, Facilities agent access, and system-administrator status, sorted by name, with a bounded result limit and one server-validated name/email search field. No provider account id, Google subject, session data, token, or other authentication metadata is ever selected or rendered.
  - Small server-action forms for exactly eight actions: add/remove IT access, add/remove Facilities access, activate/deactivate a user, and grant/remove system-administrator access — each with a pending state, a required confirmation before deactivating a user or granting/removing administrator access, and a concise success or friendly error message.
  - A new `src/admin/` module (`admin-service.ts` for the eight mutations, `admin-queries.ts` for the user listing, `errors.ts`) built entirely on the existing `authorize()` action from Phase 4 — no new roles or permissions framework. Every mutation re-loads the target user, confirms both actor and target belong to the canonical organization, validates any department against live reference data, and ignores every browser-supplied role/organization claim.
  - Explicit safeguards: an administrator can never deactivate their own account or remove their own administrator access; a duplicate membership addition and a missing-membership removal are both safe no-ops; deactivating a user never deletes their account, tickets, or comments, and immediately fails their next active-actor check on both the requester and support sides.
  - A small consistency pass across every existing page (`/`, `/sign-in`, `/account`, `/requests`, `/requests/new`, `/requests/[ticketNumber]`, `/support`, `/support/[ticketNumber]`, `/admin`): consistent navigation labels (including capitalizing "Sign Out" to match the rest of the nav) and updated home-page copy reflecting that the Support Queue and People and Access pages now exist.
- **Explicit exclusions:** Email/chat/Slack/SMS notifications, webhooks, background jobs and scheduled tasks, category/location/department creation or editing, custom fields or forms, workflow configuration, a broader user-management dashboard, and the first-real-administrator operational bootstrap (still a separately approved, later operational step).
- **Completion gate:** An active system administrator can activate/deactivate a user, grant/remove IT or Facilities agent access, and grant/remove system-administrator access, with every change taking effect immediately and every safeguard holding under a forged actor or organization value; an ordinary requester or department agent is denied `/admin` outright.
- **Status:** No real staff, agents, or administrators exist, and none was seeded. Google Workspace live OAuth acceptance and the first-administrator bootstrap both remain deferred exactly as stated in Phase 3 — this phase requested no credentials and added no bypass.

### Deferred From the Original Phase 8 Slot (Post-MVP Backlog)

An earlier draft of this plan tentatively named the Phase 8 slot "Requester Communication and Internal Notes." Public reply threads already exist (Phases 5–7); internal/private notes, a follower model, and access-safe @mentions remain unbuilt and are deferred to a future, separately approved phase, alongside notifications (Phase 12) and the other post-MVP items already tracked in `docs/DECISION_LOG.md`.

## Phase 9 — MVP Release Readiness and Friendly Failure Handling ✅ Completed

- **Objective:** Prepare the already-built MVP for a safe production setup and a controlled pilot — no new help-desk feature, and no live infrastructure change.
- **Included scope:**
  - Friendly, plain-language states for every unexpected-error, not-found, access-denied, authentication-unavailable, and empty-list case, using one small shared component (`src/components/friendly-state.tsx`) rather than a design system: a root `error.tsx` (segment-level error boundary), `global-error.tsx` (root-layout crash fallback), and a root `not-found.tsx`, plus the existing `/support` and `/admin` access-denied blocks and the ticket-specific not-found pages refactored onto the same component. No stack trace, SQL error, environment-variable name, provider error, internal UUID, or secret is ever shown to a user.
  - Sign-in copy that clearly states the system is for TEACH staff, requires a TEACH `@teachps.org` Google Workspace account, does not permit personal Google accounts, and that staff can request IT or Facilities help once signed in — plus a friendly, retryable failure state if starting sign-in fails client-side, and the existing "configuration pending" state preserved when authentication isn't configured.
  - A safe environment-readiness command (`npm run readiness:check`, `src/config/readiness.ts`) that inspects `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` for structural validity and prints a `ready`/`not configured`/`invalid` checklist — never a value — with a clear nonzero exit code on any failure. Deliberately excluded from `npm run check` since CI runs without production secrets.
  - A guarded first-system-administrator bootstrap command (`npm run admin:bootstrap`, `src/admin/bootstrap.ts`) defaulting to a dry run, requiring `--apply` with a matching `--confirm-email` for a real change, accepting only an exact normalized `@teachps.org` address, requiring the target to already exist (from a real sign-in), be active, and belong to the canonical TEACH organization, never creating a user or changing an organization, and idempotent if the target is already a system administrator.
  - `docs/DEPLOYMENT.md` (the full sequential production setup order) and `docs/PILOT_CHECKLIST.md` (a short authentication/requester/support/administration/usability checklist with a tester/date/result/issue/follow-up recording table).
  - A final usability/accessibility verification pass across all nine routes, correcting two small gaps found: `/account` had no shared navigation (added `src/app/account/layout.tsx`), and the Google sign-in button had no failure handling if starting sign-in failed client-side (added a friendly, retryable error state).
- **Explicit exclusions:** Any new help-desk feature (notifications, attachments, internal notes, reports, search, SLA calculations, additional departments/roles/categories/locations, integrations, AI features, demo data); any live infrastructure change (a real production database, Google Cloud OAuth client, or Vercel environment variable); any real user, ticket, or administrator; running the bootstrap command against a real database; and actually executing the pilot checklist.
- **Completion gate:** Every friendly state shows plain language with no internal detail; the readiness command never prints a supplied secret value and exits nonzero on missing/invalid configuration; the bootstrap command never mutates data without explicit `--apply`+`--confirm-email`, never creates a user, never changes an organization, and is idempotent; all existing requester/support/administration workflows and the secretless build remain green.
- **Status:** Code-side MVP release readiness complete — live infrastructure, OAuth acceptance, first-administrator bootstrap, and pilot execution deferred.

### Deferred From the Original Phase 9 Slot (Post-MVP Backlog)

An earlier draft of this plan tentatively named the Phase 9 slot "Principal Campus Visibility" — giving principals a nonconfidential, campus-scoped view of tickets (a campus dashboard/list view with server-side enforcement of the nonconfidential/campus-scope boundary, excluding leadership aggregate views and confidential-ticket access of any kind, gated on cross-role and cross-campus data-leak tests including direct URL/ID manipulation attempts). This remains unbuilt and is deferred to a future, separately approved phase, alongside the other post-MVP items already tracked in `docs/DECISION_LOG.md`.

## Phase 9A — Configurable Invite-Only Pilot Access ✅ Completed

- **Objective:** Let the owner and selected testers use the completed application now, with ordinary Google accounts, without permanently restricting the application to TEACH Google Workspace — while preserving the strict TEACH Workspace option for later.
- **Included scope:**
  - Two explicit authentication-access modes selected by `AUTH_ACCESS_MODE`: `invite_only` (any verified Google account, gated by a database invitation, no `AUTH_ALLOWED_DOMAIN`/`hd` hint) and `workspace` (the original strict `@teachps.org`-exact behavior, unchanged). A missing, unknown, or incomplete value fails closed — never a permissive default.
  - One minimal `auth_invitations` table (migration `0005`, forward-only, does not modify `0000`–`0004`): normalized email, `pending`/`accepted`/`revoked` status with a `CHECK`-enforced shape, a partial unique index limiting only pending rows per email, no seed data, and history that is never destructively deleted. The same migration relaxes `user`'s email `CHECK` constraint from `@teachps.org`-exact to domain-agnostic (verified/lowercased/well-formed, any domain), since domain eligibility is now an application-layer decision selected by the active mode.
  - Invite-only provisioning: the existing `databaseHooks.user.create.before`/`after` hooks (`src/auth/auth-options.ts`) deny a noninvited or revoked address (aborting user creation entirely) and mark a pending invitation accepted once its first sign-in succeeds — idempotent under retry, and never granting agent/administrator access.
  - A guarded `npm run access:invite` CLI (`src/auth/invite-bootstrap.ts`) mirroring `admin:bootstrap`'s exact safeguard shape: dry-run default, `--apply` + matching `--confirm-email`, requires `AUTH_ACCESS_MODE=invite_only` and `DATABASE_MIGRATION_URL`, never creates a user, idempotent, and never silently reactivates a revoked invitation.
  - An admin-authorized "Pilot Invitations" section on `/admin` (`src/admin/invitations.ts`), visible only in invite-only mode: create/list/revoke a pending invitation, using the existing `administer` authorization action — no new roles or permissions framework, no invitation email sent, no internal id/token displayed.
  - `admin:bootstrap` updated to apply mode-specific eligibility: an exact `AUTH_ALLOWED_DOMAIN` address in workspace mode; a linked Google account and an accepted invitation (no domain requirement) in invite-only mode — in both modes, still a dry-run-by-default, `--apply`+`--confirm-email`-guarded, user-creation-free, idempotent command.
  - `/sign-in` (and the home page) wording now matches the active mode — invite-only mode never claims a `@teachps.org` requirement; workspace mode is unchanged.
  - `npm run readiness:check` extended with an "Access mode" checklist item validating `AUTH_ACCESS_MODE`/`AUTH_ALLOWED_DOMAIN` per mode, never printing either value.
- **Explicit exclusions:** Email/password authentication, magic links, additional social providers, an email allowlist, public self-registration, a development login or shared demo account, any authentication bypass, any seeded invitation/agent/administrator, any new ticket feature, department, or role, and any live infrastructure change (a real production database, Google Cloud project, OAuth credentials, Vercel environment variable, real invitation, or real administrator).
- **Completion gate:** Both access modes build and pass their full test suite against synthetic data only; migrations `0000`–`0004` remain byte-identical and exactly one new migration (`0005`) is added; the invitation lifecycle (create/accept/revoke) and both administrator-bootstrap eligibility paths are exercised against a real (synthetic) PGlite database, including the actual Better Auth provisioning hooks; the secretless build and all existing requester/support/administration workflows remain green.
- **Status:** Code-side invite-only pilot access complete — live infrastructure, a real Google OAuth client (of either kind), a real invitation, and a real administrator bootstrap all remain deferred, separately approved operational steps.

## Phase 9B — Temporary Public Ticket Intake ✅ Completed

- **Objective:** Let real IT/Facilities requests continue arriving while Google OAuth credentials are not yet configured in production, without weakening any existing authorization guarantee.
- **Included scope:**
  - A new `PUBLIC_TICKET_INTAKE` flag (`src/public-intake/env.ts`), enabled only by the exact literal value `"true"`, failing closed for any other value or absence, independent of `AUTH_ACCESS_MODE`.
  - `/requests/new` renders a public form for a signed-out visitor only when the flag is on; an active authenticated actor always sees today's unchanged form, and the disabled-flag path is byte-for-byte the same redirect-to-sign-in behavior as before Phase 9B.
  - A reserved, permanently inactive "Public Intake" system user (`REFERENCE_PUBLIC_INTAKE_USER`), seeded idempotently by `seedReferenceData()`, used only as the fixed requester/activity-actor for public tickets — no Better Auth account, session, or credential of any kind, preserving `tickets.requester_id`'s non-null invariant without weakening it.
  - `tickets` gains a `submission_source` column (`'authenticated'` \| `'public'`, `CHECK`-enforced, defaulting `'authenticated'`) and nullable `public_requester_name`/`public_requester_email` snapshot columns (migration `0006`, forward-only, does not modify `0000`–`0005`).
  - A separate `src/tickets/public-intake-service.ts` service boundary (`createPublicTicket`) with no `ResolvedActor` concept and no `authorize()` call — `ticket-service.ts`'s `createTicket` and its authorization guarantees are completely unmodified.
  - A durable, concurrency-safe rate limiter (`public_intake_rate_limits` table, a single atomic upsert per fixed one-hour window) keyed by an HMAC-SHA256 fingerprint of a resolved client IP under a separate `PUBLIC_INTAKE_RATE_LIMIT_SECRET` (≥32 characters) — never storing a raw IP address, and failing closed if the durable check cannot run.
  - A visually hidden honeypot field on the public form; a completed submission creates no ticket and receives the same generic confirmation as a real success.
  - A public confirmation page (`/requests/new/submitted`) that performs no database query at all — it only format-validates and displays the `ticket` query parameter, so a ticket number can never function as an authorization token.
  - Home-page and `/requests/new` copy updates: a "Submit a ticket" call to action, sign-in-temporarily-not-required messaging, a sensitive-information privacy warning, and continued "unavailable until configured" framing for My Requests/Support Queue/Administration.
  - `npm run readiness:check` extended with a "Public ticket intake" item; overall readiness now requires the database/secret/origin configuration plus **either** Google OAuth + Access mode ready **or** Public ticket intake ready.
- **Explicit exclusions:** Any weakening of `requireActiveActor`/`resolveActor`/`authorize()`; any change to `/requests`, `/requests/[ticketNumber]`, `/support`, `/admin`, or `/account`'s existing authentication requirement; making `tickets.requester_id` nullable; any in-memory-only rate limiter; any new dependency for HMAC (Node's built-in `crypto` only); logging of names, emails, descriptions, IP addresses, or form bodies; and any live infrastructure change (a real production database, Google Cloud project, OAuth credentials, or Vercel environment variable).
- **Completion gate:** The full test suite (unit and PGlite-backed integration) passes against synthetic data only, covering flag parsing, anonymous route access (allowed only when enabled, and only for `/requests/new`/`/requests/new/submitted`), valid/invalid public submissions, organization/requester-id override attempts, honeypot behavior, rate-limit concurrency and fail-closed configuration, and that a ticket number alone grants no access; migrations `0000`–`0005` remain byte-identical and exactly one new migration (`0006`) is added; every existing requester/support/administration workflow and test remains green.
- **Status:** Code-side temporary public ticket intake complete — live infrastructure (a real production database, Google Cloud project, OAuth credentials, and the Vercel `PUBLIC_TICKET_INTAKE`/`PUBLIC_INTAKE_RATE_LIMIT_SECRET` variables) all remain deferred, separately approved operational steps.

## Phase 10 — SLA Calculations and Dashboards

- **Objective:** Implement the business-hours-aware service-level calculation engine and role-appropriate dashboards.
- **Included scope:** Business calendar engine (hours, weekends, holidays), pause logic for Waiting for Requester/Vendor, aging/escalation flags, requester/department/principal/leadership dashboards.
- **Explicit exclusions:** Email notifications, attachments.
- **Completion gate:** A clock/calendar test suite passes and dashboard metric definitions are documented and approved.

## Phase 11 — Controlled Workflow-Validation Pilot

- **Objective:** Run a limited pilot with real IT and Facilities users across representative campuses before expanding scope.
- **Included scope:** Pilot cohort selection, observation of real usage, category/routing refinements, accessibility/security/performance QA, a support runbook.
- **Explicit exclusions:** Email notifications, attachment integration (both remain deferred until after this pilot).
- **Completion gate:** Pilot sign-off from the product owner and completion of any prioritized fixes it surfaces.

## Phase 12 — Email Notifications

- **Objective:** Add transactional email notifications after the core workflow is validated.
- **Included scope:** Safe email templates (no sensitive content in subject/body), event-based triggers, delivery jobs with retry, authenticated links back to the ticket.
- **Explicit exclusions:** Reply-by-email (remains deferred beyond this phase).
- **Completion gate:** The email event matrix passes with no sensitive-content leakage in any notification.

## Phase 13 — Secure Attachment Integration

- **Objective:** Add file attachments backed by a TEACH-owned, restricted Google Shared Drive.
- **Included scope:** Server-mediated upload/download, authorization check before every file access, malware scanning, file-type/size allowlist, retention metadata.
- **Explicit exclusions:** Any form of public or "anyone with the link" sharing.
- **Completion gate:** Authorized-access tests pass and unauthorized direct file access fails; audit events persist for every access.

## Phase 14 — Administrative Configuration Tools

- **Objective:** Build the admin surfaces for ongoing operation: catalog management, routing-rule builder/tester, business-calendar configuration, audit explorer.
- **Included scope:** Admin UI for catalog, routing rules with validation, business calendars, and audit log filtering/export.
- **Explicit exclusions:** New end-user-facing ticket features.
- **Completion gate:** A production-readiness review, including backup/restore testing and monitoring, is complete.

## Phase 15 — Additional Departments and Tailored Workflows

- **Objective:** Extend the platform to additional departments (e.g., Academic Support, Business Office, Human Resources, Student Services, Communications, School Operations, Data and Compliance), one at a time.
- **Included scope:** Per-department catalog, permissions, form fields, approvals, and service targets, each with its own acceptance and sign-off.
- **Explicit exclusions:** Departments not yet approved for sequencing.
- **Completion gate:** Each department passes its own acceptance criteria before the next department begins.

## Phase 16 — Advanced Operations and Carefully Controlled AI Assistance

- **Objective:** Introduce advanced operational tooling and any AI-assisted features, strictly as advisory aids.
- **Included scope:** Advanced reporting, recurring-issue detection (descriptive only), and any AI assistance — always advisory, never autonomous over disciplinary, employment, student-service, or safety decisions.
- **Explicit exclusions:** Any AI feature that makes or automates a disciplinary, employment, student-service, or safety decision.
- **Completion gate:** Explicit leadership sign-off on the scope and guardrails of any AI feature before it ships.

---

## Requirements for Every Future Claude Code Prompt

Each future Claude Code prompt against this repository must:

- Address only **one small, approved phase or subphase** — never combine phases or get ahead of approval.
- **Inspect the current repository** before changing it (files, branch, git status, existing documentation).
- **Preserve existing work** — never overwrite or discard prior validated work without explicit instruction.
- **Use environment variables for secrets** — never hard-code credentials.
- **Never place real credentials or sensitive records** in fixtures, documentation, logs, screenshots, or source code — synthetic/test data only.
- **Run the relevant validation commands** for the work performed (lint, type check, tests, migrations, etc., as applicable to that phase).
- **Summarize files changed and validation results** at the end of the response.
- **Stop after completing the assigned scope** — end with a clear statement that implementation does not proceed beyond the approved step until the next prompt is given.
