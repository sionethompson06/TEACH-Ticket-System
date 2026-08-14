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

## Phase 7 — Department Queues, Assignment, Status History, and Resolution

- **Objective:** Build the department-facing workflow: triage, assignment/reassignment, status transitions, and resolution.
- **Included scope:** Queue views, assignment/reassignment, the full ticket-lifecycle status model, resolution requirements (summary, resolver, timestamp), concurrency protection.
- **Explicit exclusions:** Requester-visible communication features (Phase 8), campus/leadership views (Phase 9).
- **Completion gate:** A ticket can move end-to-end through the lifecycle in the app with correct history and concurrency protection.

## Phase 8 — Requester Communication and Internal Notes

- **Objective:** Add public replies (requester-visible) and internal notes (department-only), with correct visibility enforcement.
- **Included scope:** Public reply threads, internal notes, follower model, @mentions that never implicitly grant access.
- **Explicit exclusions:** Email delivery of communications.
- **Completion gate:** Internal notes never appear in any requester- or principal-facing view or API response, under adversarial testing.

## Phase 9 — Principal Campus Visibility

- **Objective:** Give principals a nonconfidential, campus-scoped view of tickets.
- **Included scope:** Campus dashboard/list view, server-side enforcement of the nonconfidential/campus-scope boundary.
- **Explicit exclusions:** Leadership aggregate views (Phase 10), confidential-ticket access of any kind.
- **Completion gate:** Cross-role and cross-campus data-leak tests pass, including direct URL/ID manipulation attempts.

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
