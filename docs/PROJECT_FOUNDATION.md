# TEACH Ticket System — Project Foundation

This document records the confirmed organizational and service-design requirements for the TEACH Ticket System. It is the reference for all later implementation phases. Nothing in this document implies that any of it has been built yet — see [`PHASE_PLAN.md`](PHASE_PLAN.md) for what is actually in progress.

## 1. Locations

The system recognizes the following service locations:

| Code     | Name                                                 | Grades / Function | Address                                    |
| -------- | ---------------------------------------------------- | ----------------- | ------------------------------------------ |
| `TPE`    | TEACH Prep Elementary School                         | TK–5              | 8505 S Western Ave, Los Angeles, CA 90047  |
| `TAT-56` | TEACH Academy of Technologies — 5–6 Campus           | 5–6               | 10000 S Western Ave, Los Angeles, CA 90047 |
| `TAT-78` | TEACH Academy of Technologies — 7–8 Campus           | 7–8               | 10045 S Western Ave, Los Angeles, CA 90047 |
| `TTHS`   | TEACH Tech Charter High School                       | 9–12              | 10616 S Western Ave, Los Angeles, CA 90047 |
| `CMO`    | TEACH Public Schools Central Management Organization | Central office    | 10600 S Western Ave, Los Angeles, CA 90047 |
| `SYSTEM` | Multiple campuses / system-wide                      | All               | No single physical address                 |

**`TAT-56` and `TAT-78` are separate service locations belonging to the same middle school** (TEACH Academy of Technologies). They have distinct addresses and serve different grade bands, so they must be selectable and reportable as independent service locations even though they share one school identity. The data model must keep school identity and physical service location distinct so that campus routing and reporting stay accurate.

## 2. Authentication

- **Google Workspace is the identity provider.** Access is restricted to verified `@teachps.org` accounts.
- Google Workspace is the **authoritative identity source**. The application must never generate, guess, or infer staff email addresses (e.g., from naming conventions) — identity always originates from a verified Google Workspace sign-in.
- New authorized users receive the **Requester** role by default. Department and administrative roles always require explicit assignment by an authorized administrator.
- **Authentication and application authorization are separate concerns.** Authentication (Google Workspace) confirms _who_ a person is; authorization (application roles and permissions) governs _what_ they may see or do. One does not imply the other.
- All authorization checks must be enforced **on the server**. Client-side checks (hidden buttons, disabled controls) are a usability convenience only, never a security boundary.
- Passwords, temporary passwords, MFA codes, recovery codes, and other credentials must never be stored or documented anywhere in this system.

## 3. Initial Departments and Staffing

### Information Technology

- Staffing: Director of IT, and two IT Technicians.
- New IT tickets enter a single centralized IT queue.
- The **Director of IT is the default triage owner** for new IT tickets.
- The Director of IT assigns tickets to any of the three IT team members (the Director or either Technician).
- Any authorized IT team member may work on or resolve an IT ticket.
- The system must separately record: **queue owner**, **primary assignee**, **collaborators**, and the **person who resolved** the ticket. These are distinct fields — the resolver is not inferred from the assignee.

### Facilities

- Staffing: Facilities Plant Manager.
- New Facilities tickets enter a single centralized Facilities queue.
- During the MVP, the **Facilities Plant Manager** triages, assigns, works, and resolves Facilities tickets — effectively a queue of one.
- The department-membership model must be built so that additional Facilities personnel (and eventually vendors) can be added later **without a schema redesign**.

### Initial System Administrators

- Director of IT
- Chief Academic Officer

**Configuration authority must not automatically grant access to confidential ticket content.** Being a system administrator makes someone responsible for configuring the platform (users, roles, business calendars, catalog); it does not, by itself, authorize them to read confidential tickets. Confidential access is a separate, explicit grant (see Section 8).

## 4. Initial IT Categories

