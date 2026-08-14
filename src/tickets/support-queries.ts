import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { authorize, isSupportStaff, type ResolvedActor } from "../authz/policy";
import * as schema from "../db/schema";
import {
  departmentMemberships,
  departments,
  serviceLocations,
  ticketActivity,
  ticketCategories,
  tickets,
  user,
} from "../db/schema";
import { describeTicketActivity } from "./activity-labels";
import { parseTicketNumber } from "./ticket-number";
import {
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from "./ticket-status";

// Read-only, authorization-scoped queries for the Phase 7 support
// workspace. Like ticket-queries.ts, this module never reimplements the
// Phase 4/5 authorization rules — every function either scopes its own
// query to the actor's authorized departments directly in SQL, or calls
// the same `authorize()` function the ticket service uses.

type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

type ActiveActor = Extract<ResolvedActor, { status: "active" }>;

function assertActiveActor(actor: ResolvedActor): asserts actor is ActiveActor {
  if (actor.status !== "active") {
    throw new Error("An active actor is required.");
  }
}

// Fails closed for an ordinary requester (no department membership, not a
// system administrator) before any support data is ever fetched — the
// same fail-closed shape as every other check in this codebase.
function assertSupportStaff(actor: ActiveActor): asserts actor is ActiveActor {
  if (!isSupportStaff(actor)) {
    throw new Error("Support workspace access is required.");
  }
}

const ACTIVE_QUEUE_STATUSES: readonly TicketStatus[] = [
  "submitted",
  "in_progress",
  "waiting_for_requester",
  "reopened",
];

// Hard cap on a single queue query — this is a practical work list, not a
// reporting tool, so no pagination controls exist; a reasonable limit is
// enough to keep the query bounded.
const MAX_QUEUE_RESULTS = 200;

export interface SupportDepartmentOption {
  id: string;
  code: string;
  name: string;
}

export interface SupportFilterOptions {
  departments: SupportDepartmentOption[];
  serviceLocations: { id: string; name: string }[];
}

// The department choices this actor may filter by — their own
// memberships, or every active department in the organization for a
// system administrator. Never a hardcoded department list.
export async function listSupportFilterOptions(
  db: Database,
  actor: ResolvedActor,
): Promise<SupportFilterOptions> {
  assertActiveActor(actor);
  assertSupportStaff(actor);

  const departmentRows = actor.isSystemAdministrator
    ? await db
        .select({
          id: departments.id,
          code: departments.code,
          name: departments.name,
        })
        .from(departments)
        .where(
          and(
            eq(departments.organizationId, actor.organizationId),
            eq(departments.isActive, true),
          ),
        )
    : actor.departmentCodes.length === 0
      ? []
      : await db
          .select({
            id: departments.id,
            code: departments.code,
            name: departments.name,
          })
          .from(departments)
          .where(
            and(
              eq(departments.organizationId, actor.organizationId),
              eq(departments.isActive, true),
              inArray(departments.code, [...actor.departmentCodes]),
            ),
          );

  const locationRows = await db
    .select({ id: serviceLocations.id, name: serviceLocations.name })
    .from(serviceLocations)
    .where(
      and(
        eq(serviceLocations.organizationId, actor.organizationId),
        eq(serviceLocations.isActive, true),
      ),
    )
    .orderBy(asc(serviceLocations.name));

  return { departments: departmentRows, serviceLocations: locationRows };
}

export type SupportAssignmentFilter = "all" | "mine" | "unassigned";

export interface SupportQueueRawFilters {
  department?: string;
  location?: string;
  status?: string;
  assignment?: string;
}

export interface SupportQueueFilters {
  departmentId: string | null;
  serviceLocationId: string | null;
  status: TicketStatus | null;
  assignment: SupportAssignmentFilter;
}

export interface SupportQueueTicketSummary {
  id: string;
  ticketNumber: number;
  subject: string;
  requesterName: string;
  departmentName: string;
  serviceLocationName: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedAgentName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupportQueueResult {
  tickets: SupportQueueTicketSummary[];
  filters: SupportQueueFilters;
}

function isValidAssignmentFilter(
  value: string | undefined,
): value is SupportAssignmentFilter {
  return value === "all" || value === "mine" || value === "unassigned";
}

// Every query parameter is validated here, server-side, against the
// actor's own authorized scope — an unrecognized or unauthorized value is
// silently ignored (falling back to the safe default) rather than
// rejected with an error, so a tampered URL never breaks the page or
// leaks whether a value would otherwise have been valid.
export async function listSupportQueueTickets(
  db: Database,
  actor: ResolvedActor,
  rawFilters: SupportQueueRawFilters,
): Promise<SupportQueueResult> {
  assertActiveActor(actor);
  assertSupportStaff(actor);

  const options = await listSupportFilterOptions(db, actor);
  const allowedDepartmentIds = options.departments.map((d) => d.id);

  const departmentId =
    rawFilters.department &&
    allowedDepartmentIds.includes(rawFilters.department)
      ? rawFilters.department
      : null;

  const serviceLocationId =
    rawFilters.location &&
    options.serviceLocations.some((loc) => loc.id === rawFilters.location)
      ? rawFilters.location
      : null;

  const status =
    rawFilters.status &&
    (TICKET_STATUSES as readonly string[]).includes(rawFilters.status)
      ? (rawFilters.status as TicketStatus)
      : null;

  const assignment = isValidAssignmentFilter(rawFilters.assignment)
    ? rawFilters.assignment
    : "all";

  const filters: SupportQueueFilters = {
    departmentId,
    serviceLocationId,
    status,
    assignment,
  };

  if (allowedDepartmentIds.length === 0) {
    return { tickets: [], filters };
  }

  const conditions = [
    eq(tickets.organizationId, actor.organizationId),
    departmentId
      ? eq(tickets.departmentId, departmentId)
      : inArray(tickets.departmentId, allowedDepartmentIds),
    status
      ? eq(tickets.status, status)
      : inArray(tickets.status, [...ACTIVE_QUEUE_STATUSES]),
  ];

  if (serviceLocationId) {
    conditions.push(eq(tickets.serviceLocationId, serviceLocationId));
  }
  if (assignment === "mine") {
    conditions.push(eq(tickets.assignedAgentId, actor.userId));
  } else if (assignment === "unassigned") {
    conditions.push(isNull(tickets.assignedAgentId));
  }

  const requesterUser = alias(user, "requester_user");
  const assigneeUser = alias(user, "assignee_user");

  const priorityRank = sql<number>`case ${tickets.priority}
    when 'critical' then 0
    when 'urgent' then 1
    when 'normal' then 2
    else 3
  end`;

  const rows = await db
    .select({
      id: tickets.id,
      ticketNumber: tickets.ticketNumber,
      subject: tickets.subject,
      requesterName: requesterUser.name,
      departmentName: departments.name,
      serviceLocationName: serviceLocations.name,
      status: tickets.status,
      priority: tickets.priority,
      assignedAgentName: assigneeUser.name,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .innerJoin(requesterUser, eq(tickets.requesterId, requesterUser.id))
    .innerJoin(departments, eq(tickets.departmentId, departments.id))
    .innerJoin(
      serviceLocations,
      eq(tickets.serviceLocationId, serviceLocations.id),
    )
    .leftJoin(assigneeUser, eq(tickets.assignedAgentId, assigneeUser.id))
    .where(and(...conditions))
    .orderBy(priorityRank, asc(tickets.createdAt))
    .limit(MAX_QUEUE_RESULTS);

  return {
    tickets: rows.map((row) => ({
      ...row,
      assignedAgentName: row.assignedAgentName ?? null,
    })),
    filters,
  };
}

export interface SupportTicketDetailView {
  id: string;
  ticketNumber: number;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  departmentId: string;
  departmentName: string;
  serviceLocationName: string;
  categoryName: string;
  requesterName: string;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Looks up a ticket for the support workspace by its formatted number.
// Returns null uniformly for a malformed number, a nonexistent ticket, and
// an existing-but-inaccessible one (wrong department, wrong organization,
// or an ordinary requester with no department membership at all) — a
// caller can never distinguish any of these from the result alone. Gated
// by `manage_ticket`, the same authorization decision the ticket service
// uses for status/priority/assignment changes, since the support
// workspace is never reachable merely by being the ticket's requester.
export async function getSupportTicketDetailByNumber(
  db: Database,
  actor: ResolvedActor,
  formattedTicketNumber: string,
): Promise<SupportTicketDetailView | null> {
  assertActiveActor(actor);
  if (!isSupportStaff(actor)) {
    return null;
  }

  const ticketNumber = parseTicketNumber(formattedTicketNumber);
  if (ticketNumber === null) {
    return null;
  }

  const requesterUser = alias(user, "requester_user");
  const assigneeUser = alias(user, "assignee_user");

  const [row] = await db
    .select({
      ticket: tickets,
      departmentCode: departments.code,
      departmentName: departments.name,
      serviceLocationName: serviceLocations.name,
      categoryName: ticketCategories.name,
      requesterName: requesterUser.name,
      assignedAgentName: assigneeUser.name,
    })
    .from(tickets)
    .innerJoin(departments, eq(tickets.departmentId, departments.id))
    .innerJoin(
      serviceLocations,
      eq(tickets.serviceLocationId, serviceLocations.id),
    )
    .innerJoin(ticketCategories, eq(tickets.categoryId, ticketCategories.id))
    .innerJoin(requesterUser, eq(tickets.requesterId, requesterUser.id))
    .leftJoin(assigneeUser, eq(tickets.assignedAgentId, assigneeUser.id))
    .where(eq(tickets.ticketNumber, ticketNumber));
  if (!row) {
    return null;
  }

  const authorized = authorize(actor, {
    kind: "manage_ticket",
    resource: {
      organizationId: row.ticket.organizationId,
      requesterId: row.ticket.requesterId,
      departmentCode: row.departmentCode,
    },
  });
  if (!authorized) {
    return null;
  }

  return {
    id: row.ticket.id,
    ticketNumber: row.ticket.ticketNumber,
    subject: row.ticket.subject,
    description: row.ticket.description,
    status: row.ticket.status,
    priority: row.ticket.priority,
    departmentId: row.ticket.departmentId,
    departmentName: row.departmentName,
    serviceLocationName: row.serviceLocationName,
    categoryName: row.categoryName,
    requesterName: row.requesterName,
    assignedAgentId: row.ticket.assignedAgentId,
    assignedAgentName: row.assignedAgentName ?? null,
    createdAt: row.ticket.createdAt,
    updatedAt: row.ticket.updatedAt,
  };
}

async function loadAuthorizedTicketForManagement(
  db: Database,
  actor: ActiveActor,
  ticketId: string,
): Promise<{ organizationId: string; departmentId: string } | null> {
  const [row] = await db
    .select({
      organizationId: tickets.organizationId,
      requesterId: tickets.requesterId,
      departmentId: tickets.departmentId,
      departmentCode: departments.code,
    })
    .from(tickets)
    .innerJoin(departments, eq(tickets.departmentId, departments.id))
    .where(eq(tickets.id, ticketId));
  if (!row) {
    return null;
  }

  const authorized = authorize(actor, {
    kind: "manage_ticket",
    resource: {
      organizationId: row.organizationId,
      requesterId: row.requesterId,
      departmentCode: row.departmentCode,
    },
  });
  if (!authorized) {
    return null;
  }

  return { organizationId: row.organizationId, departmentId: row.departmentId };
}

export interface SupportAgentOption {
  id: string;
  name: string;
}

// Active agents for the ticket's own department only — the same
// eligibility set assignTicket() enforces, exposed here read-only so the
// assignee <select> never offers a choice the service would reject.
// Returns null uniformly for a nonexistent or inaccessible ticket.
export async function listActiveDepartmentAgents(
  db: Database,
  actor: ResolvedActor,
  ticketId: string,
): Promise<SupportAgentOption[] | null> {
  assertActiveActor(actor);
  if (!isSupportStaff(actor)) {
    return null;
  }

  const authorizedTicket = await loadAuthorizedTicketForManagement(
    db,
    actor,
    ticketId,
  );
  if (!authorizedTicket) {
    return null;
  }

  const rows = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .innerJoin(departmentMemberships, eq(departmentMemberships.userId, user.id))
    .where(
      and(
        eq(departmentMemberships.departmentId, authorizedTicket.departmentId),
        eq(user.organizationId, authorizedTicket.organizationId),
        eq(user.isActive, true),
      ),
    )
    .orderBy(asc(user.name));

  return rows;
}

export interface TicketActivityEntry {
  id: string;
  description: string;
  createdAt: Date;
}

// A simple, human-readable activity history — never raw enum values,
// user ids, or other metadata. Returns null uniformly for a nonexistent
// or inaccessible ticket, exactly like the other support queries.
export async function listTicketActivity(
  db: Database,
  actor: ResolvedActor,
  ticketId: string,
): Promise<TicketActivityEntry[] | null> {
  assertActiveActor(actor);
  if (!isSupportStaff(actor)) {
    return null;
  }

  const authorizedTicket = await loadAuthorizedTicketForManagement(
    db,
    actor,
    ticketId,
  );
  if (!authorizedTicket) {
    return null;
  }

  const rows = await db
    .select()
    .from(ticketActivity)
    .where(eq(ticketActivity.ticketId, ticketId))
    .orderBy(asc(ticketActivity.createdAt));

  const referencedUserIds = new Set<string>();
  for (const row of rows) {
    if (row.activityType === "assignment_changed") {
      if (row.previousValue) referencedUserIds.add(row.previousValue);
      if (row.newValue) referencedUserIds.add(row.newValue);
    }
  }

  const userNames = new Map<string, string>();
  if (referencedUserIds.size > 0) {
    const userRows = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(inArray(user.id, [...referencedUserIds]));
    for (const userRow of userRows) {
      userNames.set(userRow.id, userRow.name);
    }
  }
  const resolveUserName = (userId: string) =>
    userNames.get(userId) ?? "a former team member";

  return rows.map((row) => ({
    id: row.id,
    description: describeTicketActivity({
      activityType: row.activityType,
      previousValue: row.previousValue,
      newValue: row.newValue,
      resolveUserName,
    }),
    createdAt: row.createdAt,
  }));
}
