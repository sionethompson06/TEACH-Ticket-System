import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from "./labels";
import type { TicketPriority, TicketStatus } from "./ticket-status";

// Pure mapping from a raw ticket_activity row to plain, human-readable
// text — no database access here. previousValue/newValue carry only the
// safe short values the schema documents (a status/priority string, or an
// assignee's user id); assignment display names are resolved by the
// caller and passed in via resolveUserName, since that requires a
// database lookup this module deliberately has no access to.

export type TicketActivityType =
  "created" | "status_changed" | "priority_changed" | "assignment_changed";

export interface ActivityDescriptionInput {
  activityType: TicketActivityType;
  previousValue: string | null;
  newValue: string | null;
  resolveUserName: (userId: string) => string;
}

export function describeTicketActivity(
  input: ActivityDescriptionInput,
): string {
  switch (input.activityType) {
    case "created":
      return "Ticket submitted";

    case "status_changed": {
      const previous =
        TICKET_STATUS_LABELS[input.previousValue as TicketStatus];
      const next = TICKET_STATUS_LABELS[input.newValue as TicketStatus];
      return `Status changed from ${previous} to ${next}`;
    }

    case "priority_changed": {
      const previous =
        TICKET_PRIORITY_LABELS[input.previousValue as TicketPriority];
      const next = TICKET_PRIORITY_LABELS[input.newValue as TicketPriority];
      return `Priority changed from ${previous} to ${next}`;
    }

    case "assignment_changed": {
      const previousName = input.previousValue
        ? input.resolveUserName(input.previousValue)
        : null;
      const newName = input.newValue
        ? input.resolveUserName(input.newValue)
        : null;
      if (previousName && newName) {
        return `Reassigned from ${previousName} to ${newName}`;
      }
      if (newName) {
        return `Assigned to ${newName}`;
      }
      if (previousName) {
        return `Unassigned from ${previousName}`;
      }
      return "Unassigned";
    }

    default:
      return "Ticket updated";
  }
}