| Category                                       | Representative Request Types                                                                                                                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Student and Staff Devices                      | Chromebook damaged/not working; staff laptop damaged or slow/freezing; iPad/tablet issue; charging issue; new/replacement device; loaner request or return; lost device; device setup/reassignment; other |
| Accounts, Identity, and Access                 | Google Workspace login issue; MFA issue; Aeries access; Clever access; application permission request; new staff account; access change; account deactivation; Shared Drive/folder access; other          |
| Classroom Technology and Audiovisual Equipment | Interactive display issue; projector issue; document camera issue; speaker/microphone issue; input or cable issue; video conference setup; other                                                          |
| Network and Connectivity                       | Wi-Fi unavailable or slow; wired network issue; educational site blocked; content filtering review; remote access issue; multi-room or campus-wide outage; other                                          |
| Software, Applications, and Subscriptions      | Google Classroom issue; supported platform issue; installation or update request; license request; testing browser issue; application error; new software evaluation request; other                       |
| Printers and Peripherals                       | Printer outage/jam/toner/driver issue; scanner issue; keyboard/mouse/monitor issue; badge or barcode scanner issue; dock/adapter issue; new peripheral request; other                                     |
| IT Onboarding, Moves, and Special Events       | New employee technology setup; employee departure/offboarding; staff or classroom move; classroom setup; testing-event technology support; assembly or special-event technology support; other            |

### Supported Systems (for reference — no credentials documented)

The following systems are within scope for IT technical-access and malfunction support. No account credentials, passwords, or service-account details are recorded here or anywhere in this repository:

- Google Workspace, Gmail, Google Drive, Google Classroom
- Aeries
- ParentSquare
- Clever
- GoGuardian
- Zoom Meetings, Zoom Phone
- MealTime
- McGraw Hill
- NWEA MAP
- Thrively
- Achieve3000
- ALEKS
- TOMS and CAASPP testing systems
- i-Ready
- SmartyAnts
- Vista Higher Learning
- Zingy Learning
- Amplify
- Naviance
- Panorama Education and Solara

**Routing distinction:** technical access or malfunction requests for these systems (cannot log in, feature broken, device not working) route to IT. Instructional-use questions (how to use a feature to teach a lesson, pedagogical guidance) should eventually route to Academic Support once that department launches. Until Academic Support exists, such requests should be given a clear, supported interim path rather than being silently misclassified as IT issues.

## 5. Initial Facilities Categories

| Category                          | Representative Request Types                                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HVAC and Air Quality              | Room too hot/cold; HVAC unit not operating; unusual noise; smoke or burning smell; thermostat issue; filter/air quality concern; other                   |
| Electrical and Lighting           | Interior/exterior light out; outlet issue; breaker tripped; sparking or smoke; power strip approval request; partial outage; other                       |
| Plumbing and Water                | Clogged fixture; active leak; ceiling stain; water fountain/filling station issue; no hot water; sewer odor or backup; flooding; other                   |
| Custodial Services                | Urgent or biohazard spill; trash/recycling overflow; restroom or area cleaning request; graffiti; supply request; other                                  |
| Building Maintenance              | Broken glass; blinds issue; wall/ceiling/floor damage; paint request; furniture repair; cabinet/shelf issue; door issue; general repair; other           |
| Keys, Locks, and Access Control   | Key request, lost, or broken key; badge issue; door schedule change; room/cabinet/locker lock issue; door latch or closer issue; other                   |
| Safety, Security, and Grounds     | Trip, playground, or field hazard; debris; landscaping request; pest issue; parking/crosswalk concern; fence/gate issue; other                           |
| Furniture, Moves, and Event Setup | Tables/chairs request; furniture move; lifting assistance; assembly/testing/board setup; stage, podium, or banner setup; delivery/storage request; other |

### Emergencies Are Not Ticket-Dependent

Active threats, fires, suspected gas leaks, dangerous electrical events, major flooding, medical emergencies, and other emergencies require **immediate emergency procedures** (TEACH emergency protocol and 911 where applicable). A ticket may be created for record-keeping, but it must never be the sole or primary channel for reporting an active emergency, and the system must never imply that submitting a ticket is a sufficient emergency response.

## 6. Ticket Lifecycle

The IT and Facilities departments share one ticket lifecycle model:

