import { and, eq, inArray, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { authorize, type ResolvedActor } from "../authz/policy";
import * as schema from "../db/schema";
import {
  departmentMemberships,
  departments,
  ticketActivity,
  ticketCategories,
  ticketComments,
  tickets,
  user,
} from "../db/schema";
import { TicketAuthorizationError, TicketValidationError } from "./errors";
import {
  MAX_COMMENT_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_SUBJECT_LENGTH,
} from "./limits";
import {
  canTransitionTicketStatus,
  DEFAULT_TICKET_PRIORITY,
  INITIAL_TICKET_STATUS,
  type TicketPriority,
  type TicketStatus,
} from "./ticket-status";

type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

type ActiveActor = Extract<ResolvedActor, { status: "active" }>;

// The only place that trusts a ResolvedActor's "active" shape — every
// exported function below calls this first, both for TypeScript narrowing
// and as a defense-in-depth check independent of the authorize() calls
// that follow it.
function assertActiveActor(actor: ResolvedActor): asserts actor is ActiveActor {
  if (actor.status !== "active") {
    throw new TicketAuthorizationError();
  }
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

export interface CreateTicketInput {
  departmentId: string;
  serviceLocationId: string;
  categoryId: string;
  subject: string;
  description: string;
}

export type Ticket = typeof tickets.$inferSelect;
export type TicketComment = typeof ticketComments.$inferSelect;

interface TicketWithDepartmentCode {
  ticket: Ticket;
  departmentCode: string;
}

async function loadTicketWithDepartmentCode(
  db: Database,
  ticketId: string,
): Promise<TicketWithDepartmentCode | null> {
  const [row] = await db
    .select({ ticket: tickets, departmentCode: departments.code })
    .from(tickets)
    .innerJoin(departments, eq(tickets.departmentId, departments.id))
    .where(eq(tickets.id, ticketId));
  return row ?? null;
}

// Creates a new ticket for the resolved actor. The requester is always the
// actor themselves — there is no field through which a caller can name a
// different requester or organization.
export async function createTicket(
  db: Database,
  actor: ResolvedActor,
  input: CreateTicketInput,
): Promise<Ticket> {
  assertActiveActor(actor);
  if (!authorize(actor, { kind: "create_ticket" })) {
    throw new TicketAuthorizationError();
  }

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
        eq(departments.organizationId, actor.organizationId),
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
    .from(schema.serviceLocations)
    .where(
      and(
        eq(schema.serviceLocations.id, input.serviceLocationId),
        eq(schema.serviceLocations.organizationId, actor.organizationId),
        eq(schema.serviceLocations.isActive, true),
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
        organizationId: actor.organizationId,
        requesterId: actor.userId,
        departmentId: department.id,
        serviceLocationId: serviceLocation.id,
        categoryId: category.id,
        subject: input.subject,
        description: input.description,
        status: INITIAL_TICKET_STATUS,
        priority: DEFAULT_TICKET_PRIORITY,
      })
      .returning();

    await tx.insert(ticketActivity).values({
      ticketId: ticket.id,
      organizationId: ticket.organizationId,
      actingUserId: actor.userId,
      activityType: "created",
      previousValue: null,
      newValue: ticket.status,
    });

    return ticket;
  });
}

// Returns the ticket if it exists AND the actor is authorized to view it —
// otherwise null, uniformly, so a caller can never distinguish "does not
// exist" from "exists but you may not see it."
export async function getTicket(
  db: Database,
  actor: ResolvedActor,
  ticketId: string,
): Promise<Ticket | null> {
  assertActiveActor(actor);

  const found = await loadTicketWithDepartmentCode(db, ticketId);
  if (!found) {
    return null;
  }

  const authorized = authorize(actor, {
    kind: "access_ticket",
    resource: {
      organizationId: found.ticket.organizationId,
      requesterId: found.ticket.requesterId,
      departmentCode: found.departmentCode,
    },
  });
  return authorized ? found.ticket : null;
}

// Every listing query is scoped in SQL before it runs — never "fetch
// everything, then filter in memory."
export async function listTicketsForActor(
  db: Database,
  actor: ResolvedActor,
): Promise<Ticket[]> {
  assertActiveActor(actor);

  if (actor.isSystemAdministrator) {
    return db
      .select()
      .from(tickets)
      .where(eq(tickets.organizationId, actor.organizationId));
  }

  const assignedDepartmentIds =
    actor.departmentCodes.length > 0
      ? (
          await db
            .select({ id: departments.id })
            .from(departments)
            .where(
              and(
                eq(departments.organizationId, actor.organizationId),
                inArray(departments.code, [...actor.departmentCodes]),
              ),
            )
        ).map((row) => row.id)
      : [];

  const ownershipCondition = eq(tickets.requesterId, actor.userId);
  const scopeCondition =
    assignedDepartmentIds.length > 0
      ? or(
          ownershipCondition,
          inArray(tickets.departmentId, assignedDepartmentIds),
        )
      : ownershipCondition;

  return db
    .select()
    .from(tickets)
    .where(
      and(eq(tickets.organizationId, actor.organizationId), scopeCondition),
    );
}

