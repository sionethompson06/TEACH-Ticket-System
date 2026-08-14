import { and, asc, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { authorize, type ResolvedActor } from "../authz/policy";
import * as schema from "../db/schema";
import {
  departments,
  serviceLocations,
  ticketCategories,
  ticketComments,
  tickets,
  user,
} from "../db/schema";
import { parseTicketNumber } from "./ticket-number";
import type { TicketPriority, TicketStatus } from "./ticket-status";

// Read-only, UI-oriented queries that support the Phase 6 requester
// interface. This module never reimplements the Phase 4/5 authorization
// rules — every function here either scopes its own query to the actor
// (organization + ownership) directly in SQL, or calls the same
// `authorize()` function the Phase 5 ticket service uses.

type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

type ActiveActor = Extract<ResolvedActor, { status: "active" }>;

function assertActiveActor(actor: ResolvedActor): asserts actor is ActiveActor {
  if (actor.status !== "active") {
    throw new Error("An active actor is required.");
  }
}

export interface MyTicketSummary {
  ticketNumber: number;
  subject: string;
  departmentName: string;
  serviceLocationName: string;
  status: TicketStatus;
  priority: TicketPriority;
  updatedAt: Date;
}

// Tickets created by the current requester only — never a department's or
// administrator's broader scope, even when the actor also happens to hold
// a department membership or the administrator flag. Fully scoped in SQL.
export async function listMyTickets(
  db: Database,
  actor: ResolvedActor,
): Promise<MyTicketSummary[]> {
  assertActiveActor(actor);

  return db
    .select({
      ticketNumber: tickets.ticketNumber,
      subject: tickets.subject,
      departmentName: departments.name,
      serviceLocationName: serviceLocations.name,
      status: tickets.status,
      priority: tickets.priority,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .innerJoin(departments, eq(tickets.departmentId, departments.id))
    .innerJoin(
      serviceLocations,
      eq(tickets.serviceLocationId, serviceLocations.id),
    )
    .where(
      and(
        eq(tickets.organizationId, actor.organizationId),
        eq(tickets.requesterId, actor.userId),
      ),
    )
    .orderBy(desc(tickets.updatedAt));
}

export interface TicketDetailView {
  id: string;
  ticketNumber: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  departmentName: string;
  serviceLocationName: string;
  categoryName: string;
  assignedAgentName: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  requesterId: string;
}

// Looks up a ticket by its formatted, user-facing number (e.g.
// "TKT-000001"). Returns null uniformly for a malformed number, a
// nonexistent ticket, and an existing-but-inaccessible ticket — a caller
// can never distinguish any of these three cases from the result alone.
export async function getTicketDetailByNumber(
  db: Database,
  actor: ResolvedActor,
  formattedTicketNumber: string,
): Promise<TicketDetailView | null> {
  assertActiveActor(actor);

  const ticketNumber = parseTicketNumber(formattedTicketNumber);
  if (ticketNumber === null) {
    return null;
  }

  const [row] = await db
    .select({
      ticket: tickets,
      departmentCode: departments.code,
      departmentName: departments.name,
      serviceLocationName: serviceLocations.name,
      categoryName: ticketCategories.name,
    })
    .from(tickets)
    .innerJoin(departments, eq(tickets.departmentId, departments.id))
    .innerJoin(
      serviceLocations,
      eq(tickets.serviceLocationId, serviceLocations.id),
    )
    .innerJoin(ticketCategories, eq(tickets.categoryId, ticketCategories.id))
    .where(eq(tickets.ticketNumber, ticketNumber));
  if (!row) {
    return null;
  }

  const authorized = authorize(actor, {
    kind: "access_ticket",
    resource: {
      organizationId: row.ticket.organizationId,
      requesterId: row.ticket.requesterId,
      departmentCode: row.departmentCode,
    },
  });
  if (!authorized) {
    return null;
  }

  let assignedAgentName: string | null = null;
  if (row.ticket.assignedAgentId) {
    const [agent] = await db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, row.ticket.assignedAgentId));
    assignedAgentName = agent?.name ?? null;
  }

  return {
    id: row.ticket.id,
    ticketNumber: row.ticket.ticketNumber,
    subject: row.ticket.subject,
    description: row.ticket.description,
    status: row.ticket.status,
    priority: row.ticket.priority,
    departmentName: row.departmentName,
    serviceLocationName: row.serviceLocationName,
    categoryName: row.categoryName,
    assignedAgentName,
    createdAt: row.ticket.createdAt,
    updatedAt: row.ticket.updatedAt,
    resolvedAt: row.ticket.resolvedAt,
    closedAt: row.ticket.closedAt,
    requesterId: row.ticket.requesterId,
  };
}

export interface TicketCommentView {
  id: string;
  body: string;
  createdAt: Date;
  authorId: string;
  authorName: string;
  isFromRequester: boolean;
}

// Loads a ticket's public comments in chronological order, after
// independently re-verifying the same access_ticket authorization the
// rest of the ticket service uses — never trusting that a caller already
// checked. Returns null uniformly for a nonexistent or inaccessible
// ticket, exactly like getTicketDetailByNumber.
export async function listTicketComments(
  db: Database,
  actor: ResolvedActor,
  ticketId: string,
): Promise<TicketCommentView[] | null> {
  assertActiveActor(actor);

  const [ticketRow] = await db
    .select({ ticket: tickets, departmentCode: departments.code })
    .from(tickets)
    .innerJoin(departments, eq(tickets.departmentId, departments.id))
    .where(eq(tickets.id, ticketId));
  if (!ticketRow) {
    return null;
  }

  const authorized = authorize(actor, {
    kind: "access_ticket",
    resource: {
      organizationId: ticketRow.ticket.organizationId,
      requesterId: ticketRow.ticket.requesterId,
      departmentCode: ticketRow.departmentCode,
    },
  });
  if (!authorized) {
    return null;
  }

  const rows = await db
    .select({ comment: ticketComments, authorName: user.name })
    .from(ticketComments)
    .innerJoin(user, eq(ticketComments.authorId, user.id))
    .where(eq(ticketComments.ticketId, ticketId))
    .orderBy(asc(ticketComments.createdAt));

  return rows.map((row) => ({
    id: row.comment.id,
    body: row.comment.body,
    createdAt: row.comment.createdAt,
    authorId: row.comment.authorId,
    authorName: row.authorName,
    isFromRequester: row.comment.authorId === ticketRow.ticket.requesterId,
  }));
}

export interface TicketFormDepartmentOption {
  id: string;
  code: string;
  name: string;
}

export interface TicketFormCategoryOption {
  id: string;
  departmentId: string;
  name: string;
  displayOrder: number;
}

export interface TicketFormLocationOption {
  id: string;
  name: string;
}

export interface TicketFormOptions {
  departments: TicketFormDepartmentOption[];
  categories: TicketFormCategoryOption[];
  serviceLocations: TicketFormLocationOption[];
}

// Active service locations for an organization — small, non-sensitive,
// organization-wide reference data. Shared by the Phase 6 Request Help
// form and the Phase 7 support-queue location filter, so the query lives
// in one place rather than being duplicated.
export async function listActiveServiceLocations(
  db: Database,
  organizationId: string,
): Promise<TicketFormLocationOption[]> {
  return db
    .select({ id: serviceLocations.id, name: serviceLocations.name })
    .from(serviceLocations)
    .where(
      and(
        eq(serviceLocations.organizationId, organizationId),
        eq(serviceLocations.isActive, true),
      ),
    )
    .orderBy(asc(serviceLocations.name));
}

// Active reference data for the Request Help form — small, non-sensitive,
// organization-wide lists (a couple dozen rows at most), loaded once and
// filtered client-side as the requester picks a department. This is not
// the "fetch all tickets and filter in the browser" pattern the ticket
// listings must avoid: no ticket or user data is involved here at all.
export async function loadTicketFormOptions(
  db: Database,
  organizationId: string,
): Promise<TicketFormOptions> {
  const [departmentRows, categoryRows, locationRows] = await Promise.all([
    db
      .select({
        id: departments.id,
        code: departments.code,
        name: departments.name,
      })
      .from(departments)
      .where(
        and(
          eq(departments.organizationId, organizationId),
          eq(departments.isActive, true),
        ),
      ),
    db
      .select({
        id: ticketCategories.id,
        departmentId: ticketCategories.departmentId,
        name: ticketCategories.name,
        displayOrder: ticketCategories.displayOrder,
      })
      .from(ticketCategories)
      .where(
        and(
          eq(ticketCategories.organizationId, organizationId),
          eq(ticketCategories.isActive, true),
        ),
      )
      .orderBy(asc(ticketCategories.displayOrder)),
    listActiveServiceLocations(db, organizationId),
  ]);

  return {
    departments: departmentRows,
    categories: categoryRows,
    serviceLocations: locationRows,
  };
}
