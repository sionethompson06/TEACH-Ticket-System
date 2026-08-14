import {
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organizations } from "./organizations";
import { tickets } from "./tickets";

export const ticketActivityTypeEnum = pgEnum("ticket_activity_type", [
  "created",
  "status_changed",
  "priority_changed",
  "assignment_changed",
]);

// A single narrow, append-only log of important ticket changes — not a
// generic audit platform. previous_value/new_value store only safe,
// short values (a status/priority string, or an assignee's user id) —
// never comment text, email content, or other personal information.
export const ticketActivity = pgTable(
  "ticket_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    actingUserId: uuid("acting_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    activityType: ticketActivityTypeEnum("activity_type").notNull(),
    previousValue: text("previous_value"),
    newValue: text("new_value"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ticket_activity_ticket_id_idx").on(table.ticketId),
    // An activity record's organization must match its ticket's own
    // organization.
    foreignKey({
      columns: [table.ticketId, table.organizationId],
      foreignColumns: [tickets.id, tickets.organizationId],
      name: "ticket_activity_ticket_org_fk",
    }),
  ],
);
