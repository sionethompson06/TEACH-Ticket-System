import {
  foreignKey,
  index,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { departments } from "./departments";
import { organizations } from "./organizations";

// A membership row means "this user is a department agent for this
// department." No manager levels, expiring grants, or other Phase 5+
// concepts — presence of a row is the entire model.
export const departmentMemberships = pgTable(
  "department_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("department_memberships_user_department_unique").on(
      table.userId,
      table.departmentId,
    ),
    index("department_memberships_user_id_idx").on(table.userId),
    index("department_memberships_department_id_idx").on(table.departmentId),
    // A membership's organization must match its department's own
    // organization — enforced by the database, not just application code.
    foreignKey({
      columns: [table.departmentId, table.organizationId],
      foreignColumns: [departments.id, departments.organizationId],
      name: "department_memberships_department_org_fk",
    }),
  ],
);
