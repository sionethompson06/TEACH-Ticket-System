# TEACH Ticket System — Pilot Checklist

A short, usable checklist for running a controlled pilot before wider rollout. Use only **fictional** requests and test accounts during the pilot — no real confidential information, and no real facilities/IT incident that needs an actual response. For an active emergency, always follow TEACH emergency procedures directly; never rely on this system.

Complete [`DEPLOYMENT.md`](DEPLOYMENT.md) first. This checklist assumes the application is deployed, at least one system administrator exists, and IT/Facilities agents have been granted access.

## Authentication

- [ ] An authorized TEACH Google Workspace account can sign in successfully.
- [ ] A personal (non-`@teachps.org`) Google account is denied sign-in.
- [ ] Sign Out works and ends the session.
- [ ] Visiting a protected page while signed out redirects to sign-in and returns to the original page afterward.

## Requester Workflow

- [ ] A fictional IT request can be submitted successfully.
- [ ] A fictional Facilities request can be submitted successfully.
- [ ] **My Requests** shows only the signed-in requester's own tickets — no one else's.
- [ ] A ticket's number, status, location, and category are shown in plain, understandable language (no raw codes or enum values).
- [ ] The requester can send a message on their own ticket and see the support team's replies.
- [ ] A closed ticket is read-only — no new message or edit is possible.
- [ ] The Facilities emergency guidance is visible when submitting a Facilities request.

## Support Workflow

- [ ] An IT agent's Support Queue shows only IT tickets.
- [ ] A Facilities agent's Support Queue shows only Facilities tickets.
- [ ] An agent can assign a ticket to themselves or another agent in their department.
- [ ] An agent can update a ticket's status and priority.
- [ ] An agent can reply to a ticket.
- [ ] The requester sees the agent's reply on their own ticket.
- [ ] An agent from the wrong department is denied access to a ticket outside their department.

## Administration

- [ ] A system administrator can add department access (IT or Facilities) to a user.
- [ ] A system administrator can remove department access from a user.
- [ ] Deactivating a user immediately removes their access — a deactivated user cannot sign in to use protected pages.
- [ ] A system administrator cannot deactivate their own account.
- [ ] An ordinary (non-administrator) user cannot access `/admin`.

## Usability

- [ ] The application is usable on both a desktop browser and a mobile-sized screen.
- [ ] Every workflow above can be completed using only the keyboard.
- [ ] Labels and error/success messages are understandable in plain language.
- [ ] No real confidential information (real student, family, or staff data) was used during the pilot.

## Recording Results

Record one row per tester per session tested.

| Tester | Date | Result | Issue | Follow-up owner |
| ------ | ---- | ------ | ----- | --------------- |
|        |      |        |       |                 |
|        |      |        |       |                 |
|        |      |        |       |                 |

- **Result** — Pass, Fail, or Partial.
- **Issue** — a brief description of what went wrong, if anything.
- **Follow-up owner** — who is responsible for the next step, if any.
