import { describe, expect, it } from "vitest";
import { checkReadiness } from "./readiness";

const VALID_SECRET = "a".repeat(32);
const VALID_ENV: Record<string, string> = {
  DATABASE_URL: "postgresql://app-user@db.internal.teachps-prod.net:5432/teach",
  BETTER_AUTH_SECRET: VALID_SECRET,
  BETTER_AUTH_URL: "https://tickets.teachps.org",
  GOOGLE_CLIENT_ID: "1234567890-abcdefghijklmnop.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "GOCSPX-a-real-looking-secret-value",
  AUTH_ACCESS_MODE: "invite_only",
};

describe("checkReadiness", () => {
  it("reports not configured for every item when the environment is empty", () => {
    const result = checkReadiness({});

    expect(result.ready).toBe(false);
    for (const item of result.items) {
      expect(item.status).toBe("not configured");
    }
  });

  it("reports ready for every item with a fully valid synthetic environment", () => {
    const result = checkReadiness(VALID_ENV);

    expect(result.ready).toBe(true);
    for (const item of result.items) {
      // "Public ticket intake" is deliberately excluded: VALID_ENV
      // represents normal authenticated mode, where public intake is off
      // and "not configured" is the correct, expected status — never a
      // reason overall readiness fails (see the dedicated tests below).
      if (item.label === "Public ticket intake") {
        expect(item.status).toBe("not configured");
        continue;
      }
      expect(item.status).toBe("ready");
    }
  });

  it("marks a non-Postgres database URL as invalid", () => {
    const result = checkReadiness({
      ...VALID_ENV,
      DATABASE_URL: "mysql://host/db",
    });

    const item = result.items.find((i) => i.label === "Database configuration");
    expect(item?.status).toBe("invalid");
  });

  it("marks the example .env placeholder database URL as invalid", () => {
    const result = checkReadiness({
      ...VALID_ENV,
      DATABASE_URL: "postgresql://replace-with-your-value.example.com/db",
    });

    const item = result.items.find((i) => i.label === "Database configuration");
    expect(item?.status).toBe("invalid");
  });

  it("marks an auth secret shorter than the minimum length as invalid", () => {
    const result = checkReadiness({
      ...VALID_ENV,
      BETTER_AUTH_SECRET: "short",
    });

    const item = result.items.find((i) => i.label === "Authentication secret");
    expect(item?.status).toBe("invalid");
  });

  it("marks a weak/placeholder auth secret as invalid even if long enough", () => {
    const result = checkReadiness({
      ...VALID_ENV,
      BETTER_AUTH_SECRET: "changeme".repeat(5),
    });

    const item = result.items.find((i) => i.label === "Authentication secret");
    expect(item?.status).toBe("invalid");
  });

  it("marks a non-HTTPS application origin as invalid when not localhost", () => {
    const result = checkReadiness({
      ...VALID_ENV,
      BETTER_AUTH_URL: "http://tickets.teachps.org",
    });

    const item = result.items.find((i) => i.label === "Application origin");
    expect(item?.status).toBe("invalid");
  });

  it("allows http for a localhost application origin", () => {
    const result = checkReadiness({
      ...VALID_ENV,
      BETTER_AUTH_URL: "http://localhost:3000",
    });

    const item = result.items.find((i) => i.label === "Application origin");
    expect(item?.status).toBe("ready");
  });

  it("marks an application origin with a path, query, or fragment as invalid", () => {
    const result = checkReadiness({
      ...VALID_ENV,
      BETTER_AUTH_URL: "https://tickets.teachps.org/callback?x=1",
    });

    const item = result.items.find((i) => i.label === "Application origin");
    expect(item?.status).toBe("invalid");
  });

  it("marks the example .env placeholder origin as invalid", () => {
    const result = checkReadiness({
      ...VALID_ENV,
      BETTER_AUTH_URL: "https://replace-with-your-value.example.com",
    });

    const item = result.items.find((i) => i.label === "Application origin");
    expect(item?.status).toBe("invalid");
  });

  it("reports Google OAuth as not configured when both fields are absent", () => {
    const env = { ...VALID_ENV };
    delete (env as Record<string, string | undefined>).GOOGLE_CLIENT_ID;
    delete (env as Record<string, string | undefined>).GOOGLE_CLIENT_SECRET;
    const result = checkReadiness(env);

    const item = result.items.find(
      (i) => i.label === "Google OAuth configuration",
    );
    expect(item?.status).toBe("not configured");
  });

  it("marks Google OAuth as invalid when only one of the pair is set", () => {
    const env = { ...VALID_ENV };
    delete (env as Record<string, string | undefined>).GOOGLE_CLIENT_SECRET;
    const result = checkReadiness(env);

    const item = result.items.find(
      (i) => i.label === "Google OAuth configuration",
    );
    expect(item?.status).toBe("invalid");
  });

  it("marks placeholder Google OAuth credentials as invalid", () => {
    const result = checkReadiness({
      ...VALID_ENV,
      GOOGLE_CLIENT_ID: "your-value-here.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "GOCSPX-example",
    });

    const item = result.items.find(
      (i) => i.label === "Google OAuth configuration",
    );
    expect(item?.status).toBe("invalid");
  });

  it("never includes the supplied secret values anywhere in the result", () => {
    const secretEnv = {
      DATABASE_URL: "postgresql://super-secret-user:p@ssw0rd123@db-host/teach",
      BETTER_AUTH_SECRET: "unmistakable-secret-token-value-0001",
      BETTER_AUTH_URL: "https://tickets.teachps.org",
      GOOGLE_CLIENT_ID: "unmistakable-client-id-0002",
      GOOGLE_CLIENT_SECRET: "unmistakable-client-secret-0003",
    };

    const result = checkReadiness(secretEnv);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("p@ssw0rd123");
    expect(serialized).not.toContain("super-secret-user");
    expect(serialized).not.toContain("unmistakable-secret-token-value-0001");
    expect(serialized).not.toContain("unmistakable-client-id-0002");
    expect(serialized).not.toContain("unmistakable-client-secret-0003");
  });

  it("reports Access mode as not configured when AUTH_ACCESS_MODE is missing", () => {
    const env = { ...VALID_ENV };
    delete (env as Record<string, string | undefined>).AUTH_ACCESS_MODE;
    const result = checkReadiness(env);

    const item = result.items.find((i) => i.label === "Access mode");
    expect(item?.status).toBe("not configured");
    expect(result.ready).toBe(false);
  });

  it("reports Access mode as invalid for an unknown value", () => {
    const result = checkReadiness({ ...VALID_ENV, AUTH_ACCESS_MODE: "open" });

    const item = result.items.find((i) => i.label === "Access mode");
    expect(item?.status).toBe("invalid");
  });

  it("reports Access mode as ready for invite_only mode without requiring a domain", () => {
    const result = checkReadiness({
      ...VALID_ENV,
      AUTH_ACCESS_MODE: "invite_only",
    });

    const item = result.items.find((i) => i.label === "Access mode");
    expect(item?.status).toBe("ready");
    expect(item?.detail).toMatch(/database invitations/i);
  });

  it("reports Access mode as invalid for workspace mode with no domain", () => {
    const result = checkReadiness({
      ...VALID_ENV,
      AUTH_ACCESS_MODE: "workspace",
    });

    const item = result.items.find((i) => i.label === "Access mode");
    expect(item?.status).toBe("invalid");
  });

  it("reports Access mode as invalid for workspace mode with a malformed domain", () => {
    const result = checkReadiness({
      ...VALID_ENV,
      AUTH_ACCESS_MODE: "workspace",
      AUTH_ALLOWED_DOMAIN: "not a domain",
    });

    const item = result.items.find((i) => i.label === "Access mode");
    expect(item?.status).toBe("invalid");
  });

  it("reports Access mode as ready for workspace mode with a valid domain", () => {
    const result = checkReadiness({
      ...VALID_ENV,
      AUTH_ACCESS_MODE: "workspace",
      AUTH_ALLOWED_DOMAIN: "teachps.org",
    });

    const item = result.items.find((i) => i.label === "Access mode");
    expect(item?.status).toBe("ready");
  });

  it("never echoes the configured AUTH_ALLOWED_DOMAIN value in the result", () => {
    const result = checkReadiness({
      ...VALID_ENV,
      AUTH_ACCESS_MODE: "workspace",
      AUTH_ALLOWED_DOMAIN: "unmistakable-domain-value.example",
    });

    expect(JSON.stringify(result)).not.toContain(
      "unmistakable-domain-value.example",
    );
  });

  describe("Public ticket intake (Phase 9B)", () => {
    const VALID_RATE_LIMIT_SECRET = "b".repeat(32);
    // A minimal environment representing the temporary public-intake
    // runtime state: database/secret/origin configured, but no Google
    // OAuth and no access mode at all — exactly the scenario this mode
    // exists for.
    const PUBLIC_INTAKE_ENV: Record<string, string> = {
      DATABASE_URL: VALID_ENV.DATABASE_URL,
      BETTER_AUTH_SECRET: VALID_ENV.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: VALID_ENV.BETTER_AUTH_URL,
      PUBLIC_TICKET_INTAKE: "true",
      PUBLIC_INTAKE_RATE_LIMIT_SECRET: VALID_RATE_LIMIT_SECRET,
    };

    it("reports not configured when the flag is absent, and this alone never blocks overall readiness", () => {
      const result = checkReadiness(VALID_ENV);

      const item = result.items.find((i) => i.label === "Public ticket intake");
      expect(item?.status).toBe("not configured");
      expect(result.ready).toBe(true);
    });

    it("reports not configured for any value other than the exact literal 'true'", () => {
      for (const value of ["TRUE", "1", "yes", " true", ""]) {
        const result = checkReadiness({
          ...VALID_ENV,
          PUBLIC_TICKET_INTAKE: value,
        });
        const item = result.items.find(
          (i) => i.label === "Public ticket intake",
        );
        expect(item?.status).toBe("not configured");
      }
    });

    it("reports invalid when enabled with no rate-limit secret", () => {
      const result = checkReadiness({
        ...VALID_ENV,
        PUBLIC_TICKET_INTAKE: "true",
      });

      const item = result.items.find((i) => i.label === "Public ticket intake");
      expect(item?.status).toBe("invalid");
    });

    it("reports invalid when the rate-limit secret is shorter than 32 characters", () => {
      const result = checkReadiness({
        ...VALID_ENV,
        PUBLIC_TICKET_INTAKE: "true",
        PUBLIC_INTAKE_RATE_LIMIT_SECRET: "a".repeat(31),
      });

      const item = result.items.find((i) => i.label === "Public ticket intake");
      expect(item?.status).toBe("invalid");
    });

    it("reports invalid for a placeholder-looking rate-limit secret even if long enough", () => {
      const result = checkReadiness({
        ...VALID_ENV,
        PUBLIC_TICKET_INTAKE: "true",
        PUBLIC_INTAKE_RATE_LIMIT_SECRET: "changeme".repeat(5),
      });

      const item = result.items.find((i) => i.label === "Public ticket intake");
      expect(item?.status).toBe("invalid");
    });

    it("reports ready when enabled with a valid rate-limit secret", () => {
      const result = checkReadiness({
        ...VALID_ENV,
        PUBLIC_TICKET_INTAKE: "true",
        PUBLIC_INTAKE_RATE_LIMIT_SECRET: VALID_RATE_LIMIT_SECRET,
      });

      const item = result.items.find((i) => i.label === "Public ticket intake");
      expect(item?.status).toBe("ready");
    });

    it("reports overall ready for database/secret/origin plus a valid public-intake configuration, with no Google OAuth or access mode configured", () => {
      const result = checkReadiness(PUBLIC_INTAKE_ENV);

      expect(result.ready).toBe(true);
      const googleOAuthItem = result.items.find(
        (i) => i.label === "Google OAuth configuration",
      );
      const accessModeItem = result.items.find(
        (i) => i.label === "Access mode",
      );
      expect(googleOAuthItem?.status).toBe("not configured");
      expect(accessModeItem?.status).toBe("not configured");
    });

    it("reports overall not-ready when public intake is invalid and Google OAuth/access mode are also unconfigured", () => {
      const result = checkReadiness({
        DATABASE_URL: VALID_ENV.DATABASE_URL,
        BETTER_AUTH_SECRET: VALID_ENV.BETTER_AUTH_SECRET,
        BETTER_AUTH_URL: VALID_ENV.BETTER_AUTH_URL,
        PUBLIC_TICKET_INTAKE: "true",
        // No PUBLIC_INTAKE_RATE_LIMIT_SECRET — fails closed.
      });

      expect(result.ready).toBe(false);
    });

    it("reports overall ready when both Google OAuth/access mode and public intake are fully configured together", () => {
      const result = checkReadiness({
        ...VALID_ENV,
        PUBLIC_TICKET_INTAKE: "true",
        PUBLIC_INTAKE_RATE_LIMIT_SECRET: VALID_RATE_LIMIT_SECRET,
      });

      expect(result.ready).toBe(true);
      const item = result.items.find((i) => i.label === "Public ticket intake");
      expect(item?.status).toBe("ready");
    });

    it("never echoes the configured rate-limit secret value in the result", () => {
      const result = checkReadiness({
        ...VALID_ENV,
        PUBLIC_TICKET_INTAKE: "true",
        PUBLIC_INTAKE_RATE_LIMIT_SECRET: "unmistakable-rate-limit-secret-000",
      });

      expect(JSON.stringify(result)).not.toContain(
        "unmistakable-rate-limit-secret-000",
      );
    });

    it("still requires the core database/secret/origin configuration even in public-intake mode", () => {
      const result = checkReadiness({
        BETTER_AUTH_SECRET: VALID_ENV.BETTER_AUTH_SECRET,
        BETTER_AUTH_URL: VALID_ENV.BETTER_AUTH_URL,
        PUBLIC_TICKET_INTAKE: "true",
        PUBLIC_INTAKE_RATE_LIMIT_SECRET: VALID_RATE_LIMIT_SECRET,
        // No DATABASE_URL.
      });

      expect(result.ready).toBe(false);
    });
  });
});
