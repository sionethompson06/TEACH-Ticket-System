import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "./schema";
import {
  account,
  organizations,
  schools,
  serviceLocations,
  session,
  user,
} from "./schema";
import { REFERENCE_ORGANIZATION } from "./reference-data";
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

  it("applies the committed migrations to a fresh database containing only the approved Phase 2 and Phase 3 tables", async () => {
    const result = await db.execute<{ table_name: string }>(sql`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name
    `);
    const tableNames = result.rows.map((row) => row.table_name);
    // Exact list — this is also how we prove no department, permission,
    // grant, ticket, queue, catalog, or other Phase 4+ table exists.
    expect(tableNames).toEqual([
      "account",
      "organizations",
      "schools",
      "service_locations",
      "session",
      "user",
      "verification",
    ]);
  });

  it("applies the 0000, 0001, and 0002 migrations, in order", async () => {
    const result = await db.execute<{ count: number }>(sql`
      select count(*)::int as count from drizzle.__drizzle_migrations
    `);
    expect(result.rows[0]?.count).toBe(3);
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

  it("rejects a system-wide location with a non-null address_line2 even when every other address field is null", async () => {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.code, "TEACHPS"));

    await expect(
      db.insert(serviceLocations).values({
        organizationId: org.id,
        code: "BADLINE2",
        name: "Invalid system-wide location with address_line2 set",
        locationType: "system_wide",
        addressLine2: "Suite 100",
      }),
    ).rejects.toThrow();
  });

  it("accepts a system-wide location only when every address field, including address_line2, is null", async () => {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.code, "TEACHPS"));

    const [row] = await db
      .insert(serviceLocations)
      .values({
        organizationId: org.id,
        code: "SYSTEMOK",
        name: "Valid system-wide location",
        locationType: "system_wide",
      })
      .returning();

    expect(row.schoolId).toBeNull();
    expect(row.addressLine1).toBeNull();
    expect(row.addressLine2).toBeNull();
    expect(row.city).toBeNull();
    expect(row.state).toBeNull();
    expect(row.postalCode).toBeNull();
  });

  it("allows an optional address_line2 on a physical school-campus location", async () => {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.code, "TEACHPS"));
    const [tatSchool] = await db
      .select()
      .from(schools)
      .where(eq(schools.code, "TAT"));

    const [row] = await db
      .insert(serviceLocations)
      .values({
        organizationId: org.id,
        schoolId: tatSchool.id,
        code: "TAT-99",
        name: "Physical location with address_line2",
        locationType: "school_campus",
        addressLine1: "123 Test Way",
        addressLine2: "Suite 200",
        city: "Los Angeles",
        state: "CA",
        postalCode: "90047",
      })
      .returning();

    expect(row.addressLine2).toBe("Suite 200");
  });

  it("defaults a new user to the canonical TEACH organization and the requester base role", async () => {
    const [row] = await db
      .insert(user)
      .values({
        name: "Sample Staff Member",
        email: "sample.staff@teachps.org",
        emailVerified: true,
      })
      .returning();

    expect(row.organizationId).toBe(REFERENCE_ORGANIZATION.id);
    expect(row.baseRole).toBe("requester");
  });

  it("rejects a user with any base role other than requester", async () => {
    await expect(
      db.insert(user).values({
        name: "Attempted Admin",
        email: "attempted.admin@teachps.org",
        emailVerified: true,
        baseRole: "system_administrator",
      }),
    ).rejects.toThrow();
  });

  it("rejects a user whose email is not verified", async () => {
    await expect(
      db.insert(user).values({
        name: "Unverified Person",
        email: "unverified.person@teachps.org",
        emailVerified: false,
      }),
    ).rejects.toThrow();
  });

  it("rejects a user whose email domain is not teachps.org", async () => {
    await expect(
      db.insert(user).values({
        name: "Outside Person",
        email: "outside.person@gmail.com",
        emailVerified: true,
      }),
    ).rejects.toThrow();
  });

  it("rejects a duplicate Google provider account for the same subject", async () => {
    const [owner] = await db
      .insert(user)
      .values({
        name: "Duplicate Sub Owner",
        email: "duplicate.sub.owner@teachps.org",
        emailVerified: true,
      })
      .returning();

    await db.insert(account).values({
      accountId: "108000000000000000001",
      providerId: "google",
      userId: owner.id,
    });

    await expect(
      db.insert(account).values({
        accountId: "108000000000000000001",
        providerId: "google",
        userId: owner.id,
      }),
    ).rejects.toThrow();
  });

  it("rejects a provider account referencing a nonexistent user", async () => {
    await expect(
      db.insert(account).values({
        accountId: "108000000000000000099",
        providerId: "google",
        userId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow();
  });

  it("rejects a session referencing a nonexistent user", async () => {
    await expect(
      db.insert(session).values({
        token: "test-session-token-not-a-real-secret",
        userId: "00000000-0000-0000-0000-000000000000",
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      }),
    ).rejects.toThrow();
  });

  it("rejects a provider account with a persisted access token, refresh token, id token, or password", async () => {
    const [owner] = await db
      .insert(user)
      .values({
        name: "Token Owner",
        email: "token.owner@teachps.org",
        emailVerified: true,
      })
      .returning();

    await expect(
      db.insert(account).values({
        accountId: "108000000000000000002",
        providerId: "google",
        userId: owner.id,
        accessToken: "should-never-be-persisted",
      }),
    ).rejects.toThrow();

    await expect(
      db.insert(account).values({
        accountId: "108000000000000000003",
        providerId: "google",
        userId: owner.id,
        refreshToken: "should-never-be-persisted",
      }),
    ).rejects.toThrow();

    await expect(
      db.insert(account).values({
        accountId: "108000000000000000004",
        providerId: "google",
        userId: owner.id,
        idToken: "should-never-be-persisted",
      }),
    ).rejects.toThrow();

    await expect(
      db.insert(account).values({
        accountId: "108000000000000000005",
        providerId: "google",
        userId: owner.id,
        password: "should-never-be-persisted",
      }),
    ).rejects.toThrow();
  });

  it("rejects an account with a provider other than google", async () => {
    const [owner] = await db
      .select()
      .from(user)
      .where(eq(user.email, "token.owner@teachps.org"));

    await expect(
      db.insert(account).values({
        accountId: "some-other-provider-account-id",
        providerId: "github",
        userId: owner.id,
      }),
    ).rejects.toThrow();
  });
});
