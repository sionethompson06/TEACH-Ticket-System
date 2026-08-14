// Single source of truth for content-length limits, shared by the database
// schema's CHECK constraints (src/db/schema/tickets.ts,
// src/db/schema/ticket-comments.ts) and the ticket service's application-
// level validation (src/tickets/ticket-service.ts), so the two can never
// silently drift apart.

export const MAX_SUBJECT_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 4000;
export const MAX_COMMENT_LENGTH = 4000;
