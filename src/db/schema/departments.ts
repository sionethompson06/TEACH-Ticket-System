import {
  boolean,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

// Phase 4 MVP: exactly the department catalog itself (IT, Facilities).
// No categories, SLAs, queues, or other Phase 5 data live here.
export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("departments_org_code_unique").on(table.organizationId, table.code),
    // Composite unique target so department_memberships can enforce, at the
    // database level, that a membership's organization matches the
    // department's own organization.
    unique("departments_id_org_unique").on(table.id, table.organizationId),
  ],
);
