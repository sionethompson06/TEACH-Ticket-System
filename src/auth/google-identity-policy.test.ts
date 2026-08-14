import { describe, expect, it } from "vitest";
import {
  evaluateGoogleInviteOnlyIdentity,
  evaluateGoogleWorkspaceIdentity,
  type TrustedGoogleProfile,
} from "./google-identity-policy";

const WORKSPACE_DOMAIN = "teachps.org";

const VALID_PROFILE: TrustedGoogleProfile = {
  sub: "108234567890123456789",
  email: "sample.staff@teachps.org",
  email_verified: true,
  hd: "teachps.org",
};

describe("evaluateGoogleWorkspaceIdentity", () => {
  it("accepts a verified teachps.org Workspace profile", () => {
    const result = evaluateGoogleWorkspaceIdentity(
      VALID_PROFILE,
      WORKSPACE_DOMAIN,
    );
    expect(result).toEqual({
      allowed: true,
      sub: VALID_PROFILE.sub,
      email: "sample.staff@teachps.org",
    });
  });

  it("normalizes email and hd casing/whitespace safely without weakening exact-domain comparison", () => {
    const result = evaluateGoogleWorkspaceIdentity(
      {
        sub: "108234567890123456789",
        email: "  Sample.Staff@TeachPS.ORG  ",
        email_verified: true,
        hd: " TeachPS.org ",
      },
      WORKSPACE_DOMAIN,
    );
    expect(result).toEqual({
      allowed: true,
      sub: "108234567890123456789",
      email: "sample.staff@teachps.org",
    });
  });

  const denialCases: Array<{
    name: string;
    profile: TrustedGoogleProfile;
    reason: string;
  }> = [
    {
      name: "personal Gmail account",
      profile: { ...VALID_PROFILE, email: "person@gmail.com", hd: undefined },
      reason: "domain_not_allowed",
    },
    {
      name: "a different Google Workspace domain",
      profile: {
        ...VALID_PROFILE,
        email: "person@otherschool.org",
        hd: "otherschool.org",
      },
      reason: "domain_not_allowed",
    },
    {
      name: "missing hd claim",
      profile: { ...VALID_PROFILE, hd: undefined },
      reason: "missing_hosted_domain",
    },
    {
      name: 'hd "teachps.org.evil.example" (lookalike suffix)',
      profile: { ...VALID_PROFILE, hd: "teachps.org.evil.example" },
      reason: "hosted_domain_not_allowed",
    },
    {
      name: 'hd "subdomain.teachps.org" (subdomain)',
      profile: { ...VALID_PROFILE, hd: "subdomain.teachps.org" },
      reason: "hosted_domain_not_allowed",
    },
    {
      name: "lookalike email domain teachps.org.evil.example",
      profile: {
        ...VALID_PROFILE,
        email: "person@teachps.org.evil.example",
        hd: "teachps.org.evil.example",
      },
      reason: "domain_not_allowed",
    },
    {
      name: "unverified email",
      profile: { ...VALID_PROFILE, email_verified: false },
      reason: "email_not_verified",
    },
    {
      name: "email_verified missing entirely",
      profile: { ...VALID_PROFILE, email_verified: undefined },
      reason: "email_not_verified",
    },
    {
      name: "missing email",
      profile: { ...VALID_PROFILE, email: undefined },
      reason: "missing_email",
    },
    {
      name: "missing sub",
      profile: { ...VALID_PROFILE, sub: undefined },
      reason: "missing_subject",
    },
    {
      name: "correct email suffix paired with a missing hd",
      profile: { ...VALID_PROFILE, hd: undefined },
      reason: "missing_hosted_domain",
    },
    {
      name: "correct email suffix paired with an incorrect hd",
      profile: { ...VALID_PROFILE, hd: "gmail.com" },
      reason: "hosted_domain_not_allowed",
    },
    {
      name: "correct hd paired with an incorrect email domain",
      profile: { ...VALID_PROFILE, email: "person@gmail.com" },
      reason: "domain_not_allowed",
    },
    {
      name: "malformed email with two @ characters",
      profile: { ...VALID_PROFILE, email: "a@b@teachps.org" },
      reason: "invalid_email",
    },
    {
      name: "empty string sub",
      profile: { ...VALID_PROFILE, sub: "" },
      reason: "missing_subject",
    },
    {
      name: "non-string sub",
      profile: { ...VALID_PROFILE, sub: 12345 },
      reason: "missing_subject",
    },
  ];

  for (const { name, profile, reason } of denialCases) {
    it(`rejects: ${name}`, () => {
      const result = evaluateGoogleWorkspaceIdentity(profile, WORKSPACE_DOMAIN);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe(reason);
      }
    });
  }

  it("does not expose sensitive profile details in a denial result", () => {
    const result = evaluateGoogleWorkspaceIdentity(
      {
        sub: "108234567890123456789",
        email: "person@gmail.com",
        email_verified: true,
        hd: "gmail.com",
      },
      WORKSPACE_DOMAIN,
    );
    expect(result.allowed).toBe(false);
    expect(Object.keys(result).sort()).toEqual(["allowed", "reason"]);
    expect(JSON.stringify(result)).not.toContain("person@gmail.com");
    expect(JSON.stringify(result)).not.toContain("108234567890123456789");
  });
});

describe("evaluateGoogleInviteOnlyIdentity", () => {
  it("accepts a verified personal Gmail profile (no domain/hd requirement)", () => {
    const result = evaluateGoogleInviteOnlyIdentity({
      sub: "108234567890123456789",
      email: "person@gmail.com",
      email_verified: true,
    });
    expect(result).toEqual({
      allowed: true,
      sub: "108234567890123456789",
      email: "person@gmail.com",
    });
  });

  it("accepts a verified profile from any Workspace domain, without an hd claim", () => {
    const result = evaluateGoogleInviteOnlyIdentity({
      sub: "108234567890123456789",
      email: "person@another-school.org",
      email_verified: true,
    });
    expect(result.allowed).toBe(true);
  });

  it("normalizes email casing and whitespace", () => {
    const result = evaluateGoogleInviteOnlyIdentity({
      sub: "108234567890123456789",
      email: "  Person@Example.COM  ",
      email_verified: true,
    });
    expect(result).toEqual({
      allowed: true,
      sub: "108234567890123456789",
      email: "person@example.com",
    });
  });

  it("rejects an unverified email", () => {
    const result = evaluateGoogleInviteOnlyIdentity({
      sub: "108234567890123456789",
      email: "person@example.com",
      email_verified: false,
    });
    expect(result).toEqual({ allowed: false, reason: "email_not_verified" });
  });

  it("rejects a missing subject", () => {
    const result = evaluateGoogleInviteOnlyIdentity({
      email: "person@example.com",
      email_verified: true,
    });
    expect(result).toEqual({ allowed: false, reason: "missing_subject" });
  });

  it("rejects a malformed email", () => {
    const result = evaluateGoogleInviteOnlyIdentity({
      sub: "108234567890123456789",
      email: "a@b@example.com",
      email_verified: true,
    });
    expect(result).toEqual({ allowed: false, reason: "invalid_email" });
  });

  it("does not expose sensitive profile details in a denial result", () => {
    const result = evaluateGoogleInviteOnlyIdentity({
      sub: "108234567890123456789",
      email: "person@example.com",
      email_verified: false,
    });
    expect(result.allowed).toBe(false);
    expect(Object.keys(result).sort()).toEqual(["allowed", "reason"]);
  });
});
