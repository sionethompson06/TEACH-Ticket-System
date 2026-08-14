import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";
import {
  departments,
  organizations,
  schools,
  serviceLocations,
  ticketCategories,
} from "./schema";
import {
  REFERENCE_DEPARTMENTS,
  REFERENCE_ORGANIZATION,
  REFERENCE_SCHOOLS,
  REFERENCE_SERVICE_LOCATIONS,
  REFERENCE_TICKET_CATEGORIES,
} from "./reference-data";

type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

// Idempotent: inserts canonical records that are missing and updates
// descriptive fields on ones that already exist by code, matched by their
// stable reference UUIDs. Never creates duplicates, never deletes anything.
export async function seedReferenceData(db: Database): Promise<void> {
  await db.transaction(async (tx) => {
    const [organization] = await tx
      .insert(organizations)
      .values({
        id: REFERENCE_ORGANIZATION.id,
        code: REFERENCE_ORGANIZATION.code,
        name: REFERENCE_ORGANIZATION.name,
      })
      .onConflictDoUpdate({
        target: organizations.code,
        set: {
          name: REFERENCE_ORGANIZATION.name,
          updatedAt: new Date(),
        },
      })
      .returning();

    const departmentIdByCode = new Map<string, string>();
    for (const department of REFERENCE_DEPARTMENTS) {
      const [row] = await tx
        .insert(departments)
        .values({
          id: department.id,
          organizationId: organization.id,
          code: department.code,
          name: department.name,
        })
        .onConflictDoUpdate({
          target: [departments.organizationId, departments.code],
          set: {
            name: department.name,
            updatedAt: new Date(),
          },
        })
        .returning();
      departmentIdByCode.set(department.code, row.id);
    }

    for (const category of REFERENCE_TICKET_CATEGORIES) {
      const departmentId = departmentIdByCode.get(category.departmentCode);
      if (!departmentId) {
        throw new Error(
          `Reference data error: unknown department code "${category.departmentCode}" for category "${category.code}".`,
        );
      }

      await tx
        .insert(ticketCategories)
        .values({
          id: category.id,
          organizationId: organization.id,
          departmentId,
          code: category.code,
          name: category.name,
          displayOrder: category.displayOrder,
        })
        .onConflictDoUpdate({
          target: [ticketCategories.departmentId, ticketCategories.code],
          set: {
            name: category.name,
            displayOrder: category.displayOrder,
            updatedAt: new Date(),
          },
        });
    }

    const schoolIdByCode = new Map<string, string>();
    for (const school of REFERENCE_SCHOOLS) {
      const [row] = await tx
        .insert(schools)
        .values({
          id: school.id,
          organizationId: organization.id,
          code: school.code,
          name: school.name,
          gradeBand: school.gradeBand,
        })
        .onConflictDoUpdate({
          target: [schools.organizationId, schools.code],
          set: {
            name: school.name,
            gradeBand: school.gradeBand,
            updatedAt: new Date(),
          },
        })
        .returning();
      schoolIdByCode.set(school.code, row.id);
    }

    for (const location of REFERENCE_SERVICE_LOCATIONS) {
      let schoolId: string | null = null;
      if (location.schoolCode) {
        const resolvedId = schoolIdByCode.get(location.schoolCode);
        if (!resolvedId) {
          throw new Error(
            `Reference data error: unknown school code "${location.schoolCode}" for location "${location.code}".`,
          );
        }
        schoolId = resolvedId;
      }

      await tx
        .insert(serviceLocations)
        .values({
          id: location.id,
          organizationId: organization.id,
          schoolId,
          code: location.code,
          name: location.name,
          locationType: location.locationType,
          gradeBand: location.gradeBand,
          addressLine1: location.addressLine1,
          city: location.city,
          state: location.state,
          postalCode: location.postalCode,
        })
        .onConflictDoUpdate({
          target: [serviceLocations.organizationId, serviceLocations.code],
          set: {
            name: location.name,
            schoolId,
            locationType: location.locationType,
            gradeBand: location.gradeBand,
            addressLine1: location.addressLine1,
            city: location.city,
            state: location.state,
            postalCode: location.postalCode,
            updatedAt: new Date(),
          },
        });
    }
  });
}
