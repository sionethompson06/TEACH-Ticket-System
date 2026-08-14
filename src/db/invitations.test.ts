import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AuthAccessMode } from "../auth/access-mode";
import { bootstrapInvitation } from "../auth/invite-bootstrap";
import {
  acceptPendingInvitation,
  findLatestInvitation,
  findPendingInvitation,
  insertPendingInvitation,
} from "../auth/invitations";
import {
  createInvitation,
  listInvitationsForAdmin,
  revokeInvitation,
} from "../admin/invitations";
import { AdminAuthorizationError, AdminValidationError } from "../admin/errors";
import { resolveActor } from "../authz/resolve-actor";
import type { ResolvedActor } from "../authz/policy";
import { REFERENCE_ORGANIZATION } from "./reference-data";
import * as schema from "./schema";
import {
  authInvitations,
  departmentMemberships,
  departments,
  user,
} from "./schema";
import { seedReferenceData } from "./seed-reference-data";

const INVITE_ONLY_MODE: AuthAccessMode = { kind: "invite_only" };
const WORKSPACE_MODE: AuthAccessMode = {
  kind: "workspace",
  allowedDomain: "teachps.org",
};

describe("pilot invitations (Phase 9A, synthetic data only)", () => {
  let client: PGlite;
  let db: PgliteDatabase<typeof schema>;
  let userCounter = 0;

  beforeAll(async () => {
    client = new PGlite();
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    await seedReferenceData(db);
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
        email: `synthetic.invitations.${userCounter}@example.com`,
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

  async function makeItAgent(userId: string): Promise<ResolvedActor> {
    const [itDepartment] = await db
      .select()
      .from(departments)
      .where(eq(departments.code, "IT"));
    await db.insert(departmentMemberships).values({
      userId,
      departmentId: itDepartment.id,
      organizationId: REFERENCE_ORGANIZATION.id,
    });
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

  describe("bootstrapInvitation (guarded CLI logic)", () => {
    it("rejects any action when AUTH_ACCESS_MODE is not invite_only", async () => {
      const outcome = await bootstrapInvitation(db, {
        email: "cli.mode.test@example.com",
        apply: false,
        accessMode: WORKSPACE_MODE,
      });
      expect(outcome.kind).toBe("error");
    });

    it("rejects any action when AUTH_ACCESS_MODE is missing", async () => {
      const outcome = await bootstrapInvitation(db, {
        email: "cli.mode.test@example.com",
        apply: false,
        accessMode: null,
      });
      expect(outcome.kind).toBe("error");
    });

    it("rejects a malformed email", async () => {
      const outcome = await bootstrapInvitation(db, {
        email: "not-an-email",
        apply: false,
        accessMode: INVITE_ONLY_MODE,
      });
      expect(outcome.kind).toBe("error");
    });

    it("is a dry run by default and makes no database change", async () => {
      const email = "cli.dry.run@example.com";
      const outcome = await bootstrapInvitation(db, {
        email,
        apply: false,
        accessMode: INVITE_ONLY_MODE,
      });

      expect(outcome).toEqual({
        kind: "dry_run",
        email,
        currentState: "none",
        wouldCreate: true,
      });
      const latest = await findLatestInvitation(
        db,
        REFERENCE_ORGANIZATION.id,
        email,
      );
      expect(latest).toBeNull();
    });

    it("requires --confirm-email together with --apply", async () => {
      const outcome = await bootstrapInvitation(db, {
        email: "cli.no.confirm@example.com",
        apply: true,
        accessMode: INVITE_ONLY_MODE,
      });
      expect(outcome.kind).toBe("error");
    });

    it("rejects a mismatched confirm-email and makes no change", async () => {
      const email = "cli.mismatch@example.com";
      const outcome = await bootstrapInvitation(db, {
        email,
        confirmEmail: "someone.else@example.com",
        apply: true,
        accessMode: INVITE_ONLY_MODE,
      });
      expect(outcome.kind).toBe("error");
      const latest = await findLatestInvitation(
        db,
        REFERENCE_ORGANIZATION.id,
        email,
      );
      expect(latest).toBeNull();
    });

    it("creates a pending invitation only with --apply and a matching --confirm-email", async () => {
      const email = "cli.created@example.com";
      const outcome = await bootstrapInvitation(db, {
        email,
        confirmEmail: email,
        apply: true,
        accessMode: INVITE_ONLY_MODE,
      });

      expect(outcome).toEqual({ kind: "created", email, currentState: "none" });
      const latest = await findLatestInvitation(
        db,
        REFERENCE_ORGANIZATION.id,
        email,
      );
      expect(latest?.status).toBe("pending");
      expect(latest?.createdSource).toBe("cli");
    });

    it("is idempotent when the invitation is already pending", async () => {
      const email = "cli.idempotent.pending@example.com";
      await bootstrapInvitation(db, {
        email,
        confirmEmail: email,
        apply: true,
        accessMode: INVITE_ONLY_MODE,
      });

      const secondOutcome = await bootstrapInvitation(db, {
        email,
        confirmEmail: email,
        apply: true,
        accessMode: INVITE_ONLY_MODE,
      });

      expect(secondOutcome).toEqual({
        kind: "unchanged",
        email,
        currentState: "pending",
      });
    });

    it("is idempotent when the invitation is already accepted", async () => {
      const email = "cli.idempotent.accepted@example.com";
      await insertPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email,
        createdSource: "cli",
      });
      const acceptingUser = await createSyntheticUser({ email });
      await acceptPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email,
        acceptedByUserId: acceptingUser.id,
      });

      const outcome = await bootstrapInvitation(db, {
        email,
        confirmEmail: email,
        apply: true,
        accessMode: INVITE_ONLY_MODE,
      });

      expect(outcome).toEqual({
        kind: "unchanged",
        email,
        currentState: "accepted",
      });
    });

    it("creates a fresh invitation after a revoked one, without reactivating the old row", async () => {
      const email = "cli.after.revoked@example.com";
      const original = await insertPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email,
        createdSource: "cli",
      });
      const revokingAdmin = await createSyntheticUser();
      await makeAdmin(revokingAdmin.id);
      const adminActor = await actorForUser(revokingAdmin.id);
      await revokeInvitation(db, adminActor, original.id);

      const outcome = await bootstrapInvitation(db, {
        email,
        confirmEmail: email,
        apply: true,
        accessMode: INVITE_ONLY_MODE,
      });

      expect(outcome).toEqual({
        kind: "created",
        email,
        currentState: "revoked",
      });

      const [originalRow] = await db
        .select()
        .from(authInvitations)
        .where(eq(authInvitations.id, original.id));
      expect(originalRow.status).toBe("revoked");

      const latest = await findLatestInvitation(
        db,
        REFERENCE_ORGANIZATION.id,
        email,
      );
      expect(latest?.id).not.toBe(original.id);
      expect(latest?.status).toBe("pending");
    });
  });

  describe("invitation store idempotency and shape", () => {
    it("findPendingInvitation returns null once accepted", async () => {
      const email = "store.accept.idempotent@example.com";
      await insertPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email,
        createdSource: "cli",
      });
      const acceptingUser = await createSyntheticUser({ email });

      await acceptPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email,
        acceptedByUserId: acceptingUser.id,
      });
      // A second accept call (simulating a retried hook) must be a no-op.
      await acceptPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email,
        acceptedByUserId: acceptingUser.id,
      });

      const pending = await findPendingInvitation(
        db,
        REFERENCE_ORGANIZATION.id,
        email,
      );
      expect(pending).toBeNull();

      const latest = await findLatestInvitation(
        db,
        REFERENCE_ORGANIZATION.id,
        email,
      );
      expect(latest?.status).toBe("accepted");
      expect(latest?.acceptedByUserId).toBe(acceptingUser.id);
    });

    it("the database rejects a second concurrent pending invitation for the same email", async () => {
      const email = "store.duplicate.pending@example.com";
      await insertPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email,
        createdSource: "cli",
      });

      await expect(
        insertPendingInvitation(db, {
          organizationId: REFERENCE_ORGANIZATION.id,
          email,
          createdSource: "cli",
        }),
      ).rejects.toThrow();
    });
  });

  describe("admin Pilot Invitations service", () => {
    it("denies an ordinary requester from listing invitations", async () => {
      const requester = await createSyntheticUser();
      const actor = await actorForUser(requester.id);

      await expect(listInvitationsForAdmin(db, actor)).rejects.toThrow(
        AdminAuthorizationError,
      );
    });

    it("denies a department agent (non-administrator) from listing, creating, or revoking invitations", async () => {
      const agent = await createSyntheticUser();
      const actor = await makeItAgent(agent.id);
      const invitation = await insertPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email: "denied.agent@example.com",
        createdSource: "admin_ui",
      });

      await expect(listInvitationsForAdmin(db, actor)).rejects.toThrow(
        AdminAuthorizationError,
      );
      await expect(
        createInvitation(db, actor, "another.denied.agent@example.com"),
      ).rejects.toThrow(AdminAuthorizationError);
      await expect(revokeInvitation(db, actor, invitation.id)).rejects.toThrow(
        AdminAuthorizationError,
      );
    });

    it("denies an ordinary requester from creating an invitation", async () => {
      const requester = await createSyntheticUser();
      const actor = await actorForUser(requester.id);

      await expect(
        createInvitation(db, actor, "denied.create@example.com"),
      ).rejects.toThrow(AdminAuthorizationError);
    });

    it("denies an ordinary requester from revoking an invitation", async () => {
      const requester = await createSyntheticUser();
      const actor = await actorForUser(requester.id);
      const invitation = await insertPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email: "denied.revoke@example.com",
        createdSource: "admin_ui",
      });

      await expect(revokeInvitation(db, actor, invitation.id)).rejects.toThrow(
        AdminAuthorizationError,
      );
    });

    it("allows a system administrator to create an invitation", async () => {
      const admin = await createSyntheticUser();
      const actor = await makeAdmin(admin.id);
      const email = "admin.created@example.com";

      await createInvitation(db, actor, email);

      const latest = await findLatestInvitation(
        db,
        REFERENCE_ORGANIZATION.id,
        email,
      );
      expect(latest?.status).toBe("pending");
      expect(latest?.createdSource).toBe("admin_ui");
      expect(latest?.createdByUserId).toBe(admin.id);
    });

    it("rejects an invalid email from the admin create action", async () => {
      const admin = await createSyntheticUser();
      const actor = await makeAdmin(admin.id);

      await expect(createInvitation(db, actor, "not-an-email")).rejects.toThrow(
        AdminValidationError,
      );
    });

    it("rejects creating a duplicate pending invitation", async () => {
      const admin = await createSyntheticUser();
      const actor = await makeAdmin(admin.id);
      const email = "admin.duplicate@example.com";

      await createInvitation(db, actor, email);

      await expect(createInvitation(db, actor, email)).rejects.toThrow(
        AdminValidationError,
      );
    });

    it("allows creating a fresh invitation for an address whose invitation was revoked", async () => {
      const admin = await createSyntheticUser();
      const actor = await makeAdmin(admin.id);
      const email = "admin.recreate.after.revoke@example.com";

      await createInvitation(db, actor, email);
      const first = await findLatestInvitation(
        db,
        REFERENCE_ORGANIZATION.id,
        email,
      );
      await revokeInvitation(db, actor, first!.id);

      await createInvitation(db, actor, email);
      const latest = await findLatestInvitation(
        db,
        REFERENCE_ORGANIZATION.id,
        email,
      );
      expect(latest?.status).toBe("pending");
      expect(latest?.id).not.toBe(first!.id);
    });

    it("lists pending and accepted invitations for the acting administrator's organization", async () => {
      const admin = await createSyntheticUser();
      const actor = await makeAdmin(admin.id);
      await createInvitation(db, actor, "admin.list.pending@example.com");

      const results = await listInvitationsForAdmin(db, actor);
      const emails = results.map((row) => row.email);
      expect(emails).toContain("admin.list.pending@example.com");
      for (const row of results) {
        expect(["pending", "accepted", "revoked"]).toContain(row.status);
      }
    });

    it("scopes the invitation list to the acting administrator's own organization", async () => {
      const admin = await createSyntheticUser();
      await makeAdmin(admin.id);
      const forgedActor = forgedOrgAdminActor(admin.id);

      const results = await listInvitationsForAdmin(db, forgedActor);
      expect(results).toEqual([]);
    });

    it("rejects revoking an invitation from a different (forged) organization", async () => {
      const admin = await createSyntheticUser();
      await makeAdmin(admin.id);
      const realActor = await actorForUser(admin.id);
      const invitation = await createInvitationAndFetch(
        realActor,
        "cross.org.revoke@example.com",
      );

      const forgedActor = forgedOrgAdminActor(admin.id);
      await expect(
        revokeInvitation(db, forgedActor, invitation.id),
      ).rejects.toThrow(AdminValidationError);
    });

    it("revokes a pending invitation and records who revoked it", async () => {
      const admin = await createSyntheticUser();
      const actor = await makeAdmin(admin.id);
      const email = "admin.revoke.success@example.com";
      await createInvitation(db, actor, email);
      const invitation = await findLatestInvitation(
        db,
        REFERENCE_ORGANIZATION.id,
        email,
      );

      await revokeInvitation(db, actor, invitation!.id);

      const [row] = await db
        .select()
        .from(authInvitations)
        .where(eq(authInvitations.id, invitation!.id));
      expect(row.status).toBe("revoked");
      expect(row.revokedByUserId).toBe(admin.id);
      expect(row.revokedAt).not.toBeNull();
    });

    it("refuses to revoke an already-accepted invitation", async () => {
      const admin = await createSyntheticUser();
      const actor = await makeAdmin(admin.id);
      const email = "admin.revoke.accepted@example.com";
      await createInvitation(db, actor, email);
      const invitation = await findLatestInvitation(
        db,
        REFERENCE_ORGANIZATION.id,
        email,
      );
      const acceptingUser = await createSyntheticUser({ email });
      await acceptPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email,
        acceptedByUserId: acceptingUser.id,
      });

      await expect(revokeInvitation(db, actor, invitation!.id)).rejects.toThrow(
        AdminValidationError,
      );

      const [row] = await db
        .select()
        .from(authInvitations)
        .where(eq(authInvitations.id, invitation!.id));
      expect(row.status).toBe("accepted");
    });

    async function createInvitationAndFetch(
      actor: ResolvedActor,
      email: string,
    ) {
      await createInvitation(db, actor, email);
      const latest = await findLatestInvitation(
        db,
        REFERENCE_ORGANIZATION.id,
        email,
      );
      if (!latest) {
        throw new Error("Expected invitation to exist");
      }
      return latest;
    }
  });
});