// Comments are ordinary shared conversation, visible to (and postable by)
// the requester and any authorized department agent/administrator — the
// same access rule as viewing the ticket. Append-only: there is no update
// or delete function.
export async function addTicketComment(
  db: Database,
  actor: ResolvedActor,
  ticketId: string,
  body: string,
): Promise<TicketComment> {
  assertActiveActor(actor);
  assertNonBlankWithinLength(body, "Comment", MAX_COMMENT_LENGTH);

  const found = await loadTicketWithDepartmentCode(db, ticketId);
  if (!found) {
    throw new TicketAuthorizationError();
  }

  const authorized = authorize(actor, {
    kind: "access_ticket",
    resource: {
      organizationId: found.ticket.organizationId,
      requesterId: found.ticket.requesterId,
      departmentCode: found.departmentCode,
    },
  });
  if (!authorized) {
    throw new TicketAuthorizationError();
  }
  assertNotClosed(found.ticket);

  const [comment] = await db
    .insert(ticketComments)
    .values({
      ticketId: found.ticket.id,
      organizationId: found.ticket.organizationId,
      authorId: actor.userId,
      body,
    })
    .returning();
  return comment;
}

async function assertManageAuthority(
  actor: ActiveActor,
  found: TicketWithDepartmentCode,
): Promise<void> {
  const authorized = authorize(actor, {
    kind: "manage_ticket",
    resource: {
      organizationId: found.ticket.organizationId,
      requesterId: found.ticket.requesterId,
      departmentCode: found.departmentCode,
    },
  });
  if (!authorized) {
    throw new TicketAuthorizationError();
  }
}

// Closed is final in the MVP (see canTransitionTicketStatus): no further
// comment, assignment, or priority change is permitted once a ticket is
// closed. Checked here, in the service layer, so the rule holds even if a
// UI control were ever mistakenly left enabled.
function assertNotClosed(ticket: Ticket): void {
  if (ticket.status === "closed") {
    throw new TicketValidationError(
      "This request is closed and can no longer be updated.",
    );
  }
}

// Only a department agent for the ticket's department, or a system
// administrator, may change status — never the requester, even for their
// own ticket. Transitions follow the small, hardcoded rule set in
// ticket-status.ts; a rejected transition writes no activity record and
// leaves the ticket unchanged.
export async function updateTicketStatus(
  db: Database,
  actor: ResolvedActor,
  ticketId: string,
  nextStatus: TicketStatus,
): Promise<Ticket> {
  assertActiveActor(actor);

  const found = await loadTicketWithDepartmentCode(db, ticketId);
  if (!found) {
    throw new TicketAuthorizationError();
  }
  await assertManageAuthority(actor, found);

  const currentStatus = found.ticket.status;
  if (!canTransitionTicketStatus(currentStatus, nextStatus)) {
    throw new TicketValidationError(
      `Cannot change ticket status from "${currentStatus}" to "${nextStatus}".`,
    );
  }

  const now = new Date();
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(tickets)
      .set({
        status: nextStatus,
        updatedAt: now,
        resolvedAt: nextStatus === "resolved" ? now : found.ticket.resolvedAt,
        closedAt: nextStatus === "closed" ? now : found.ticket.closedAt,
      })
      .where(eq(tickets.id, ticketId))
      .returning();

    await tx.insert(ticketActivity).values({
      ticketId: updated.id,
      organizationId: updated.organizationId,
      actingUserId: actor.userId,
      activityType: "status_changed",
      previousValue: currentStatus,
      newValue: nextStatus,
    });

    return updated;
  });
}

// Only a department agent for the ticket's department, or a system
// administrator, may change priority — the requester never sets or
// overrides it. No SLA deadline calculation happens here (Phase 10).
export async function updateTicketPriority(
  db: Database,
  actor: ResolvedActor,
  ticketId: string,
  nextPriority: TicketPriority,
): Promise<Ticket> {
  assertActiveActor(actor);

  const found = await loadTicketWithDepartmentCode(db, ticketId);
  if (!found) {
    throw new TicketAuthorizationError();
  }
  await assertManageAuthority(actor, found);
  assertNotClosed(found.ticket);

  const currentPriority = found.ticket.priority;
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(tickets)
      .set({ priority: nextPriority, updatedAt: new Date() })
      .where(eq(tickets.id, ticketId))
      .returning();

    await tx.insert(ticketActivity).values({
      ticketId: updated.id,
      organizationId: updated.organizationId,
      actingUserId: actor.userId,
      activityType: "priority_changed",
      previousValue: currentPriority,
      newValue: nextPriority,
    });

    return updated;
  });
}

// An assignee must be an active department agent for the ticket's own
// department — never an unrelated requester, and never a member of a
// different department only. Pass assigneeUserId: null to unassign.
export async function assignTicket(
  db: Database,
  actor: ResolvedActor,
  ticketId: string,
  assigneeUserId: string | null,
): Promise<Ticket> {
  assertActiveActor(actor);

  const found = await loadTicketWithDepartmentCode(db, ticketId);
  if (!found) {
    throw new TicketAuthorizationError();
  }
  await assertManageAuthority(actor, found);
  assertNotClosed(found.ticket);

  const previousAssigneeId = found.ticket.assignedAgentId;

  if (assigneeUserId !== null) {
    const [assignee] = await db
      .select()
      .from(user)
      .innerJoin(
        departmentMemberships,
        eq(departmentMemberships.userId, user.id),
      )
      .where(
        and(
          eq(user.id, assigneeUserId),
          eq(user.isActive, true),
          eq(user.organizationId, found.ticket.organizationId),
          eq(departmentMemberships.departmentId, found.ticket.departmentId),
        ),
      );
    if (!assignee) {
      throw new TicketValidationError(
        "The assignee must be an active agent for the ticket's department.",
      );
    }
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(tickets)
      .set({ assignedAgentId: assigneeUserId, updatedAt: new Date() })
      .where(eq(tickets.id, ticketId))
      .returning();

    await tx.insert(ticketActivity).values({
      ticketId: updated.id,
      organizationId: updated.organizationId,
      actingUserId: actor.userId,
      activityType: "assignment_changed",
      previousValue: previousAssigneeId,
      newValue: assigneeUserId,
    });

    return updated;
  });
}
