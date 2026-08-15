import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import {
  REFERENCE_ORGANIZATION,
  REFERENCE_PUBLIC_INTAKE_USER,
} from "../db/reference-data";
import * as schema from "../db/schema";
import {
  departments,
  serviceLocations,
  ticketActivity,
  ticketCategories,
  tickets,
} from "../db/schema";
import { TicketValidationError } from "./errors";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_PUBLIC_REQUESTER_EMAIL_LENGTH,
  MAX_PUBLIC_REQUESTER_NAME_LENGTH,
  MAX_SUBJECT_LENGTH,
} from "./limits";
import type { Ticket } from "./ticket-service";
import {
  DEFAULT_TICKET_PRIORITY,
  INITIAL_TICKET_STATUS,
} from "./ticket-status";

// A separate service boundary from ticket-service.ts's createTicket(), by
// design: this module has no concept of a ResolvedActor and never performs
// an authorize() check, because there is no authenticated actor to check —
// only the route/feature-flag layer decides whether this function is ever
// reachable at all. Every ticket created here is hardcoded to the fixed
// TEACH organization and the reserved Public Intake system user; there is
// no parameter through which a caller (or a compromised client) could name
// a different organization or requester.

type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

// A generic, domain-agnostic email shape check — deliberately not
// restricted to any particular domain, since a public requester may use
// any personal or work email address.
const EMAIL_SHAPE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PublicTicketIntakeInput {
  requesterName: string;
  requesterEmail: string;
  departmentId: string;
  serviceLocationId: string;
  categoryId: string;
  subject: string;
  description: string;
}

function assertNonBlankWithinLength(
  value: string,
  fieldLabel: string,
  maxLength: number,
): void {
  if (value.trim().length === 0) {
    throw new TicketValidationError(`${fieldLabel} is required.`);
  }
  if (value.length > maxLength) {
    throw new TicketValidationError(
      `${fieldLabel} must be ${maxLength} characters or fewer.`,
    );
  }
}

function normalizeRequesterName(rawName: string): string {
  const trimmed = rawName.trim();
  if (trimmed.length === 0) {
    throw new TicketValidationError("Your name is required.");
  }
  if (trimmed.length > MAX_PUBLIC_REQUESTER_NAME_LENGTH) {
    throw new TicketValidationError(
      `Your name must be ${MAX_PUBLIC_REQUESTER_NAME_LENGTH} characters or fewer.`,
    );
  }
  return trimmed;
}

function normalizeRequesterEmail(rawEmail: string): string {
  const trimmed = rawEmail.trim().toLowerCase();
  if (trimmed.length === 0 || !EMAIL_SHAPE_PATTERN.test(trimmed)) {
    throw new TicketValidationError("Enter a valid email address.");
  }
  if (trimmed.length > MAX_PUBLIC_REQUESTER_EMAIL_LENGTH) {
    throw new TicketValidationError(
      `Your email must be ${MAX_PUBLIC_REQUESTER_EMAIL_LENGTH} characters or fewer.`,
    );
  }
  return trimmed;
}

// Creates a ticket for an unauthenticated public submitter. The requester
// is always the fixed, reserved Public Intake system user, and the
// organization is always the fixed TEACH organization — input never
// supplies either. The requester's name/email are stored only as
// ticket-level snapshots (for support staff to contact later), never as an
// application user, and never returned to a public caller beyond the new
// ticket's number.
export async function createPublicTicket(
  db: Database,
  input: PublicTicketIntakeInput,
): Promise<Ticket> {
  const requesterName = normalizeRequesterName(input.requesterName);
  const requesterEmail = normalizeRequesterEmail(input.requesterEmail);
  assertNonBlankWithinLength(input.subject, "Subject", MAX_SUBJECT_LENGTH);
  assertNonBlankWithinLength(
    input.description,
    "Description",
    MAX_DESCRIPTION_LENGTH,
  );

  const [department] = await db
    .select()
    .from(departments)
    .where(
      and(
        eq(departments.id, input.departmentId),
        eq(departments.organizationId, REFERENCE_ORGANIZATION.id),
        eq(departments.isActive, true),
      ),
    );
  if (!department) {
    throw new TicketValidationError("The selected department is not valid.");
  }

  const [category] = await db
    .select()
    .from(ticketCategories)
    .where(
      and(
        eq(ticketCategories.id, input.categoryId),
        eq(ticketCategories.departmentId, department.id),
        eq(ticketCategories.isActive, true),
      ),
    );
  if (!category) {
    throw new TicketValidationError(
      "The selected category does not belong to the selected department.",
    );
  }

  const [serviceLocation] = await db
    .select()
    .from(serviceLocations)
    .where(
      and(
        eq(serviceLocations.id, input.serviceLocationId),
        eq(serviceLocations.organizationId, REFERENCE_ORGANIZATION.id),
        eq(serviceLocations.isActive, true),
      ),
    );
  if (!serviceLocation) {
    throw new TicketValidationError(
      "The selected service location is not valid.",
    );
  }

  return db.transaction(async (tx) => {
    const [ticket] = await tx
      .insert(tickets)
      .values({
        organizationId: REFERENCE_ORGANIZATION.id,
        requesterId: REFERENCE_PUBLIC_INTAKE_USER.id,
        departmentId: department.id,
        serviceLocationId: serviceLocation.id,
        categoryId: category.id,
        subject: input.subject,
        description: input.description,
        status: INITIAL_TICKET_STATUS,
        priority: DEFAULT_TICKET_PRIORITY,
        submissionSource: "public",
        publicRequesterName: requesterName,
        publicRequesterEmail: requesterEmail,
      })
      .returning();

    await tx.insert(ticketActivity).values({
      ticketId: ticket.id,
      organizationId: ticket.organizationId,
      actingUserId: REFERENCE_PUBLIC_INTAKE_USER.id,
      activityType: "created",
      previousValue: null,
      newValue: ticket.status,
    });

    return ticket;
  });
}
