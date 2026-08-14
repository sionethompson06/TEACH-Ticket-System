import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { schools } from "./schools";

export const locationTypeEnum = pgEnum("location_type", [
  "school_campus",
  "central_office",
  "system_wide",
]);

export const serviceLocations = pgTable(
  "service_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    schoolId: uuid("school_id").references(() => schools.id, {
      onDelete: "restrict",
    }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    locationType: locationTypeEnum("location_type").notNull(),
    gradeBand: text("grade_band"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    state: varchar("state", { length: 2 }),
    postalCode: varchar("postal_code", { length: 10 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("service_locations_org_code_unique").on(
      table.organizationId,
      table.code,
    ),
    // Composite unique target so Phase 5 ticket tables can enforce, at the
    // database level, that a ticket's service location belongs to the same
    // organization as the ticket itself.
    unique("service_locations_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    index("service_locations_school_id_idx").on(table.schoolId),
    index("service_locations_location_type_idx").on(table.locationType),
    // A location's school (when present) must belong to the same
    // organization as the location itself — enforced by the database,
    // not just application code.
    foreignKey({
      columns: [table.schoolId, table.organizationId],
      foreignColumns: [schools.id, schools.organizationId],
      name: "service_locations_school_org_fk",
    }),
    check(
      "service_locations_type_structure_check",
      sql`(
        (${table.locationType} = 'school_campus'
          AND ${table.schoolId} IS NOT NULL
          AND ${table.addressLine1} IS NOT NULL
          AND ${table.city} IS NOT NULL
          AND ${table.state} IS NOT NULL
          AND ${table.postalCode} IS NOT NULL)
        OR
        (${table.locationType} = 'central_office'
          AND ${table.schoolId} IS NULL
          AND ${table.addressLine1} IS NOT NULL
          AND ${table.city} IS NOT NULL
          AND ${table.state} IS NOT NULL
          AND ${table.postalCode} IS NOT NULL)
        OR
        (${table.locationType} = 'system_wide'
          AND ${table.schoolId} IS NULL
          AND ${table.addressLine1} IS NULL
          AND ${table.addressLine2} IS NULL
          AND ${table.city} IS NULL
          AND ${table.state} IS NULL
          AND ${table.postalCode} IS NULL)
      )`,
    ),
  ],
);
