import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  setDepartmentMembership,
  setSystemAdministrator,
  setUserActive,
} from "../admin/admin-service";
import { listOrganizationUsers } from "../admin/admin-queries";
import { AdminAuthorizationError, AdminValidationError } from "../admin/errors";
import { isSupportStaff } from "../authz/policy";
import type { ResolvedActor } from "../authz/policy";
import { resolveActor } from "../authz/resolve-actor";
import { addTicketComment, createTicket } from "../tickets/ticket-service";
import { REFERENCE_ORGANIZATION } from "./reference-data";
import * as schema from "./schema";
import {
  departmentMemberships,
  departments,
  serviceLocations,
  ticketCategories,
  ticketComments,
  tickets,
  user,
} from "./schema";
import { seedReferenceData } from "./seed-reference-data";

describe("admin service and queries (Phase 8)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let itDepartmentId: string;
  let itCategoryId: string;
  let locationId: string;
  let userCounter = 0;

  beforeAll(async () => {
    client = new PGlite();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    await seedReferenceData(db);

    const [it] = await db
      .select()
      .from(departments)
      .where(eq(departments.code, "IT"));
    itDepartmentId = it.id;

    const [itCategory] = await db
      .select()
      .from(ticketCategories)
      .where(eq(ticketCategories.departmentId, itDepartmentId));
    itCategoryId = itCategory.id;

    const [location] = await db.select().from(serviceLocations).limit(1);
    locationId = location.id;
  });

  afterAll(async () => {
    await client.close();
  });

  async function createSyntheticUser(
    overrides: Partial<typeof user.$inferInsert> = {},
  ) {
    userCounter += 1;
    const [row] = await db
      .insert(user)
      .values({
        name: `Synthetic User ${userCounter}`,
        email: `synthetic.user.${userCounter}@teachps.org`,
        emailVerified: true,
        ...overrides,
      })
      .returning();
    return row;
  }

  async function actorForUser(userId: string): Promise<ResolvedActor> {
    return resolveActor(db, userId);
  }

  async function makeAdmin(userId: string): Promise<ResolvedActor> {
    await db
      .update(user)
      .set({ isSystemAdministrator: true })
      .where(eq(user.id, userId));
    return actorForUser(userId);
  }

  function forgedOrgAdminActor(userId: string): ResolvedActor {
    return {
      status: "active",
      userId,
      organizationId: "00000000-0000-0000-0000-00000000dead",
      isSystemAdministrator: true,
      departmentCodes: [],
    };
  }

  describe("listOrganizationUsers", () => {
    it("denies an anonymous, missing, or inactive actor", async () => {
      const anonymous: ResolvedActor = { status: "anonymous" };
      const missing: ResolvedActor = { status: "user_not_found" };
      const inactive: ResolvedActor = { status: "inactive" };
      await expect(listOrganizationUsers(db, anonymous)).rejects.toThrow(
        AdminAuthorizationError,
      );
      await expect(listOrganizationUsers(db, missing)).rejects.toThrow(
        AdminAuthorizationError,
      );
      await expect(listOrganizationUsers(db, inactive)).rejects.toThrow(
        AdminAuthorizationError,
      );
    });

    it("denies an active requester and an active department agent who is not an administrator", async () => {
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);
      await expect(listOrganizationUsers(db, requesterActor)).rejects.toThrow(
        AdminAuthorizationError,
      );

      const agent = await createSyntheticUser();
      await db.insert(departmentMemberships).values({
        userId: agent.id,
        departmentId: itDepartmentId,
        organizationId: REFERENCE_ORGANIZATION.id,
      });
      const agentActor = await actorForUser(agent.id);
      await expect(listOrganizationUsers(db, agentActor)).rejects.toThrow(
        AdminAuthorizationError,
      );
    });

    it("returns canonical-organization users sorted by display name", async () => {
      const admin = await createSyntheticUser({ name: "Zzz Admin" });
      const adminActor = await makeAdmin(admin.id);
      await createSyntheticUser({ name: "Bailey Staff" });
      await createSyntheticUser({ name: "Avery Staff" });

      const { users: results } = await listOrganizationUsers(db, adminActor);
      const names = results.map((u) => u.name);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    });

    it("includes department codes, active status, and administrator status", async () => {
      const admin = await createSyntheticUser();
      const adminActor = await makeAdmin(admin.id);
      const agent = await createSyntheticUser({ name: "Multi Agent" });
      await db.insert(departmentMemberships).values({
        userId: agent.id,
        departmentId: itDepartmentId,
        organizationId: REFERENCE_ORGANIZATION.id,
      });

      const { users: results } = await listOrganizationUsers(db, adminActor);
      const found = results.find((u) => u.id === agent.id);
      expect(found?.departmentCodes).toEqual(["IT"]);
      expect(found?.isActive).toBe(true);
      expect(found?.isSystemAdministrator).toBe(false);
    });

    it("never returns a field beyond display name, email, active status, administrator status, and department codes", async () => {
      const admin = await createSyntheticUser();
      const adminActor = await makeAdmin(admin.id);

      const { users: results } = await listOrganizationUsers(db, adminActor);
      const [firstUser] = results;
      expect(Object.keys(firstUser).sort()).toEqual(
        [
          "departmentCodes",
          "email",
          "id",
          "isActive",
          "isSystemAdministrator",
          "name",
        ].sort(),
      );
    });

    it("searches by name or email, case-insensitively", async () => {
      const admin = await createSyntheticUser();
      const adminActor = await makeAdmin(admin.id);
      await createSyntheticUser({
        name: "Jamie Requester",
        email: "jamie.requester@teachps.org",
      });
      await createSyntheticUser({
        name: "Alex Agent",
        email: "alex.agent@teachps.org",
      });

      const byName = await listOrganizationUsers(db, adminActor, "jamie");
      expect(byName.users.map((u) => u.name)).toEqual(["Jamie Requester"]);

      const byEmail = await listOrganizationUsers(
        db,
        adminActor,
        "ALEX.AGENT@TEACHPS",
      );
      expect(byEmail.users.map((u) => u.name)).toEqual(["Alex Agent"]);
    });

    it("scopes strictly to the actor's own organization, even for a system administrator", async () => {
      const admin = await createSyntheticUser();
      const forgedActor = forgedOrgAdminActor(admin.id);

      const { users: results } = await listOrganizationUsers(db, forgedActor);
      expect(results).toEqual([]);
    });
  });

  describe("setDepartmentMembership", () => {
    it("allows an administrator to add and remove IT membership", async () => {
      const admin = await createSyntheticUser();
      const adminActor = await makeAdmin(admin.id);
      const target = await createSyntheticUser();

      await setDepartmentMembership(db, adminActor, target.id, "IT", true);
      let rows = await db
        .select()
        .from(departmentMemberships)
        .where(eq(departmentMemberships.userId, target.id));
      expect(rows).toHaveLength(1);

      await setDepartmentMembership(db, adminActor, target.id, "IT", false);
      rows = await db
        .select()
        .from(departmentMemberships)
        .where(eq(departmentMemberships.userId, target.id));
      expect(rows).toHaveLength(0);
    });

    it("allows an administrator to add and remove Facilities membership", async () => {
      const admin = await createSyntheticUser();
      const adminActor = await makeAdmin(admin.id);
      const target = await createSyntheticUser();

      await setDepartmentMembership(
        db,
        adminActor,
        target.id,
        "FACILITIES",
        true,
      );
      const { users: results } = await listOrganizationUsers(db, adminActor);
      expect(results.find((u) => u.id === target.id)?.departmentCodes).toEqual([
        "FACILITIES",
      ]);

      await setDepartmentMembership(
        db,
        adminActor,
        target.id,
        "FACILITIES",
        false,
      );
      const { users: after } = await listOrganizationUsers(db, adminActor);
      expect(after.find((u) => u.id === target.id)?.departmentCodes).toEqual(
        [],
      );
    });

    it("is idempotent when adding a membership that already exists", async () => {
      const admin = await createSyntheticUser();
      const adminActor = await makeAdmin(admin.id);
      const target = await createSyntheticUser();

      await setDepartmentMembership(db, adminActor, target.id, "IT", true);
      await setDepartmentMembership(db, adminActor, target.id, "IT", true);

      const rows = await db
        .select()
        .from(departmentMemberships)
        .where(eq(departmentMemberships.userId, target.id));
      expect(rows).toHaveLength(1);
    });

    it("safely no-ops when removing a membership that does not exist", async () => {
      const admin = await createSyntheticUser();
      const adminActor = await makeAdmin(admin.id);
      const target = await createSyntheticUser();

      await expect(
        setDepartmentMembership(db, adminActor, target.id, "IT", false),
      ).resolves.toBeUndefined();
    });

    it("denies a non-administrator's mutation", async () => {
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);
      const target = await createSyntheticUser();

      await expect(
        setDepartmentMembership(db, requesterActor, target.id, "IT", true),
      ).rejects.toThrow(AdminAuthorizationError);
    });

    it("ignores a forged actor organization and denies the change", async () => {
      const admin = await createSyntheticUser();
      const forgedActor = forgedOrgAdminActor(admin.id);
      const target = await createSyntheticUser();

      await expect(
        setDepartmentMembership(db, forgedActor, target.id, "IT", true),
      ).rejects.toThrow(AdminValidationError);
    });

    it("rejects an invalid department code", async () => {
      const admin = await createSyntheticUser();
      const adminActor = await makeAdmin(admin.id);
      const target = await createSyntheticUser();

      await expect(
        setDepartmentMembership(db, adminActor, target.id, "BOGUS", true),
      ).rejects.toThrow(AdminValidationError);
    });

    it("affects support-workspace access immediately", async () => {
      const admin = await createSyntheticUser();
      const adminActor = await makeAdmin(admin.id);
      const target = await createSyntheticUser();

      expect(isSupportStaff(await actorForUser(target.id))).toBe(false);

      await setDepartmentMembership(db, adminActor, target.id, "IT", true);
      expect(isSupportStaff(await actorForUser(target.id))).toBe(true);

      await setDepartmentMembership(db, adminActor, target.id, "IT", false);
      expect(isSupportStaff(await actorForUser(target.id))).toBe(false);
    });
  });

  describe("setUserActive", () => {
    it("allows an administrator to deactivate and reactivate another user", async () => {
      const admin = await createSyntheticUser();
      const adminActor = await makeAdmin(admin.id);
      const target = await createSyntheticUser();

      await setUserActive(db, adminActor, target.id, false);
      expect((await actorForUser(target.id)).status).toBe("inactive");

      await setUserActive(db, adminActor, target.id, true);
      expect((await actorForUser(target.id)).status).toBe("active");
    });

    it("prevents an administrator from deactivating themselves", async () => {
      const admin = await createSyntheticUser();
      const adminActor = await makeAdmin(admin.id);

      await expect(
        setUserActive(db, adminActor, admin.id, false),
      ).rejects.toThrow(AdminValidationError);

      const [row] = await db.select().from(user).where(eq(user.id, admin.id));
      expect(row.isActive).toBe(true);
    });

    it("denies a non-administrator's mutation", async () => {
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);
      const target = await createSyntheticUser();

      await expect(
        setUserActive(db, requesterActor, target.id, false),
      ).rejects.toThrow(AdminAuthorizationError);
    });

    it("leaves a deactivated user's tickets and comments intact", async () => {
      const admin = await createSyntheticUser();
      const adminActor = await makeAdmin(admin.id);
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);

      const ticket = await createTicket(db, requesterActor, {
        departmentId: itDepartmentId,
        serviceLocationId: locationId,
        categoryId: itCategoryId,
        subject: "Chromebook will not power on",
        description: "The screen stays black even after a full charge.",
      });
      const comment = await addTicketComment(
        db,
        requesterActor,
        ticket.id,
        "Any update on this?",
      );

      await setUserActive(db, adminActor, requester.id, false);

      const [reloadedTicket] = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, ticket.id));
      const [reloadedComment] = await db
        .select()
        .from(ticketComments)
        .where(eq(ticketComments.id, comment.id));
      expect(reloadedTicket).toBeDefined();
      expect(reloadedTicket.subject).toBe("Chromebook will not power on");
      expect(reloadedComment).toBeDefined();
      expect(reloadedComment.body).toBe("Any update on this?");
    });

    it("fails existing requester and support authorization immediately once deactivated", async () => {
      const admin = await createSyntheticUser();
      const adminActor = await makeAdmin(admin.id);
      const agent = await createSyntheticUser();
      await db.insert(departmentMemberships).values({
        userId: agent.id,
        departmentId: itDepartmentId,
        organizationId: REFERENCE_ORGANIZATION.id,
      });

      expect(isSupportStaff(await actorForUser(agent.id))).toBe(true);
      await setUserActive(db, adminActor, agent.id, false);

      const deactivatedActor = await actorForUser(agent.id);
      expect(deactivatedActor.status).toBe("inactive");
      expect(isSupportStaff(deactivatedActor)).toBe(false);
    });
  });

  describe("setSystemAdministrator", () => {
    it("allows an administrator to grant administrator access to another active user", async () => {
      const admin = await createSyntheticUser();
      const adminActor = await makeAdmin(admin.id);
      const target = await createSyntheticUser();

      await setSystemAdministrator(db, adminActor, target.id, true);
      const targetActor = await actorForUser(target.id);
      expect(
        targetActor.status === "active" && targetActor.isSystemAdministrator,
      ).toBe(true);
    });

    it("allows an administrator to remove administrator access from another administrator", async () => {
      const admin = await createSyntheticUser();
      const adminActor = await makeAdmin(admin.id);
      const otherAdmin = await createSyntheticUser();
      await makeAdmin(otherAdmin.id);

      await setSystemAdministrator(db, adminActor, otherAdmin.id, false);
      const otherActor = await actorForUser(otherAdmin.id);
      expect(
        otherActor.status === "active" && otherActor.isSystemAdministrator,
      ).toBe(false);
    });

    it("prevents an administrator from removing their own administrator access", async () => {
      const admin = await createSyntheticUser();
      const adminActor = await makeAdmin(admin.id);

      await expect(
        setSystemAdministrator(db, adminActor, admin.id, false),
      ).rejects.toThrow(AdminValidationError);

      const [row] = await db.select().from(user).where(eq(user.id, admin.id));
      expect(row.isSystemAdministrator).toBe(true);
    });

    it("denies an ordinary requester or department agent from granting administrator access", async () => {
      const requester = await createSyntheticUser();
      const requesterActor = await actorForUser(requester.id);
      const agent = await createSyntheticUser();
      await db.insert(departmentMemberships).values({
        userId: agent.id,
        departmentId: itDepartmentId,
        organizationId: REFERENCE_ORGANIZATION.id,
      });
      const agentActor = await actorForUser(agent.id);
      const target = await createSyntheticUser();

      await expect(
        setSystemAdministrator(db, requesterActor, target.id, true),
      ).rejects.toThrow(AdminAuthorizationError);
      await expect(
        setSystemAdministrator(db, agentActor, target.id, true),
      ).rejects.toThrow(AdminAuthorizationError);
    });

    it("denies a cross-organization change", async () => {
      const admin = await createSyntheticUser();
      const forgedActor = forgedOrgAdminActor(admin.id);
      const target = await createSyntheticUser();

      await expect(
        setSystemAdministrator(db, forgedActor, target.id, true),
      ).rejects.toThrow(AdminValidationError);
    });
  });
});
