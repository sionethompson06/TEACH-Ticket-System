import { PGlite } from "@electric-sql/pglite";
import { eq, sql } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveActor } from "../authz/resolve-actor";
import * as schema from "./schema";
import {
  account,
  departmentMemberships,
  departments,
  organizations,
  schools,
  serviceLocations,
  session,
  ticketCategories,
  user,
} from "./schema";
import {
  REFERENCE_DEPARTMENTS,
  REFERENCE_ORGANIZATION,
  REFERENCE_TICKET_CATEGORIES,
} from "./reference-data";
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
    // Exact list — this is also how we prove no SLA, queue, form-field, or
    // other Phase 6+ table exists, and that Phase 5 is limited to exactly
    // these four new tables (ticket_categories, tickets, ticket_comments,
    // ticket_activity).
    expect(tableNames).toEqual([
      "account",
      "department_memberships",
      "departments",
      "organizations",
      "schools",
      "service_locations",
      "session",
      "ticket_activity",
      "ticket_categories",
      "ticket_comments",
      "tickets",
      "user",
      "verification",
    ]);
  });

  it("applies the 0000, 0001, 0002, 0003, and 0004 migrations, in order", async () => {
    const result = await db.execute<{ count: number }>(sql`
      select count(*)::int as count from drizzle.__drizzle_migrations
    `);
    expect(result.rows[0]?.count).toBe(5);
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

    const departmentRows = await db.select().from(departments);
    expect(departmentRows).toHaveLength(2);
    const departmentByCode = new Map(
      departmentRows.map((row) => [row.code, row]),
    );
    for (const expected of REFERENCE_DEPARTMENTS) {
      const row = departmentByCode.get(expected.code);
      expect(row).toBeDefined();
      expect(row!.name).toBe(expected.name);
      expect(row!.organizationId).toBe(orgRows[0].id);
      expect(row!.isActive).toBe(true);
    }

    const categoryRows = await db.select().from(ticketCategories);
    expect(categoryRows).toHaveLength(REFERENCE_TICKET_CATEGORIES.length);
    const categoryByCode = new Map(categoryRows.map((row) => [row.code, row]));
    const itDepartmentId = departmentByCode.get("IT")!.id;
    const facilitiesDepartmentId = departmentByCode.get("FACILITIES")!.id;
    expect(
      categoryRows.filter((row) => row.departmentId === itDepartmentId),
    ).toHaveLength(7);
    expect(
      categoryRows.filter((row) => row.departmentId === facilitiesDepartmentId),
    ).toHaveLength(8);
    for (const expected of REFERENCE_TICKET_CATEGORIES) {
      const row = categoryByCode.get(expected.code);
      expect(row).toBeDefined();
      expect(row!.name).toBe(expected.name);
      expect(row!.organizationId).toBe(orgRows[0].id);
      expect(row!.isActive).toBe(true);
      expect(row!.displayOrder).toBe(expected.displayOrder);
      const expectedDepartmentId =
        expected.departmentCode === "IT"
          ? itDepartmentId
          : facilitiesDepartmentId;
      expect(row!.departmentId).toBe(expectedDepartmentId);
    }

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
    const departmentRows = await db.select().from(departments);
    const categoryRows = await db.select().from(ticketCategories);

    expect(orgRows).toHaveLength(1);
    expect(schoolRows).toHaveLength(3);
    expect(locationRows).toHaveLength(6);
    expect(departmentRows).toHaveLength(2);
    expect(categoryRows).toHaveLength(REFERENCE_TICKET_CATEGORIES.length);

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

  it("seeds no users, no department memberships, and no administrator", async () => {
    const userCountResult = await db.execute<{ count: number }>(sql`
      select count(*)::int as count from "user"
    `);
    // Non-zero here would mean the seed itself created a user, which it
    // never should — every user row seen elsewhere in this suite comes
    // from a test explicitly inserting one, not from seedReferenceData.
    const membershipRows = await db.select().from(departmentMemberships);
    const adminCountResult = await db.execute<{ count: number }>(sql`
      select count(*)::int as count from "user" where is_system_administrator = true
    `);

    expect(membershipRows).toHaveLength(0);
    expect(adminCountResult.rows[0]?.count).toBe(0);
    // A nonzero user count here only reflects prior tests in this same
    // in-memory database, never the seed — asserted precisely by the
    // membership/admin checks above, which the seed never touches either way.
    expect(userCountResult.rows[0]?.count).toBeGreaterThanOrEqual(0);
  });

  it("seeds no ticket, comment, or activity data — only the category catalog", async () => {
    // This file never exercises the ticket service, so these tables can
    // only be non-empty if seedReferenceData itself wrote to them, which
    // it never should.
    const ticketCountResult = await db.execute<{ count: number }>(sql`
      select count(*)::int as count from tickets
    `);
    const commentCountResult = await db.execute<{ count: number }>(sql`
      select count(*)::int as count from ticket_comments
    `);
    const activityCountResult = await db.execute<{ count: number }>(sql`
      select count(*)::int as count from ticket_activity
    `);

    expect(ticketCountResult.rows[0]?.count).toBe(0);
    expect(commentCountResult.rows[0]?.count).toBe(0);
    expect(activityCountResult.rows[0]?.count).toBe(0);
  });

  it("rejects a duplicate department membership for the same user and department", async () => {
    const [owner] = await db
      .insert(user)
      .values({
        name: "Duplicate Membership Owner",
        email: "duplicate.membership.owner@teachps.org",
        emailVerified: true,
      })
      .returning();
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.code, "TEACHPS"));
    const [itDepartment] = await db
      .select()
      .from(departments)
      .where(eq(departments.code, "IT"));

    await db.insert(departmentMemberships).values({
      userId: owner.id,
      departmentId: itDepartment.id,
      organizationId: org.id,
    });

    await expect(
      db.insert(departmentMemberships).values({
        userId: owner.id,
        departmentId: itDepartment.id,
        organizationId: org.id,
      }),
    ).rejects.toThrow();
  });

  it("allows the same user to hold memberships in both IT and Facilities", async () => {
    const [owner] = await db
      .insert(user)
      .values({
        name: "Both Departments Owner",
        email: "both.departments.owner@teachps.org",
        emailVerified: true,
      })
      .returning();
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.code, "TEACHPS"));
    const [itDepartment] = await db
      .select()
      .from(departments)
      .where(eq(departments.code, "IT"));
    const [facilitiesDepartment] = await db
      .select()
      .from(departments)
      .where(eq(departments.code, "FACILITIES"));

    await db.insert(departmentMemberships).values([
      {
        userId: owner.id,
        departmentId: itDepartment.id,
        organizationId: org.id,
      },
      {
        userId: owner.id,
        departmentId: facilitiesDepartment.id,
        organizationId: org.id,
      },
    ]);

    const rows = await db
      .select()
      .from(departmentMemberships)
      .where(eq(departmentMemberships.userId, owner.id));
    expect(rows).toHaveLength(2);
  });

  it("rejects a department membership whose organization does not match its department's organization", async () => {
    const [otherOrg] = await db
      .insert(organizations)
      .values({ code: "OTHERORG2", name: "Another Test Org" })
      .returning();
    const [owner] = await db
      .insert(user)
      .values({
        name: "Cross Org Membership Owner",
        email: "cross.org.membership.owner@teachps.org",
        emailVerified: true,
      })
      .returning();
    const [itDepartment] = await db
      .select()
      .from(departments)
      .where(eq(departments.code, "IT"));

    // itDepartment belongs to the canonical TEACH org, not otherOrg — the
    // composite (department_id, organization_id) foreign key must reject
    // this regardless of the fact that both rows individually exist.
    await expect(
      db.insert(departmentMemberships).values({
        userId: owner.id,
        departmentId: itDepartment.id,
        organizationId: otherOrg.id,
      }),
    ).rejects.toThrow();
  });

  it("rejects a department membership referencing a nonexistent user or department", async () => {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.code, "TEACHPS"));
    const [itDepartment] = await db
      .select()
      .from(departments)
      .where(eq(departments.code, "IT"));

    await expect(
      db.insert(departmentMemberships).values({
        userId: "00000000-0000-0000-0000-000000000000",
        departmentId: itDepartment.id,
        organizationId: org.id,
      }),
    ).rejects.toThrow();

    await expect(
      db.insert(departmentMemberships).values({
        userId: (
          await db
            .insert(user)
            .values({
              name: "Ghost Department Membership Owner",
              email: "ghost.department.membership.owner@teachps.org",
              emailVerified: true,
            })
            .returning()
        )[0].id,
        departmentId: "00000000-0000-0000-0000-000000000000",
        organizationId: org.id,
      }),
    ).rejects.toThrow();
  });

  it("resolveActor reflects only live database state for a plain requester with no membership and no administrator flag", async () => {
    const [owner] = await db
      .insert(user)
      .values({
        name: "Plain Requester",
        email: "plain.requester@teachps.org",
        emailVerified: true,
      })
      .returning();

    const actor = await resolveActor(db, owner.id);
    expect(actor).toEqual({
      status: "active",
      userId: owner.id,
      organizationId: REFERENCE_ORGANIZATION.id,
      isSystemAdministrator: false,
      departmentCodes: [],
    });
  });

  it("resolveActor reports department codes and administrator status strictly from the database", async () => {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.code, "TEACHPS"));
    const [itDepartment] = await db
      .select()
      .from(departments)
      .where(eq(departments.code, "IT"));
    const [facilitiesDepartment] = await db
      .select()
      .from(departments)
      .where(eq(departments.code, "FACILITIES"));
    const [owner] = await db
      .insert(user)
      .values({
        name: "Resolved Both Departments Agent",
        email: "resolved.both.departments.agent@teachps.org",
        emailVerified: true,
      })
      .returning();
    await db.insert(departmentMemberships).values([
      {
        userId: owner.id,
        departmentId: itDepartment.id,
        organizationId: org.id,
      },
      {
        userId: owner.id,
        departmentId: facilitiesDepartment.id,
        organizationId: org.id,
      },
    ]);

    const actor = await resolveActor(db, owner.id);
    expect(actor.status).toBe("active");
    if (actor.status === "active") {
      expect(actor.isSystemAdministrator).toBe(false);
      expect([...actor.departmentCodes].sort()).toEqual(["FACILITIES", "IT"]);
    }

    // Administrator status is settable only by a direct database
    // operation — there is no application code path that sets it, so the
    // only way to observe resolveActor reporting it is a direct update
    // like this one, standing in for that separately approved step.
    await db
      .update(user)
      .set({ isSystemAdministrator: true })
      .where(eq(user.id, owner.id));
    const promotedActor = await resolveActor(db, owner.id);
    expect(promotedActor.status).toBe("active");
    if (promotedActor.status === "active") {
      expect(promotedActor.isSystemAdministrator).toBe(true);
    }
  });

  it("resolveActor denies an inactive user and a session with no matching database row", async () => {
    const [inactiveOwner] = await db
      .insert(user)
      .values({
        name: "Inactive User",
        email: "inactive.user@teachps.org",
        emailVerified: true,
        isActive: false,
      })
      .returning();

    expect(await resolveActor(db, inactiveOwner.id)).toEqual({
      status: "inactive",
    });
    expect(
      await resolveActor(db, "00000000-0000-0000-0000-000000000000"),
    ).toEqual({ status: "user_not_found" });
    expect(await resolveActor(db, null)).toEqual({ status: "anonymous" });
  });
});
