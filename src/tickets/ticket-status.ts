// Pure, framework-agnostic ticket lifecycle definitions. Deliberately a
// small subset of the full documented lifecycle in
// docs/PROJECT_FOUNDATION.md Section 6 — Triaged/Assigned granularity is
// folded into "in_progress" (a ticket's separate assignee field already
// records who owns it), and Waiting for Vendor, Duplicate, Referred to
// Another Department, Converted to Project, and Emergency Escalation are
// deferred to a later phase. The Resolved/Closed distinction is preserved
// exactly as documented.

export const TICKET_STATUSES = [
  "submitted",
  "in_progress",
  "waiting_for_requester",
  "resolved",
  "closed",
  "reopened",
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const INITIAL_TICKET_STATUS: TicketStatus = "submitted";

export const TICKET_PRIORITIES = [
  "low",
  "normal",
  "urgent",
  "critical",
] as const;

export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const DEFAULT_TICKET_PRIORITY: TicketPriority = "normal";

// Hardcoded, non-configurable transition guard — intentionally not a
// generic workflow engine. Encodes exactly the documented rules:
// - "closed" is final in the MVP: no transition out of it at all.
// - "resolved" may move to "reopened" (dispute) or "closed" (finalize).
// - Every other status may move freely among the non-closed, non-resolved
//   states or into "resolved", but never directly into "closed" — a
//   ticket must pass through "resolved" first, matching the documented
//   Resolved-then-Closed relationship.
export function canTransitionTicketStatus(
  current: TicketStatus,
  next: TicketStatus,
): boolean {
  if (current === next) {
    return false;
  }
  if (current === "closed") {
    return false;
  }
  if (current === "resolved") {
    return next === "reopened" || next === "closed";
  }
  return next !== "closed";
}
