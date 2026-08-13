import type { GoogleOptions } from "better-auth/social-providers";
import { describe, expect, it } from "vitest";
import { REFERENCE_ORGANIZATION } from "../db/reference-data";
import {
  buildBetterAuthOptions,
  REQUESTER_BASE_ROLE,
  SESSION_MAX_AGE_SECONDS,
  TEACH_WORKSPACE_HOSTED_DOMAIN,
} from "./auth-options";

// A plain object stands in for a real Drizzle database handle. The Drizzle
// adapter only captures this reference when the options object is built —
// it never queries it — so no real database is needed to test config shape.
const FAKE_DB = {} as Parameters<typeof buildBetterAuthOptions>[0]["db"];

function buildTestOptions() {
  return buildBetterAuthOptions({
    db: FAKE_DB,
    googleClientId: "test-client-id",
    googleClientSecret: "test-client-secret",
    baseUrl: "https://example-teach-ticket-system.test",
    secret: "test-secret-value-not-a-real-secret",
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

  it("sets the hosted domain to exactly teachps.org", () => {
    const options = buildTestOptions();
    const google = getGoogleOptions(options);

    expect(google.hd).toBe(TEACH_WORKSPACE_HOSTED_DOMAIN);
    expect(google.hd).toBe("teachps.org");
  });

  it("requests only the minimal OIDC scopes", () => {
    const options = buildTestOptions();
    const google = getGoogleOptions(options);

    expect(google.disableDefaultScope).toBe(true);
    expect(google.scope).toEqual(["openid", "email", "profile"]);
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

  it("atomically assigns the canonical organization and requester role before user creation", async () => {
    const options = buildTestOptions();
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
});
