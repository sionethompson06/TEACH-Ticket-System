import type { GoogleOptions } from "better-auth/social-providers";
import { describe, expect, it, vi } from "vitest";
import { REFERENCE_ORGANIZATION } from "../db/reference-data";
import {
  buildBetterAuthOptions,
  REQUESTER_BASE_ROLE,
  SESSION_MAX_AGE_SECONDS,
  TEACH_WORKSPACE_HOSTED_DOMAIN,
  type BuildBetterAuthOptionsParams,
} from "./auth-options";

// A plain object stands in for a real Drizzle database handle. The Drizzle
// adapter only captures this reference when the options object is built —
// it never queries it — so no real database is needed to test config shape.
const FAKE_DB = {} as BuildBetterAuthOptionsParams["db"];

const WORKSPACE_MODE: BuildBetterAuthOptionsParams["accessMode"] = {
  kind: "workspace",
  allowedDomain: TEACH_WORKSPACE_HOSTED_DOMAIN,
};
const INVITE_ONLY_MODE: BuildBetterAuthOptionsParams["accessMode"] = {
  kind: "invite_only",
};

function buildTestOptions(
  accessMode: BuildBetterAuthOptionsParams["accessMode"] = WORKSPACE_MODE,
) {
  return buildBetterAuthOptions({
    db: FAKE_DB,
    googleClientId: "test-client-id",
    googleClientSecret: "test-client-secret",
    baseUrl: "https://example-teach-ticket-system.test",
    secret: "test-secret-value-not-a-real-secret",
    accessMode,
  });
}

// buildBetterAuthOptions always sets socialProviders.google to a plain
// options object, never Better Auth's alternate per-request function form —
// this helper narrows the type accordingly for the assertions below.
function getGoogleOptions(
  options: ReturnType<typeof buildTestOptions>,
): GoogleOptions & { enabled?: boolean } {
  const google = options.socialProviders?.google;
  if (typeof google !== "object" || google === null) {
    throw new Error("Expected socialProviders.google to be a plain object");
  }
  return google;
}

