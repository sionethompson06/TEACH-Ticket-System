// A single generic authorization error for every "you may not do this"
// outcome — including a ticket that simply doesn't exist. The message is
// deliberately the same in both cases, so a caller can never learn from
// the error alone whether an inaccessible ticket exists at all.
export class TicketAuthorizationError extends Error {
  constructor() {
    super("This ticket is not available.");
    this.name = "TicketAuthorizationError";
  }
}

// Raised for a problem with the request's own input (blank content, an
// inactive or mismatched category/department/location, an ineligible
// assignee, an invalid status transition). Unlike TicketAuthorizationError,
// a specific message here is safe and helpful: the caller is already
// authorized to attempt the operation on this ticket.
export class TicketValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TicketValidationError";
  }
}
