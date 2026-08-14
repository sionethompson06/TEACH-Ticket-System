// Mirrors src/tickets/errors.ts: one generic authorization error for every
// "you may not do this" outcome, and a separate validation error whose
// message is safe to show directly because the caller was already
// authorized to attempt the operation.

export class AdminAuthorizationError extends Error {
  constructor() {
    super("You do not have access to this action.");
    this.name = "AdminAuthorizationError";
  }
}

export class AdminValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminValidationError";
  }
}