describe("buildBetterAuthOptions", () => {
  it("enables only the Google social provider", () => {
    const options = buildTestOptions();

    expect(Object.keys(options.socialProviders ?? {})).toEqual(["google"]);
  });

  it("sets the hosted domain to exactly teachps.org in workspace mode", () => {
    const options = buildTestOptions(WORKSPACE_MODE);
    const google = getGoogleOptions(options);

    expect(google.hd).toBe(TEACH_WORKSPACE_HOSTED_DOMAIN);
    expect(google.hd).toBe("teachps.org");
  });

  it("never sends an hd hint to Google in invite_only mode", () => {
    const options = buildTestOptions(INVITE_ONLY_MODE);
    const google = getGoogleOptions(options);

    expect(google.hd).toBeUndefined();
  });

  it("requests only the minimal OIDC scopes in either mode", () => {
    for (const mode of [WORKSPACE_MODE, INVITE_ONLY_MODE]) {
      const options = buildTestOptions(mode);
      const google = getGoogleOptions(options);

      expect(google.disableDefaultScope).toBe(true);
      expect(google.scope).toEqual(["openid", "email", "profile"]);
    }
  });

  it("does not configure offline access or forced refresh-token consent", () => {
    const options = buildTestOptions();
    const google = getGoogleOptions(options);

    expect(google.accessType).toBeUndefined();
    expect(google.prompt).toBe("select_account");
  });

  it("disables direct client-supplied ID-token sign-in", () => {
    const options = buildTestOptions();
    const google = getGoogleOptions(options);

    expect(google.disableIdTokenSignIn).toBe(true);
  });

  it("disables account linking", () => {
    const options = buildTestOptions();

    expect(options.account?.accountLinking?.enabled).toBe(false);
  });

  it("disables password authentication", () => {
    const options = buildTestOptions();

    expect(options.emailAndPassword?.enabled).toBe(false);
  });

  it("marks the organization and base-role fields as server-owned and not input-settable", () => {
    const options = buildTestOptions();
    const fields = options.user?.additionalFields as Record<
      string,
      { input?: boolean; required?: boolean; defaultValue?: unknown }
    >;

    expect(fields.organizationId.input).toBe(false);
    expect(fields.organizationId.required).toBe(true);
    expect(fields.organizationId.defaultValue).toBe(REFERENCE_ORGANIZATION.id);

    expect(fields.baseRole.input).toBe(false);
    expect(fields.baseRole.required).toBe(true);
    expect(fields.baseRole.defaultValue).toBe(REQUESTER_BASE_ROLE);
  });

  it("sets an eight-hour session lifetime", () => {
    const options = buildTestOptions();

    expect(options.session?.expiresIn).toBe(60 * 60 * 8);
    expect(options.session?.expiresIn).toBe(SESSION_MAX_AGE_SECONDS);
  });

  it("uses database-generated UUIDs (Postgres native gen_random_uuid)", () => {
    const options = buildTestOptions();

    expect(options.advanced?.database?.generateId).toBe("uuid");
  });

  it("strips provider tokens and passwords from an account before creation", async () => {
    const options = buildTestOptions();
    const before = options.databaseHooks?.account?.create?.before;
    expect(before).toBeTypeOf("function");

    const result = await before?.(
      {
        id: "test-account-id",
        accountId: "108234567890123456789",
        providerId: "google",
        userId: "test-user-id",
        accessToken: "sensitive-access-token-value",
        refreshToken: "sensitive-refresh-token-value",
        idToken: "sensitive-id-token-value",
        password: "should-never-happen",
        scope: "openid email profile",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      null,
    );

    expect(result).not.toBe(false);
    expect(result).not.toBeUndefined();
    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.accessToken).toBeNull();
    expect(data.refreshToken).toBeNull();
    expect(data.idToken).toBeNull();
    expect(data.password).toBeNull();
    // Non-sensitive fields survive untouched.
    expect(data.accountId).toBe("108234567890123456789");
    expect(data.providerId).toBe("google");
    expect(JSON.stringify(data)).not.toContain("sensitive-");
  });

  it("strips provider tokens and passwords from an account before update", async () => {
    const options = buildTestOptions();
    const before = options.databaseHooks?.account?.update?.before;
    expect(before).toBeTypeOf("function");

    const result = await before?.(
      {
        accessToken: "sensitive-access-token-value",
        refreshToken: "sensitive-refresh-token-value",
      },
      null,
    );

    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.accessToken).toBeNull();
    expect(data.refreshToken).toBeNull();
  });

  it("atomically assigns the canonical organization and requester role before user creation in workspace mode", async () => {
    const options = buildTestOptions(WORKSPACE_MODE);
    const before = options.databaseHooks?.user?.create?.before;
    expect(before).toBeTypeOf("function");

    const result = await before?.(
      {
        id: "test-user-id",
        name: "Test User",
        email: "test.user@teachps.org",
        emailVerified: true,
        organizationId: "attacker-supplied-org-id",
        baseRole: "system_administrator",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      null,
    );

    const data = (result as { data: Record<string, unknown> }).data;
    expect(data.organizationId).toBe(REFERENCE_ORGANIZATION.id);
    expect(data.baseRole).toBe(REQUESTER_BASE_ROLE);
  });

  describe("invite_only mode provisioning gate", () => {
    function buildInviteOnlyOptionsWithFakeInvitations(
      pendingInvitationExists: boolean,
    ) {
      const db = {
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: async () =>
                  pendingInvitationExists
                    ? [{ status: "pending", email: "invited@example.com" }]
                    : [],
              }),
            }),
          }),
        }),
        update: () => ({
          set: () => ({ where: async () => undefined }),
        }),
      } as unknown as BuildBetterAuthOptionsParams["db"];

      return buildBetterAuthOptions({
        db,
        googleClientId: "test-client-id",
        googleClientSecret: "test-client-secret",
        baseUrl: "https://example-teach-ticket-system.test",
        secret: "test-secret-value-not-a-real-secret",
        accessMode: INVITE_ONLY_MODE,
      });
    }

    it("aborts user creation (returns false) when no pending invitation exists", async () => {
      const options = buildInviteOnlyOptionsWithFakeInvitations(false);
      const before = options.databaseHooks?.user?.create?.before;

      const result = await before?.(
        {
          id: "test-user-id",
          name: "Uninvited Person",
          email: "uninvited@example.com",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        null,
      );

      expect(result).toBe(false);
    });

    it("allows user creation, still pinned to the canonical org/role, when a pending invitation exists", async () => {
      const options = buildInviteOnlyOptionsWithFakeInvitations(true);
      const before = options.databaseHooks?.user?.create?.before;

      const result = await before?.(
        {
          id: "test-user-id",
          name: "Invited Person",
          email: "invited@example.com",
          emailVerified: true,
          organizationId: "attacker-supplied-org-id",
          baseRole: "system_administrator",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        null,
      );

      expect(result).not.toBe(false);
      const data = (result as { data: Record<string, unknown> }).data;
      expect(data.organizationId).toBe(REFERENCE_ORGANIZATION.id);
      expect(data.baseRole).toBe(REQUESTER_BASE_ROLE);
    });

    it("does not gate user creation at all in workspace mode", async () => {
      const options = buildTestOptions(WORKSPACE_MODE);
      const before = options.databaseHooks?.user?.create?.before;

      const result = await before?.(
        {
          id: "test-user-id",
          name: "Workspace Person",
          email: "person@teachps.org",
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        null,
      );

      expect(result).not.toBe(false);
    });

    it("marks the invitation accepted after a successful invite-only creation", async () => {
      const updateSet = vi
        .fn()
        .mockReturnValue({ where: async () => undefined });
      const db = {
        update: () => ({ set: updateSet }),
      } as unknown as BuildBetterAuthOptionsParams["db"];

      const options = buildBetterAuthOptions({
        db,
        googleClientId: "test-client-id",
        googleClientSecret: "test-client-secret",
        baseUrl: "https://example-teach-ticket-system.test",
        secret: "test-secret-value-not-a-real-secret",
        accessMode: INVITE_ONLY_MODE,
      });
      const after = options.databaseHooks?.user?.create?.after;
      expect(after).toBeTypeOf("function");

      await after?.(
        {
          id: "new-user-id",
          name: "Invited Person",
          email: "Invited@Example.com",
          emailVerified: true,
          organizationId: REFERENCE_ORGANIZATION.id,
          baseRole: REQUESTER_BASE_ROLE,
          isActive: true,
          isSystemAdministrator: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        null,
      );

      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "accepted",
          acceptedByUserId: "new-user-id",
        }),
      );
    });

    it("does not touch invitations at all in workspace mode", async () => {
      const options = buildTestOptions(WORKSPACE_MODE);
      const after = options.databaseHooks?.user?.create?.after;

      // No db calls are made at all if this resolves without throwing
      // against the plain FAKE_DB object (which has no query methods).
      await expect(
        after?.(
          {
            id: "new-user-id",
            name: "Workspace Person",
            email: "person@teachps.org",
            emailVerified: true,
            organizationId: REFERENCE_ORGANIZATION.id,
            baseRole: REQUESTER_BASE_ROLE,
            isActive: true,
            isSystemAdministrator: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          null,
        ),
      ).resolves.not.toThrow();
    });
  });
});