| Status                         | Meaning                                                                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Submitted                      | Recorded and routed; not yet reviewed by the department.                                                                            |
| Triaged                        | Department has validated category, impact, sensitivity, and priority.                                                               |
| Assigned                       | A primary assignee has been designated and owns the next action.                                                                    |
| In Progress                    | Active work is underway.                                                                                                            |
| Waiting for Requester          | The department needs a response from the requester before continuing.                                                               |
| Waiting for Vendor             | An external vendor dependency exists.                                                                                               |
| Resolved                       | The department has supplied a resolution summary; awaiting requester confirmation.                                                  |
| Closed                         | The ticket is finished — either the requester confirmed resolution, or the configured confirmation window elapsed without a reopen. |
| Reopened                       | The requester (or authorized staff) reported that the issue was not actually resolved.                                              |
| Canceled                       | The ticket was withdrawn or is no longer needed.                                                                                    |
| Duplicate                      | The ticket duplicates another ticket; linked to the canonical ticket.                                                               |
| Referred to Another Department | The ticket's department/queue changed while its history is preserved.                                                               |
| Converted to Project           | The request has grown beyond normal ticket handling and is being tracked as a larger effort outside the standard SLA model.         |
| Emergency Escalation           | The ticket has been flagged for immediate emergency handling in addition to (never instead of) emergency procedures.                |

**Resolved vs. Closed:** _Resolved_ means the department has finished its work and recorded a resolution summary, but the requester has not yet confirmed it — the ticket is still awaiting requester acknowledgment (or reopen) during a configured confirmation window. _Closed_ means that confirmation step is complete: either the requester actively confirmed the resolution, or the confirmation window elapsed without a reopen. Only a Closed ticket is fully finished; a Resolved ticket can still become Reopened.

**Phase 5 MVP status subset:** The Phase 5 ticket foundation implements a small subset of this table — `submitted`, `in_progress` (folding together Triaged/Assigned/In Progress; the separate `assigned_agent` field already records ownership), `waiting_for_requester`, `resolved`, `closed`, and `reopened` — preserving the Resolved/Closed distinction exactly as documented above. Canceled, Duplicate, Referred to Another Department, Converted to Project, and Emergency Escalation remain deferred to a later phase. In the Phase 5 MVP, Closed is final (no further transition, including reopening); the full confirmation-window/auto-close behavior described above is also deferred.

## 7. Priority and Service Targets

### Support Hours

- 7:30 a.m.–4:30 p.m. Pacific Time.
- Weekends do not count toward service clocks.
- Configured school holidays do not count toward service clocks.

### Targets

| Priority | First Response            | Resolution / Work Target                                   |
| -------- | ------------------------- | ---------------------------------------------------------- |
| Critical | Within 15 support minutes | Attend and begin stabilization immediately                 |
| Urgent   | Within 1 business hour    | Resolve, or establish a documented plan, by end of workday |
| Normal   | Within 4 business hours   | Resolve within 24–48 business hours                        |
| Low      | Within 1 business day     | Resolve within 24–72 business hours                        |

### Rules

- Priority should be **recommended** from a short set of impact and urgency questions, rather than freely selected without validation — this keeps requesters from defaulting everything to "urgent."
- Authorized department staff may override the recommended priority, but a **reason is required** and the override is recorded in history.
- **Waiting for Requester** pauses the applicable internal resolution clock (the wait duration remains visible/reportable, it just does not count against the department).
- **Waiting for Vendor** is measured separately from internal wait time and from ordinary working time.
- Both the **original** target date/time and any **recalculated** target date/time must be preserved — recalculation (e.g., after a pause) must never silently overwrite the original.
- Service targets measure **response and operational handling**, not an unconditional guarantee of resolution. When parts, vendor scheduling, approvals, or other external dependencies are required, the target reflects diligence and transparency, not a promise that is outside TEACH's control.

**Phase 5 MVP status:** The four priority values (Critical, Urgent, Normal, Low) exist on every ticket today. Every new ticket starts at **Normal**; the requester never sets or overrides priority — only an authorized department agent or system administrator may change it, and it is not yet recommended from impact/urgency questions. No SLA target, business-hours calendar, or deadline calculation exists yet (deferred to Phase 10). The system-wide warning in Section 5 that a ticket is never a substitute for emergency procedures applies without exception in this MVP as well.

## 8. Initial Roles

### MVP Access Levels (Phase 4)

The basic help-desk MVP implements exactly three access levels — deliberately simple, so the core ticket workflow can be built and validated before any richer authorization model:

- **Requester** — every authenticated staff user. Can create a ticket, view their own tickets, and comment on their own tickets (server-side foundation implemented in Phase 5; no user interface exists until Phase 6).
- **Department Agent** — a requester who additionally holds an explicit membership in IT, Facilities, or both. Can view, comment on, assign, and update tickets routed to an assigned department, and change ticket status/priority (server-side foundation implemented in Phase 5; no user interface exists until Phase 6).
- **System Administrator** — a single, explicit, database-set flag. Manages departments, locations, categories, and agent access; can view ordinary system activity; corrects configuration problems. No user is seeded as an administrator — the first real administrator is configured later through a separately approved operational step, never by a bootstrap account, email allowlist, or development bypass.

