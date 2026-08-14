import type { TicketPriority, TicketStatus } from "./ticket-status";

// Staff-friendly display text for internal database values. Keep these in
// the UI; never show a raw status/priority enum value to a requester.
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  submitted: "Received",
  in_progress: "In progress",
  waiting_for_requester: "Waiting for you",
  resolved: "Resolved",
  reopened: "Reopened",
  closed: "Closed",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Low",
  normal: "Normal",
  urgent: "Urgent",
  critical: "Critical",
};
