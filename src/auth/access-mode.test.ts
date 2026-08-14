import { describe, expect, it } from "vitest";
import { isValidAllowedDomain, resolveAuthAccessMode } from "./access-mode";

describe("resolveAuthAccessMode", () => {
  it("fails closed when AUTH_ACCESS_MODE is missing entirely", () => {
    expect(resolveAuthAccessMode({})).toBeNull();
  });

  it("fails closed for an unknown AUTH_ACCESS_MODE value", () => {
    expect(resolveAuthAccessMode({ AUTH_ACCESS_MODE: "open" })).toBeNull();
    expect(resolveAuthAccessMode({ AUTH_ACCESS_MODE: "" })).toBeNull();
  });

  it("resolves invite_only mode without requiring a domain", () => {
    expect(resolveAuthAccessMode({ AUTH_ACCESS_MODE: "invite_only" })).toEqual({
      kind: "invite_only",
    });
  });

  it("ignores AUTH_ALLOWED_DOMAIN in invite_only mode", () => {
    expect(
      resolveAuthAccessMode({
        AUTH_ACCESS_MODE: "invite_only",
        AUTH_ALLOWED_DOMAIN: "should-be-ignored.example",
      }),
    ).toEqual({ kind: "invite_only" });
  });

  it("resolves workspace mode with a valid domain", () => {
    expect(
      resolveAuthAccessMode({
        AUTH_ACCESS_MODE: "workspace",
        AUTH_ALLOWED_DOMAIN: "teachps.org",
      }),
    ).toEqual({ kind: "workspace", allowedDomain: "teachps.org" });
  });

  it("normalizes domain casing and surrounding whitespace", () => {
    expect(
      resolveAuthAccessMode({
        AUTH_ACCESS_MODE: "workspace",
        AUTH_ALLOWED_DOMAIN: "  TeachPS.ORG  ",
      }),
    ).toEqual({ kind: "workspace", allowedDomain: "teachps.org" });
  });

  it("fails closed for workspace mode with a missing domain", () => {
    expect(resolveAuthAccessMode({ AUTH_ACCESS_MODE: "workspace" })).toBeNull();
  });

  it("fails closed for workspace mode with an empty domain", () => {
    expect(
      resolveAuthAccessMode({
        AUTH_ACCESS_MODE: "workspace",
        AUTH_ALLOWED_DOMAIN: "   ",
      }),
    ).toBeNull();
  });

  it("fails closed for workspace mode with a malformed domain", () => {
    expect(
      resolveAuthAccessMode({
        AUTH_ACCESS_MODE: "workspace",
        AUTH_ALLOWED_DOMAIN: "not a domain",
      }),
    ).toBeNull();
    expect(
      resolveAuthAccessMode({
        AUTH_ACCESS_MODE: "workspace",
        AUTH_ALLOWED_DOMAIN: "-leading-hyphen.org",
      }),
    ).toBeNull();
    expect(
      resolveAuthAccessMode({
        AUTH_ACCESS_MODE: "workspace",
        AUTH_ALLOWED_DOMAIN: "no-dot",
      }),
    ).toBeNull();
  });
});

describe("isValidAllowedDomain", () => {
  it("accepts a plain registrable domain", () => {
    expect(isValidAllowedDomain("teachps.org")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isValidAllowedDomain("")).toBe(false);
  });
});
