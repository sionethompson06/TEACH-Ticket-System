import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { MAX_COMMENT_LENGTH } from "../../tickets/limits";
import { user } from "./auth";
import { organizations } from "./organizations";
import { tickets } from "./tickets";

// Phase 5 MVP: ordinary shared conversation only, visible to the requester
// and any authorized support staff. No internal/private notes,
// attachments, editing, deletion, reactions, rich text, or email
// ingestion — comments are append-only.
export const ticketComments = pgTable(
  "ticket_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ticket_comments_ticket_id_idx").on(table.ticketId),
    check(
      "ticket_comments_body_not_blank_check",
      sql`btrim(${table.body}) <> '' AND char_length(${table.body}) <= ${sql.raw(String(MAX_COMMENT_LENGTH))}`,
    ),
    // A comment's organization must match its ticket's own organization.
    foreignKey({
      columns: [table.ticketId, table.organizationId],
      foreignColumns: [tickets.id, tickets.organizationId],
      name: "ticket_comments_ticket_org_fk",
    }),
  ],
);
