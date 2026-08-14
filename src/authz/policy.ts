// Server-only, centralized authorization policy. Deliberately independent
// of Better Auth's initialization (no import of `better-auth` or the auth
// config here) so it can be unit tested with plain synthetic data and no
// Google credentials of any kind. This module makes ticket-access
// decisions in preparation for Phase 5 — it defines no ticket table and
// no ticket route.
//
// Trust boundary: `authorize` never reads a role, membership, or
// organization value from anywhere except the `ResolvedActor` it is given.
// The caller is responsible for producing that actor from a validated
// server session and current database state (see resolve-actor.ts) —
// never from client-supplied input.

export type ResolvedActor =
  | { status: "anonymous" }
  | { status: "user_not_found" }
  | { status: "inactive" }
  | {
      status: "active";
      userId: string;
      organizationId: string;
      isSystemAdministrator: boolean;
      departmentCodes: readonly string[];
    };

// A simple typed stand-in for "the ticket being accessed," used by tests
// and by future Phase 5 code — not a persisted table.
export interface TicketResourceDescriptor {
  organizationId: string;
  requesterId: string;
  departmentCode: string;
}

export type AuthorizationAction =
  | { kind: "create_ticket" }
  | { kind: "access_ticket"; resource: TicketResourceDescriptor }
  | { kind: "manage_ticket"; resource: TicketResourceDescriptor }
  | { kind: "administer" };

// Fails closed: anything not explicitly allowed below is denied, including
// an actor that isn't "active" (anonymous, no matching database user, or
// inactive) and an action kind this function does not recognize.
export function authorize(
  actor: ResolvedActor,
  action: AuthorizationAction,
): boolean {
  if (actor.status !== "active") {
    return false;
  }

  switch (action.kind) {
    case "create_ticket":
      return true;

    case "access_ticket": {
      const { resource } = action;
      if (resource.organizationId !== actor.organizationId) {
        return false;
      }
      if (actor.isSystemAdministrator) {
        return true;
      }
      if (resource.requesterId === actor.userId) {
        return true;
      }
      return actor.departmentCodes.includes(resource.departmentCode);
    }

    // Stricter than access_ticket: managing a ticket (status, priority,
    // assignment) is never granted merely by being the requester who owns
    // it — only a department agent for its department, or a system
    // administrator, may change it.
    case "manage_ticket": {
      const { resource } = action;
      if (resource.organizationId !== actor.organizationId) {
        return false;
      }
      if (actor.isSystemAdministrator) {
        return true;
      }
      return actor.departmentCodes.includes(resource.departmentCode);
    }

    case "administer":
      return actor.isSystemAdministrator;

    default:
      return false;
  }
}

// Actor-shape check, not a resource decision: true when the actor may
// access the Phase 7 support workspace at all (some department
// membership, or system-administrator status) — used to gate /support
// before any per-ticket access_ticket/manage_ticket decision is made, and
// to decide whether the shared navigation shows the Support Queue link.
// An ordinary requester with no department membership is never support
// staff, even though access_ticket already lets them view their own
// tickets elsewhere.
export function isSupportStaff(actor: ResolvedActor): boolean {
  if (actor.status !== "active") {
    return false;
  }
  return actor.isSystemAdministrator || actor.departmentCodes.length > 0;
}
