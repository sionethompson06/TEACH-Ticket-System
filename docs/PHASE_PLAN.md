# TEACH Ticket System — Phase Plan

This document lays out the planned implementation phases for the TEACH Ticket System. **It is a plan, not an implementation.** No phase beyond Phase 0 has been started. Each phase must be explicitly approved before work begins, and each phase's Claude Code prompt must stop at its stated boundary.

## Phase 0 — Project Foundation and Service-Design Documentation

- **Objective:** Establish the written organizational, service-design, and decision-tracking foundation the rest of the project will build on.
- **Included scope:** `README.md`, `docs/PROJECT_FOUNDATION.md`, `docs/DECISION_LOG.md`, `docs/PHASE_PLAN.md`, and a preliminary `.gitignore`.
- **Explicit exclusions:** Application scaffolding, UI, authentication, database, API routes, ticket submission, dashboards, email delivery, Drive integration, AI features, deployment configuration.
- **Completion gate:** All four documentation files and the `.gitignore` exist, accurately reflect confirmed requirements, and contain no secrets or invented facts.

## Phase 1 — Application Scaffold and Development-Quality Baseline

- **Objective:** Stand up an empty, deployable Next.js/TypeScript application shell with a working development and quality-check baseline.
- **Included scope:** Next.js/TypeScript project structure, linting, formatting, type checking, a minimal health/status page, test framework setup, environment-variable pattern (no real secrets).
- **Explicit exclusions:** Database connectivity, authentication, business logic, ticket data model, UI beyond a minimal shell.
- **Completion gate:** The app builds, runs locally, passes lint/type checks, and deploys a preview with no functional features yet.

## Phase 2 — Database Foundation and Seed Data

- **Objective:** Introduce PostgreSQL, migrations, and a seeded, non-sensitive reference dataset (organizations, schools, service locations).
- **Included scope:** Database provider connection pattern, migration tooling, core reference tables, seed scripts using only synthetic/non-sensitive data.
- **Explicit exclusions:** User accounts, authentication, ticket tables, department workflow tables.
- **Completion gate:** Migrations run cleanly against a fresh database; seeded reference data matches `PROJECT_FOUNDATION.md`.

## Phase 3 — Google Workspace Authentication and User Provisioning

- **Objective:** Allow verified `@teachps.org` accounts to sign in, and provision a Requester-role profile on first sign-in.
- **Included scope:** Google Workspace OAuth/OIDC sign-in, domain/verification checks, session handling, first-login user provisioning.
- **Explicit exclusions:** Role/permission enforcement beyond default Requester, department or admin role assignment, ticket features.
- **Completion gate:** Only verified `@teachps.org` accounts can sign in; personal/unverified accounts are denied; negative tests pass.

## Phase 4 — Server-Enforced Roles and Permissions

- **Objective:** Build the central authorization layer: roles, permissions, department membership, campus grants, and confidential-access grants.
- **Included scope:** Role/permission data model, server-side authorization checks, admin-assignable role grants, audit events for permission changes.
- **Explicit exclusions:** Ticket data model, UI for ticket workflows.
- **Completion gate:** Table-driven authorization tests pass for every role/capability combination, including denial cases.

## Phase 5 — IT and Facilities Request Catalog

- **Objective:** Model the configurable Department → Category → Request Type catalog and seed it with the IT and Facilities categories from `PROJECT_FOUNDATION.md`.
- **Included scope:** Catalog data model, conditional form-field schema, seeded categories/request types for IT and Facilities.
- **Explicit exclusions:** Ticket submission, routing logic, priority calculation.
- **Completion gate:** An administrator can inspect the seeded catalog; no end-user ticket workflow exists yet.

## Phase 6 — Ticket Submission and Routing

- **Objective:** Allow a requester to submit an IT or Facilities ticket, with automated routing to the correct department/queue and a recommended priority.
- **Included scope:** Guided intake form, requested-for/primary-contact model, safety acknowledgment for flagged categories, routing-rule engine, priority recommendation, ticket numbering.
- **Explicit exclusions:** Department triage/assignment workflow beyond initial routing, dashboards.
- **Completion gate:** Representative IT and Facilities scenarios route to the correct department/queue with correct recommended priority.

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
