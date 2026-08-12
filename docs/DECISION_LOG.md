# TEACH Ticket System — Decision Log

This log records confirmed architectural and service-design decisions, along with decisions that remain open. Confirmed entries use the date the decision was recorded. Status values are `Confirmed`, `Proposed`, or `Superseded`.

## Confirmed Decisions

| ID | Date | Decision | Status | Rationale | Revisit Trigger |
|---|---|---|---|---|---|
| D-001 | 2026-08-12 | IT and Facilities are the MVP departments. | Confirmed | These two departments generate the highest current volume of informal requests and have clear, well-understood workflows to model the core platform on. | Leadership decides to sequence a different department first. |
| D-002 | 2026-08-12 | Authentication uses Google Workspace, restricted to verified `@teachps.org` accounts. | Confirmed | TEACH already provisions staff through Google Workspace; reusing it avoids a second identity system and keeps access tied to employment status. | TEACH changes identity provider or domain strategy. |
| D-003 | 2026-08-12 | `TAT-56` and `TAT-78` are modeled as two separate service locations under one school (TEACH Academy of Technologies). | Confirmed | The two campuses have distinct addresses and grade bands and need independent routing/reporting, even though they share one school identity. | The two campuses are consolidated into a single physical site. |
| D-004 | 2026-08-12 | The Director of IT is the default triage owner for new IT tickets. | Confirmed | Centralizes initial triage accountability while the IT queue is small (three staff). | IT staffing or org structure changes materially. |
| D-005 | 2026-08-12 | The Facilities Plant Manager is the initial Facilities queue owner and resolver. | Confirmed | Facilities currently has one staff member; this reflects actual staffing during the MVP. | Additional Facilities staff are hired. |
| D-006 | 2026-08-12 | Support hours are 7:30 a.m.–4:30 p.m. Pacific Time. | Confirmed | Matches the standard TEACH staff workday for realistic service-target calculation. | TEACH changes standard operating hours. |
| D-007 | 2026-08-12 | Weekends and configured school holidays are excluded from service clocks. | Confirmed | Service targets should reflect working time, not calendar time, so on-call expectations stay realistic. | TEACH adopts weekend or holiday on-call support. |
| D-008 | 2026-08-12 | Principals can view nonconfidential tickets for their assigned campus(es). | Confirmed | Gives campus leadership operational visibility without exposing confidential or cross-campus content. | Leadership changes campus-visibility policy. |
| D-009 | 2026-08-12 | Staff can submit requests on behalf of another employee or campus. | Confirmed | Front-office and support staff frequently submit requests for others; the system must track this accurately rather than misattributing tickets. | Not anticipated; revisit only if abuse patterns emerge. |
| D-010 | 2026-08-12 | The Director of IT and Chief Academic Officer are the initial system administrators. | Confirmed | Matches current organizational accountability for technology and academic operations. | System administrator list is formally revised. |
| D-011 | 2026-08-12 | Email notifications will be added immediately after the core workflow is validated, not in the initial MVP. | Confirmed | Avoids building a "shadow workflow" in email before the in-app experience is proven; keeps sensitive content out of inboxes until the model is settled. | Pilot feedback indicates email is required earlier. |
| D-012 | 2026-08-12 | Attachments are intended for a TEACH-owned, restricted Google Shared Drive — never an individual employee's personal Drive. | Confirmed | Keeps attachment ownership and access control with the organization rather than an individual account. | TEACH changes its file-storage platform. |
| D-013 | 2026-08-12 | Configuration access and confidential-content access are separate permissions. | Confirmed | A system administrator configuring the platform should not automatically be able to read confidential ticket content. | Not anticipated; revisit only if this proves operationally unworkable. |
| D-014 | 2026-08-12 | The project will be implemented in small, approved phases. | Confirmed | Reduces risk of overbuilding before the core workflow is validated with real users. | Not anticipated; revisit only by explicit leadership direction. |

## Open Decisions

| Item | Notes |
|---|---|
| Final production database and hosting provider | PostgreSQL and Vercel-compatible deployment are the intended direction; the specific managed provider(s) have not been selected. |
| Google OAuth client and deployment ownership | Who owns/administers the Google Cloud OAuth client and production deployment account has not been determined. |
| Exact school holiday calendar administration process | Holidays/closures must exclude from service clocks, but who maintains the calendar and how it is entered/updated is undecided. |
| Attachment retention and deletion schedule | No retention period has been set for uploaded attachments once the attachment feature is built. |
| Maximum attachment file size and permitted file types | No size limit or file-type allowlist has been confirmed. |
| Resolution confirmation period before automatic closure | The window during which a requester may confirm or reopen before a ticket auto-closes has not been finalized. |
| Final notification sender address | The "from" address for outbound email notifications (once built) has not been decided. |
| Production incident and backup procedures | No incident-response runbook or backup/restore procedure exists yet. |
| **⚠️ Security & Governance Review — Whether the repository should remain public before application code or configuration is added** | This item requires an explicit security and governance decision before Phase 1 begins. **No repository visibility change has been made as part of this phase.** |
