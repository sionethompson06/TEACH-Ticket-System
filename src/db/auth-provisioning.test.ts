import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildBetterAuthOptions } from "../auth/auth-options";
import { insertPendingInvitation } from "../auth/invitations";
import { resolveActor } from "../authz/resolve-actor";
import { REFERENCE_ORGANIZATION } from "./reference-data";
import * as schema from "./schema";
import { authInvitations, departmentMemberships, user } from "./schema";
import { seedReferenceData } from "./seed-reference-data";

// End-to-end (real PGlite, real schema constraints) exercise of the
// invite_only provisioning path: the actual databaseHooks.user.create
// before/after functions Better Auth calls during a real OAuth sign-in,
// invoked directly against a synthetic database. This is the strongest
// available proof short of driving a full HTTP OAuth round trip (which
// would need a live Google identity provider), and it never contacts
// Google or any external service.
describe("invite-only provisioning hooks (Phase 9A, synthetic data only)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;

  beforeAll(async () => {
    client = new PGlite();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    await seedReferenceData(db);
  });

  afterAll(async () => {
    await client.close();
  });

  function buildInviteOnlyHooks() {
    const options = buildBetterAuthOptions({
      db,
      googleClientId: "test-client-id",
      googleClientSecret: "test-client-secret",
      baseUrl: "https://example-teach-ticket-system.test",
      secret: "test-secret-value-not-a-real-secret",
      accessMode: { kind: "invite_only" },
    });
    const before = options.databaseHooks?.user?.create?.before;
    const after = options.databaseHooks?.user?.create?.after;
    if (!before || !after) {
      throw new Error("Expected user.create before/after hooks to be defined");
    }
    return { before, after };
  }

  async function simulateFirstSignIn(email: string) {
    const { before, after } = buildInviteOnlyHooks();
    const result = await before(
      {
        id: "provider-assigned-id",
        name: "Pilot Tester",
        email,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      null,
    );

    if (result === false) {
      return { provisioned: false as const };
    }

    const data = (result as { data: Record<string, unknown> }).data;
    const [createdUser] = await db
      .insert(user)
      .values({
        name: data.name as string,
        email: (data.email as string).toLowerCase(),
        emailVerified: true,
        organizationId: data.organizationId as string,
        baseRole: data.baseRole as string,
      })
      .returning();

    await after(createdUser, null);
    return { provisioned: true as const, user: createdUser };
  }

  it("denies provisioning for a noninvited address", async () => {
    const result = await simulateFirstSignIn("never.invited@example.com");
    expect(result.provisioned).toBe(false);

    const rows = await db
      .select()
      .from(user)
      .where(eq(user.email, "never.invited@example.com"));
    expect(rows).toHaveLength(0);
  });

  it("allows provisioning for an invited personal Gmail address and marks the invitation accepted", async () => {
    const email = "invited.personal@gmail.com";
    await insertPendingInvitation(db, {
      organizationId: REFERENCE_ORGANIZATION.id,
      email,
      createdSource: "cli",
    });

    const result = await simulateFirstSignIn(email);
    expect(result.provisioned).toBe(true);
    if (!result.provisioned) return;

    expect(result.user.organizationId).toBe(REFERENCE_ORGANIZATION.id);
    expect(result.user.baseRole).toBe("requester");
    expect(result.user.isSystemAdministrator).toBe(false);

    const [invitation] = await db
      .select()
      .from(authInvitations)
      .where(eq(authInvitations.email, email));
    expect(invitation.status).toBe("accepted");
    expect(invitation.acceptedByUserId).toBe(result.user.id);

    const memberships = await db
      .select()
      .from(departmentMemberships)
      .where(eq(departmentMemberships.userId, result.user.id));
    expect(memberships).toHaveLength(0);
  });

  it("allows provisioning for an invited address on another Workspace domain", async () => {
    const email = "invited.person@another-school.org";
    await insertPendingInvitation(db, {
      organizationId: REFERENCE_ORGANIZATION.id,
      email,
      createdSource: "admin_ui",
    });

    const result = await simulateFirstSignIn(email);
    expect(result.provisioned).toBe(true);
  });

  it("denies provisioning for a revoked invitation", async () => {
    const email = "was.invited.then.revoked@example.com";
    const invitation = await insertPendingInvitation(db, {
      organizationId: REFERENCE_ORGANIZATION.id,
      email,
      createdSource: "cli",
    });
    const revokingAdmin = await db
      .insert(user)
      .values({
        name: "Revoking Admin",
        email: "revoking.admin@example.com",
        emailVerified: true,
      })
      .returning();
    await db
      .update(authInvitations)
      .set({
        status: "revoked",
        revokedAt: new Date(),
        revokedByUserId: revokingAdmin[0].id,
      })
      .where(eq(authInvitations.id, invitation.id));

    const result = await simulateFirstSignIn(email);
    expect(result.provisioned).toBe(false);

    const rows = await db.select().from(user).where(eq(user.email, email));
    expect(rows).toHaveLength(0);
  });

  it("is safe if the accept hook is somehow invoked twice for the same provisioning (retry safety)", async () => {
    const email = "retry.safe@example.com";
    await insertPendingInvitation(db, {
      organizationId: REFERENCE_ORGANIZATION.id,
      email,
      createdSource: "cli",
    });
    const result = await simulateFirstSignIn(email);
    expect(result.provisioned).toBe(true);
    if (!result.provisioned) return;

    const { after } = buildInviteOnlyHooks();
    // A second, retried "after" call for the same user must not throw and
    // must not change the already-accepted invitation.
    await expect(after(result.user, null)).resolves.not.toThrow();

    const [invitation] = await db
      .select()
      .from(authInvitations)
      .where(eq(authInvitations.email, email));
    expect(invitation.status).toBe("accepted");
    expect(invitation.acceptedByUserId).toBe(result.user.id);
  });

  it("an inactive invited/accepted user is still denied by the existing active-actor check", async () => {
    const email = "accepted.then.deactivated@example.com";
    await insertPendingInvitation(db, {
      organizationId: REFERENCE_ORGANIZATION.id,
      email,
      createdSource: "cli",
    });
    const result = await simulateFirstSignIn(email);
    expect(result.provisioned).toBe(true);
    if (!result.provisioned) return;

    await db
      .update(user)
      .set({ isActive: false })
      .where(eq(user.id, result.user.id));

    const actor = await resolveActor(db, result.user.id);
    expect(actor.status).toBe("inactive");
  });
});