Locations remain important ticket information for **routing and filtering** during the MVP (e.g., which campus a request affects) — they are not yet a separate permission-scoping system.

### Conceptual Roles (Longer-Term Vision — Deferred Beyond the MVP)

The following roles remain the confirmed long-term direction but are **explicitly deferred** until the basic help-desk system (departments, agents, tickets, and the simple administrator flag above) is working:

- **Department Member** — superseded in the MVP by the simpler Department Agent membership above; a richer distinction may return later if needed.
- **Department Manager** — triages, assigns, reassigns, and may override priority within their department, with authority beyond an ordinary agent.
- **Campus Principal or Administrator** — views nonconfidential tickets for their assigned campus(es) (planned for Phase 9 — Principal Campus Visibility).
- **Authorized Confidential-Queue Member** — holds an additive, explicit grant to view specific confidential tickets or queues, separate from ordinary department membership.

Expiring permission grants, campus-specific permission grants, complex capability matrices, advanced authorization audit workflows, and multiple administrator levels are also deferred — see `docs/PHASE_PLAN.md`'s Phase 4 "Deferred Beyond the MVP" list.

### Visibility Rules

- Staff can view: requests they submitted, requests submitted _for_ them, and tickets they are explicitly authorized to follow.
- Staff may submit a request on behalf of another employee, or for a different campus than their own.
- The system must separately record `submitted_by`, `requested_for`, `primary_contact`, `affected_location`, and the list of authorized followers — these are distinct fields, not derived from one another.
- Principals can view **nonconfidential** tickets for their assigned campus(es).
- Principals **cannot** automatically view internal department notes, restricted attachments, confidential tickets, credential-related details, or anything else outside their explicit authorization — campus visibility is not a blanket grant.
- Department members can view tickets routed to the departments and queues in which they hold active membership — not tickets for other departments.
- **Confidential ticket access requires an explicit permission**, separate from ordinary department membership. Being a department member does not automatically make someone a confidential-queue member.
- Changing a URL, ticket ID, or other identifier must never allow unauthorized access (no "security by obscurity" — every read is authorized on the server regardless of how the request arrived).

## 9. Core Security Principles

- **Server-side authorization** — every read and write is authorized on the server; UI-level hiding of a control is never sufficient on its own.
- **Least-privilege access** — grant only the access a role needs, nothing more.
- **Audit history for sensitive actions** — assignment, status, priority, routing, permission, resolution, and configuration changes are attributable and timestamped.
- **Secure session handling** — sessions and tokens are managed with minimum practical lifetime and appropriate protection.
- **No secrets in source control** — no passwords, tokens, API keys, or credentials of any kind in this repository, at any time.
- **No sensitive data in email subject lines** — notification subjects and previews must not leak ticket detail.
- **Secure attachment authorization** — every attachment download must resolve ticket authorization first; no public or "anyone with the link" sharing.
- **FERPA-aware handling of student information** — collect the minimum necessary student data, restrict and audit access to it.
- **Restricted handling of personnel and HR information** — HR-adjacent content requires stricter access controls than general tickets.
- **Accessibility and mobile usability** — the system must be usable on phones and must meet accessibility standards for core flows.
- **Retention and deletion policies to be defined before production** — data retention rules are an open decision (see [`DECISION_LOG.md`](DECISION_LOG.md)) and must be resolved before real tickets are processed in production.
- **Emergency tickets are not a replacement for emergency procedures** — see Section 5.
- **AI must not independently make disciplinary, employment, student-service, or safety decisions** — any AI-assisted feature introduced later is advisory only; humans retain decision authority over these categories.

## 10. Out of Scope for Phase 0

Phase 0 is documentation only. It explicitly does **not** include:

- Application scaffolding
- UI implementation
- Authentication implementation
- Database creation or migrations
- API routes
- Ticket submission
- Dashboards
- Email delivery
- Google Drive API integration
- AI features
- Deployment configuration

These items are addressed in later phases, one at a time, per [`PHASE_PLAN.md`](PHASE_PLAN.md).
