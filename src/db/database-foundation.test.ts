import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "./schema";
import { organizations, schools, serviceLocations } from "./schema";
import { seedReferenceData } from "./seed-reference-data";

// Independently transcribed from docs/PROJECT_FOUNDATION.md Section 1, not
// imported from reference-data.ts, so this test can't pass by tautology.
const EXPECTED_ADDRESSES: Record<
  string,
  { addressLine1: string; city: string; state: string; postalCode: string }
> = {
  TPE: {
    addressLine1: "8505 S Western Ave",
    city: "Los Angeles",
    state: "CA",
    postalCode: "90047",
  },
  "TAT-56": {
    addressLine1: "10000 S Western Ave",
    city: "Los Angeles",
    state: "CA",
    postalCode: "90047",
  },
  "TAT-78": {
    addressLine1: "10045 S Western Ave",
    city: "Los Angeles",
    state: "CA",
    postalCode: "90047",
  },
  TTHS: {
    addressLine1: "10616 S Western Ave",
    city: "Los Angeles",
    state: "CA",
    postalCode: "90047",
  },
  CMO: {
    addressLine1: "10600 S Western Ave",
    city: "Los Angeles",
    state: "CA",
    postalCode: "90047",
  },
};

describe("database foundation", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  beforeAll(async () => {
    client = new PGlite();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
  });

  afterAll(async () => {
    await client.close();
  });

  it("applies the committed migrations to a fresh database containing only the approved Phase 2 tables", async () => {
    const result = await db.execute<{ table_name: string }>(sql`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name
    `);
    const tableNames = result.rows.map((row) => row.table_name);
    expect(tableNames).toEqual([
      "organizations",
      "schools",
      "service_locations",
    ]);
  });

  it("seeds exactly the canonical reference data with correct relationships and addresses", async () => {
    await seedReferenceData(db);

    const orgRows = await db.select().from(organizations);
    expect(orgRows).toHaveLength(1);
    expect(orgRows[0].code).toBe("TEACHPS");
    expect(orgRows[0].name).toBe("TEACH Public Schools");

    const schoolRows = await db.select().from(schools);
    expect(schoolRows).toHaveLength(3);

    const locationRows = await db.select().from(serviceLocations);
    expect(locationRows).toHaveLength(6);

    const [tpeSchool] = await db
      .select()
      .from(schools)
      .where(eq(schools.code, "TPE"));
    const [tatSchool] = await db
      .select()
      .from(schools)
      .where(eq(schools.code, "TAT"));
    const [tthsSchool] = await db
      .select()
      .from(schools)
      .where(eq(schools.code, "TTHS"));

    const byCode = new Map(locationRows.map((row) => [row.code, row]));

    // TAT-56 and TAT-78 reference the same TAT school record.
    const tat56 = byCode.get("TAT-56")!;
    const tat78 = byCode.get("TAT-78")!;
    expect(tat56.schoolId).toBe(tatSchool.id);
    expect(tat78.schoolId).toBe(tatSchool.id);
    expect(tat56.schoolId).toBe(tat78.schoolId);

    // TPE and TTHS reference their correct, distinct schools.
    expect(byCode.get("TPE")!.schoolId).toBe(tpeSchool.id);
    expect(byCode.get("TTHS")!.schoolId).toBe(tthsSchool.id);

    // CMO has no school association.
    const cmo = byCode.get("CMO")!;
    expect(cmo.schoolId).toBeNull();
    expect(cmo.locationType).toBe("central_office");

    // SYSTEM has no school association and no physical address.
    const system = byCode.get("SYSTEM")!;
    expect(system.schoolId).toBeNull();
    expect(system.locationType).toBe("system_wide");
    expect(system.addressLine1).toBeNull();
    expect(system.city).toBeNull();
    expect(system.state).toBeNull();
    expect(system.postalCode).toBeNull();

    // Every physical address matches the approved project foundation.
    for (const [code, expected] of Object.entries(EXPECTED_ADDRESSES)) {
      const row = byCode.get(code)!;
      expect(row.addressLine1).toBe(expected.addressLine1);
      expect(row.city).toBe(expected.city);
      expect(row.state).toBe(expected.state);
      expect(row.postalCode).toBe(expected.postalCode);
    }
  });

  it("is idempotent: reseeding leaves record counts and canonical data unchanged", async () => {
    await seedReferenceData(db);

    const orgRows = await db.select().from(organizations);
    const schoolRows = await db.select().from(schools);
    const locationRows = await db.select().from(serviceLocations);

    expect(orgRows).toHaveLength(1);
    expect(schoolRows).toHaveLength(3);
    expect(locationRows).toHaveLength(6);

    const [tatSchool] = await db
      .select()
      .from(schools)
      .where(eq(schools.code, "TAT"));
    const byCode = new Map(locationRows.map((row) => [row.code, row]));
    expect(byCode.get("TAT-56")!.schoolId).toBe(tatSchool.id);
    expect(byCode.get("TAT-78")!.schoolId).toBe(tatSchool.id);
    expect(byCode.get("CMO")!.schoolId).toBeNull();
    expect(byCode.get("SYSTEM")!.addressLine1).toBeNull();
  });

  it("rejects a duplicate code within the same organization", async () => {
    const [org] = await db.select().from(organizations);

    await expect(
      db.insert(schools).values({
        organizationId: org.id,
        code: "TPE",
        name: "Duplicate TPE",
        gradeBand: "TK-5",
      }),
    ).rejects.toThrow();
  });

  it("rejects a service location referencing a nonexistent school", async () => {
    const [org] = await db.select().from(organizations);

    await expect(
      db.insert(serviceLocations).values({
        organizationId: org.id,
        schoolId: "00000000-0000-0000-0000-000000000000",
        code: "GHOST",
        name: "Ghost campus",
        locationType: "school_campus",
        addressLine1: "1 Nowhere Way",
        city: "Nowhere",
        state: "CA",
        postalCode: "00000",
      }),
    ).rejects.toThrow();
  });

  it("rejects a service location whose school belongs to a different organization", async () => {
    const [otherOrg] = await db
      .insert(organizations)
      .values({ code: "OTHERORG", name: "Other Test Org" })
      .returning();
    const [tatSchool] = await db
      .select()
      .from(schools)
      .where(eq(schools.code, "TAT"));

    await expect(
      db.insert(serviceLocations).values({
        organizationId: otherOrg.id,
        schoolId: tatSchool.id,
        code: "CROSSORG",
        name: "Cross-organization campus",
        locationType: "school_campus",
        addressLine1: "1 Cross Org Way",
        city: "Nowhere",
        state: "CA",
        postalCode: "00000",
      }),
    ).rejects.toThrow();
  });

  it("rejects an invalid location-type structural combination", async () => {
    const [org] = await db.select().from(organizations);

    await expect(
      db.insert(serviceLocations).values({
        organizationId: org.id,
        code: "BADTYPE",
        name: "Invalid system-wide location with an address",
        locationType: "system_wide",
        addressLine1: "Should not be allowed",
        city: "Nowhere",
        state: "CA",
        postalCode: "00000",
      }),
    ).rejects.toThrow();
  });
});
