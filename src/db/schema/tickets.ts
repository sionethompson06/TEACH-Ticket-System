import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_PUBLIC_REQUESTER_EMAIL_LENGTH,
  MAX_PUBLIC_REQUESTER_NAME_LENGTH,
  MAX_SUBJECT_LENGTH,
} from "../../tickets/limits";
import {
  DEFAULT_TICKET_PRIORITY,
  INITIAL_TICKET_STATUS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from "../../tickets/ticket-status";
import { user } from "./auth";
import { departments } from "./departments";
import { organizations } from "./organizations";
import { serviceLocations } from "./service-locations";
import { ticketCategories } from "./ticket-categories";

export const ticketStatusEnum = pgEnum("ticket_status", TICKET_STATUSES);
export const ticketPriorityEnum = pgEnum("ticket_priority", TICKET_PRIORITIES);

// The core Phase 5 ticket record. Deliberately minimal: no queue-owner,
// collaborator, or resolver-vs-assignee distinction (Phase 7), no SLA
// target fields (Phase 10), no attachments (Phase 13).
export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Database-backed, concurrency-safe sequence — never derived from a
    // record count, timestamp, or random value. Format for display with
    // formatTicketNumber() from src/tickets/ticket-number.ts.
    ticketNumber: integer("ticket_number")
      .notNull()
      .unique()
      .generatedAlwaysAsIdentity(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict" }),
    serviceLocationId: uuid("service_location_id")
      .notNull()
      .references(() => serviceLocations.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => ticketCategories.id, { onDelete: "restrict" }),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    status: ticketStatusEnum("status").notNull().default(INITIAL_TICKET_STATUS),
    priority: ticketPriorityEnum("priority")
      .notNull()
      .default(DEFAULT_TICKET_PRIORITY),
    assignedAgentId: uuid("assigned_agent_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    // Phase 9B: distinguishes a ticket submitted through the ordinary
    // authenticated flow from one submitted through the temporary public
    // (unauthenticated) intake path. Existing tickets default to
    // "authenticated" — the only value that ever existed before this
    // column was added.
    submissionSource: text("submission_source")
      .notNull()
      .default("authenticated"),
    // Snapshots only, captured at submission time, so support staff can
    // contact a public requester later — never the identity of an
    // application user, and never exposed on the public confirmation page.
    // Null for every authenticated ticket; required (by the CHECK below)
    // for every public one.
    publicRequesterName: text("public_requester_name"),
    publicRequesterEmail: text("public_requester_email"),
  },
  (table) => [
    // Composite unique target so ticket_comments and ticket_activity can
    // enforce that their organization matches their ticket's own
    // organization.
    unique("tickets_id_org_unique").on(table.id, table.organizationId),
    index("tickets_organization_id_idx").on(table.organizationId),
    index("tickets_requester_id_idx").on(table.requesterId),
    index("tickets_department_id_idx").on(table.departmentId),
    index("tickets_assigned_agent_id_idx").on(table.assignedAgentId),
    check(
      "tickets_subject_not_blank_check",
      sql`btrim(${table.subject}) <> '' AND char_length(${table.subject}) <= ${sql.raw(String(MAX_SUBJECT_LENGTH))}`,
    ),
    check(
      "tickets_description_not_blank_check",
      sql`btrim(${table.description}) <> '' AND char_length(${table.description}) <= ${sql.raw(String(MAX_DESCRIPTION_LENGTH))}`,
    ),
    check(
      "tickets_submission_source_check",
      sql`${table.submissionSource} IN ('authenticated', 'public')`,
    ),
    // Ties the two public-requester snapshot columns to submission_source:
    // a public ticket must carry a non-blank name and email snapshot
    // (within their length limits); an authenticated ticket must carry
    // neither. This holds even against a direct database write, not just
    // the public-intake service's own validation.
    check(
      "tickets_public_requester_snapshot_check",
      sql`(
        ${table.submissionSource} = 'public'
        AND ${table.publicRequesterName} IS NOT NULL
        AND btrim(${table.publicRequesterName}) <> ''
        AND char_length(${table.publicRequesterName}) <= ${sql.raw(String(MAX_PUBLIC_REQUESTER_NAME_LENGTH))}
        AND ${table.publicRequesterEmail} IS NOT NULL
        AND btrim(${table.publicRequesterEmail}) <> ''
        AND char_length(${table.publicRequesterEmail}) <= ${sql.raw(String(MAX_PUBLIC_REQUESTER_EMAIL_LENGTH))}
        AND ${table.publicRequesterEmail} = lower(${table.publicRequesterEmail})
        AND ${table.publicRequesterEmail} ~ '^[^@[:space:]]+@[^@[:space:]]+$'
      ) OR (
        ${table.submissionSource} = 'authenticated'
        AND ${table.publicRequesterName} IS NULL
        AND ${table.publicRequesterEmail} IS NULL
      )`,
    ),
    // A ticket's department must belong to its own organization.
    foreignKey({
      columns: [table.departmentId, table.organizationId],
      foreignColumns: [departments.id, departments.organizationId],
      name: "tickets_department_org_fk",
    }),
    // A ticket's category must belong to the ticket's own department —
    // this is the database-level enforcement of "the selected category
    // must belong to the selected department."
    foreignKey({
      columns: [table.categoryId, table.departmentId],
      foreignColumns: [ticketCategories.id, ticketCategories.departmentId],
      name: "tickets_category_department_fk",
    }),
    // A ticket's service location must belong to its own organization.
    foreignKey({
      columns: [table.serviceLocationId, table.organizationId],
      foreignColumns: [serviceLocations.id, serviceLocations.organizationId],
      name: "tickets_location_org_fk",
    }),
    // A ticket's requester must belong to its own organization.
    foreignKey({
      columns: [table.requesterId, table.organizationId],
      foreignColumns: [user.id, user.organizationId],
      name: "tickets_requester_org_fk",
    }),
    // A ticket's assignee (when set) must belong to its own organization.
    // Nullable-column composite FKs are simply skipped by Postgres when
    // assigned_agent_id is NULL, so unassigned tickets are unaffected.
    foreignKey({
      columns: [table.assignedAgentId, table.organizationId],
      foreignColumns: [user.id, user.organizationId],
      name: "tickets_assignee_org_fk",
    }),
  ],
);
