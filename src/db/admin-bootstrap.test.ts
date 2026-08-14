import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AuthAccessMode } from "../auth/access-mode";
import {
  acceptPendingInvitation,
  insertPendingInvitation,
} from "../auth/invitations";
import { bootstrapFirstSystemAdministrator } from "../admin/bootstrap";
import { REFERENCE_ORGANIZATION } from "./reference-data";
import * as schema from "./schema";
import { account, user } from "./schema";
import { seedReferenceData } from "./seed-reference-data";

const WORKSPACE_MODE: AuthAccessMode = {
  kind: "workspace",
  allowedDomain: "teachps.org",
};
const INVITE_ONLY_MODE: AuthAccessMode = { kind: "invite_only" };

// Note: a real "cross-organization user" row cannot be constructed here —
// the user_organization_fixed_check constraint (src/db/schema/auth.ts)
// already makes every user row's organization_id equal to
// REFERENCE_ORGANIZATION.id at the database level. The cross-organization
// rejection branch in bootstrapFirstSystemAdministrator is defense in
// depth for if that invariant ever changes, and is covered against a fake
// database in src/admin/bootstrap.test.ts.
describe("admin bootstrap (Phase 9/9A, synthetic data only)", () => {
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
        email: `synthetic.bootstrap.${userCounter}@teachps.org`,
        emailVerified: true,
        ...overrides,
      })
      .returning();
    return row;
  }

  async function refetch(userId: string) {
    const [row] = await db.select().from(user).where(eq(user.id, userId));
    return row;
  }

  async function linkGoogleAccount(userId: string) {
    userCounter += 1;
    await db.insert(account).values({
      accountId: `10800000000000${userCounter}`,
      providerId: "google",
      userId,
    });
  }

  describe("workspace mode", () => {
    it("rejects a non-@teachps.org email before touching the database", async () => {
      const outcome = await bootstrapFirstSystemAdministrator(db, {
        email: "someone@gmail.com",
        apply: false,
        accessMode: WORKSPACE_MODE,
      });

      expect(outcome.kind).toBe("error");
    });

    it("rejects a malformed email", async () => {
      const outcome = await bootstrapFirstSystemAdministrator(db, {
        email: "not-an-email",
        apply: false,
        accessMode: WORKSPACE_MODE,
      });

      expect(outcome.kind).toBe("error");
    });

    it("reports an error when the target user has never signed in", async () => {
      const outcome = await bootstrapFirstSystemAdministrator(db, {
        email: "never.signed.in@teachps.org",
        apply: false,
        accessMode: WORKSPACE_MODE,
      });

      expect(outcome.kind).toBe("error");
    });

    it("describes the planned action in dry-run mode without mutating data", async () => {
      const target = await createSyntheticUser();

      const outcome = await bootstrapFirstSystemAdministrator(db, {
        email: target.email,
        apply: false,
        accessMode: WORKSPACE_MODE,
      });

      expect(outcome).toEqual({
        kind: "dry_run",
        targetName: target.name,
        targetEmail: target.email,
        alreadyAdministrator: false,
      });

      const row = await refetch(target.id);
      expect(row.isSystemAdministrator).toBe(false);
    });

    it("requires --confirm-email together with --apply", async () => {
      const target = await createSyntheticUser();

      const outcome = await bootstrapFirstSystemAdministrator(db, {
        email: target.email,
        apply: true,
        accessMode: WORKSPACE_MODE,
      });

      expect(outcome.kind).toBe("error");
      const row = await refetch(target.id);
      expect(row.isSystemAdministrator).toBe(false);
    });

    it("rejects a mismatched confirmation email and makes no change", async () => {
      const target = await createSyntheticUser();

      const outcome = await bootstrapFirstSystemAdministrator(db, {
        email: target.email,
        confirmEmail: "different.address@teachps.org",
        apply: true,
        accessMode: WORKSPACE_MODE,
      });

      expect(outcome.kind).toBe("error");
      const row = await refetch(target.id);
      expect(row.isSystemAdministrator).toBe(false);
    });

    it("rejects an inactive user", async () => {
      const target = await createSyntheticUser({ isActive: false });

      const outcome = await bootstrapFirstSystemAdministrator(db, {
        email: target.email,
        confirmEmail: target.email,
        apply: true,
        accessMode: WORKSPACE_MODE,
      });

      expect(outcome.kind).toBe("error");
      const row = await refetch(target.id);
      expect(row.isSystemAdministrator).toBe(false);
    });

    it("applies the change only when apply and a matching confirm-email are both given", async () => {
      const target = await createSyntheticUser();

      const outcome = await bootstrapFirstSystemAdministrator(db, {
        email: target.email,
        confirmEmail: target.email,
        apply: true,
        accessMode: WORKSPACE_MODE,
      });

      expect(outcome).toEqual({
        kind: "applied",
        targetName: target.name,
        targetEmail: target.email,
      });

      const row = await refetch(target.id);
      expect(row.isSystemAdministrator).toBe(true);
      expect(row.organizationId).toBe(REFERENCE_ORGANIZATION.id);
    });

    it("is idempotent when the user is already a system administrator", async () => {
      const target = await createSyntheticUser({ isSystemAdministrator: true });

      const dryRunOutcome = await bootstrapFirstSystemAdministrator(db, {
        email: target.email,
        apply: false,
        accessMode: WORKSPACE_MODE,
      });
      expect(dryRunOutcome).toEqual({
        kind: "dry_run",
        targetName: target.name,
        targetEmail: target.email,
        alreadyAdministrator: true,
      });

      const applyOutcome = await bootstrapFirstSystemAdministrator(db, {
        email: target.email,
        confirmEmail: target.email,
        apply: true,
        accessMode: WORKSPACE_MODE,
      });
      expect(applyOutcome).toEqual({
        kind: "no_change",
        targetName: target.name,
        targetEmail: target.email,
      });

      const row = await refetch(target.id);
      expect(row.isSystemAdministrator).toBe(true);
    });

    it("normalizes email casing and surrounding whitespace before matching", async () => {
      const target = await createSyntheticUser();

      const outcome = await bootstrapFirstSystemAdministrator(db, {
        email: `  ${target.email.toUpperCase()}  `,
        confirmEmail: `  ${target.email.toUpperCase()}  `,
        apply: true,
        accessMode: WORKSPACE_MODE,
      });

      expect(outcome.kind).toBe("applied");
      const row = await refetch(target.id);
      expect(row.isSystemAdministrator).toBe(true);
    });

    it("never creates a user for an unknown email, even in apply mode", async () => {
      const before = await db.select().from(user);

      await bootstrapFirstSystemAdministrator(db, {
        email: "brand.new.user@teachps.org",
        confirmEmail: "brand.new.user@teachps.org",
        apply: true,
        accessMode: WORKSPACE_MODE,
      });

      const after = await db.select().from(user);
      expect(after.length).toBe(before.length);
    });
  });

  describe("invite_only mode", () => {
    it("does not require an @teachps.org address", async () => {
      const target = await createSyntheticUser({
        email: "invite.only.owner@example.com",
      });
      await linkGoogleAccount(target.id);
      await insertPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email: target.email,
        createdSource: "cli",
      });
      await acceptPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email: target.email,
        acceptedByUserId: target.id,
      });

      const outcome = await bootstrapFirstSystemAdministrator(db, {
        email: target.email,
        confirmEmail: target.email,
        apply: true,
        accessMode: INVITE_ONLY_MODE,
      });

      expect(outcome).toEqual({
        kind: "applied",
        targetName: target.name,
        targetEmail: target.email,
      });
    });

    it("rejects a user with no linked Google account", async () => {
      const target = await createSyntheticUser({
        email: "no.google.account@example.com",
      });
      await insertPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email: target.email,
        createdSource: "cli",
      });
      await acceptPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email: target.email,
        acceptedByUserId: target.id,
      });

      const outcome = await bootstrapFirstSystemAdministrator(db, {
        email: target.email,
        confirmEmail: target.email,
        apply: true,
        accessMode: INVITE_ONLY_MODE,
      });

      expect(outcome.kind).toBe("error");
      const row = await refetch(target.id);
      expect(row.isSystemAdministrator).toBe(false);
    });

    it("rejects a user with no accepted invitation", async () => {
      const target = await createSyntheticUser({
        email: "no.invitation@example.com",
      });
      await linkGoogleAccount(target.id);

      const outcome = await bootstrapFirstSystemAdministrator(db, {
        email: target.email,
        confirmEmail: target.email,
        apply: true,
        accessMode: INVITE_ONLY_MODE,
      });

      expect(outcome.kind).toBe("error");
      const row = await refetch(target.id);
      expect(row.isSystemAdministrator).toBe(false);
    });

    it("rejects a noninvited user even with a linked Google account and a still-pending (unaccepted) invitation", async () => {
      const target = await createSyntheticUser({
        email: "still.pending@example.com",
      });
      await linkGoogleAccount(target.id);
      await insertPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email: target.email,
        createdSource: "cli",
      });

      const outcome = await bootstrapFirstSystemAdministrator(db, {
        email: target.email,
        confirmEmail: target.email,
        apply: true,
        accessMode: INVITE_ONLY_MODE,
      });

      expect(outcome.kind).toBe("error");
    });

    it("rejects an inactive user even with a linked account and an accepted invitation", async () => {
      const target = await createSyntheticUser({
        email: "inactive.invited@example.com",
        isActive: false,
      });
      await linkGoogleAccount(target.id);
      await insertPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email: target.email,
        createdSource: "cli",
      });
      await acceptPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email: target.email,
        acceptedByUserId: target.id,
      });

      const outcome = await bootstrapFirstSystemAdministrator(db, {
        email: target.email,
        confirmEmail: target.email,
        apply: true,
        accessMode: INVITE_ONLY_MODE,
      });

      expect(outcome.kind).toBe("error");
    });

    it("is a dry run by default and never mutates data", async () => {
      const target = await createSyntheticUser({
        email: "invite.dry.run@example.com",
      });
      await linkGoogleAccount(target.id);
      await insertPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email: target.email,
        createdSource: "cli",
      });
      await acceptPendingInvitation(db, {
        organizationId: REFERENCE_ORGANIZATION.id,
        email: target.email,
        acceptedByUserId: target.id,
      });

      const outcome = await bootstrapFirstSystemAdministrator(db, {
        email: target.email,
        apply: false,
        accessMode: INVITE_ONLY_MODE,
      });

      expect(outcome).toEqual({
        kind: "dry_run",
        targetName: target.name,
        targetEmail: target.email,
        alreadyAdministrator: false,
      });
      const row = await refetch(target.id);
      expect(row.isSystemAdministrator).toBe(false);
    });

    it("never creates a user, even in apply mode", async () => {
      const before = await db.select().from(user);

      await bootstrapFirstSystemAdministrator(db, {
        email: "brand.new.invite.user@example.com",
        confirmEmail: "brand.new.invite.user@example.com",
        apply: true,
        accessMode: INVITE_ONLY_MODE,
      });

      const after = await db.select().from(user);
      expect(after.length).toBe(before.length);
    });
  });
});
