# TEACH Ticket System

A secure, easy-to-use, system-wide service-request platform for TEACH Public Schools.

## Purpose

TEACH Ticket System gives every TEACH staff member one place to submit, track, and communicate about service requests. It routes each request to the correct department, preserves a complete communication and work history, calculates working-time service targets, and gives department staff and leadership real-time visibility into queues and performance — replacing informal and fragmented request channels with a single system of record.

## Initial Launch Scope

The first operational release supports two departments:

- **Information Technology**
- **Facilities**

## Long-Term Vision

The platform is designed as a system-wide service-request foundation. Beyond IT and Facilities, the architecture must support additional departments — including Academic Support, Business Office, Human Resources, Student Services, Communications, School Operations, and Data and Compliance — without redesigning the core ticket system. Each new department will be introduced with its own catalog, permissions, fields, and workflow, layered on top of the same shared platform.

## Current Project Status

**Phase 7 — IT and Facilities Support Workspace.**

Phase 0 established the project's written foundation; Phase 1 added a minimal, feature-empty Next.js/TypeScript application shell; Phase 2 added a provider-neutral PostgreSQL schema and canonical reference data; Phase 3 added Google Workspace sign-in restricted to verified `@teachps.org` accounts, with first-login provisioning of a fixed, nonprivileged **Requester** profile (external OAuth configuration and live sign-in acceptance remain a deferred, separately approved operational step); Phase 4 added a minimal Requester/Department-Agent/System-Administrator access-control model; Phase 5 added the database and server-service foundation for a basic help-desk ticket (seeded IT/Facilities categories, a `tickets` table with a database-generated human-friendly number such as `TKT-000001`, a documented status/priority set, append-only public comments, a ticket-activity log, and a server-only ticket service enforcing the Phase 4 authorization model); Phase 6 added the requester experience — sign in, **Request Help**, **My Requests**, and **Send Message**. Phase 7 adds the IT/Facilities support workspace: an authorized department agent or system administrator can now see a **Support Queue** of active tickets for their own department(s), open one, read the conversation, reply, assign it, and change its status and priority — all re-checked against the Phase 4/5 authorization rules server-side, exactly like every requester action. An ordinary requester never sees the Support Queue link and cannot reach it directly. A closed ticket is final: no further replies, reassignment, or status/priority changes are accepted, enforced in the service layer on both the support and requester sides. **No dashboards, SLA timers, internal notes, or admin configuration pages exist yet — those remain later, separately approved phases — and Google Workspace live OAuth acceptance remains a deferred, separately approved operational step.** See [`docs/DATABASE.md`](docs/DATABASE.md) for the ticket data model, [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md) for the authentication foundation, and [`docs/PHASE_PLAN.md`](docs/PHASE_PLAN.md) for what comes next.

## Prerequisites

- Node.js 24 (LTS) — see [`.nvmrc`](.nvmrc)
- npm

## Quick Start

```bash
npm ci
npm run dev
```

The app runs at http://localhost:3000.

## Quality Check

```bash
npm run check
```

Runs formatting verification, linting, type checking, and the test suite. See [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) for the full command reference, environment-file rules, and CI details.

## Future Technical Direction (High-Level)

The following direction is documented for planning purposes and will be implemented incrementally in later, approved phases:

- **Next.js** web application
- **TypeScript** throughout
- **PostgreSQL** as the primary database
- **Google Workspace** authentication (restricted to verified `@teachps.org` accounts) — implemented in Phase 3
- **Server-enforced, role-based authorization** (never trust client-side checks alone) — a minimal Requester/Department-Agent/System-Administrator model is implemented (Phase 4); richer authorization (department managers, campus/principal access, confidential-queue grants) remains deferred
- **Vercel** deployment
- **Secure Google Shared Drive attachment integration**, added only after the core workflow has been validated

## Security Statement

Credentials, passwords, temporary passwords, recovery codes, access tokens, student-sensitive information, and other secrets must **never** be committed to this repository — not in source code, configuration, fixtures, documentation, logs, or screenshots. Secrets belong in environment variables and managed secret storage only.

## Documentation

- [`docs/PROJECT_FOUNDATION.md`](docs/PROJECT_FOUNDATION.md) — organizational and service-design requirements (locations, authentication model, departments, categories, ticket lifecycle, priorities, roles, and security principles)
- [`docs/DECISION_LOG.md`](docs/DECISION_LOG.md) — confirmed decisions and open decisions requiring future resolution
- [`docs/PHASE_PLAN.md`](docs/PHASE_PLAN.md) — the full phased implementation roadmap, from foundation through additional departments
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — local development setup, quality commands, and CI details
- [`docs/DATABASE.md`](docs/DATABASE.md) — PostgreSQL schema, migration workflow, and canonical reference data
- [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md) — Google Workspace sign-in, identity verification, sessions, and first-login provisioning

## Implementation Approach

Implementation must proceed **one approved phase at a time**. Each phase is scoped, reviewed, and completed before the next phase begins — no phase may assume work beyond what has been explicitly approved.
