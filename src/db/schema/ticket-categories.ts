import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { departments } from "./departments";
import { organizations } from "./organizations";

// Phase 5 MVP: exactly the department's category catalog (IT and Facilities
// categories from PROJECT_FOUNDATION.md Sections 4 and 5). No SLA
// configuration, form fields, request-type detail, or category-management
// UI live here — that is Phase 6+ scope.
export const ticketCategories = pgTable(
  "ticket_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    displayOrder: integer("display_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Category codes are unique within a department, not globally.
    unique("ticket_categories_department_code_unique").on(
      table.departmentId,
      table.code,
    ),
    // Composite unique target so tickets can enforce, at the database
    // level, that a ticket's category belongs to its selected department.
    unique("ticket_categories_id_department_unique").on(
      table.id,
      table.departmentId,
    ),
    index("ticket_categories_department_id_idx").on(table.departmentId),
    // A category's organization must match its department's own
    // organization — the same organization-scoping pattern already used by
    // department_memberships against departments.
    foreignKey({
      columns: [table.departmentId, table.organizationId],
      foreignColumns: [departments.id, departments.organizationId],
      name: "ticket_categories_department_org_fk",
    }),
  ],
);
