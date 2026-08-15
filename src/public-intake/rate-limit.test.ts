import { describe, expect, it } from "vitest";
import {
  computeRateLimitFingerprint,
  resolveClientIpForFingerprint,
} from "./rate-limit";

function headersFrom(values: Record<string, string>): Pick<Headers, "get"> {
  return {
    get: (name: string) => values[name.toLowerCase()] ?? null,
  };
}

describe("resolveClientIpForFingerprint", () => {
  it("uses the last entry of x-forwarded-for (the hop Vercel appends)", () => {
    const headerList = headersFrom({
      "x-forwarded-for": "203.0.113.5, 198.51.100.9, 192.0.2.44",
    });
    expect(resolveClientIpForFingerprint(headerList)).toBe("192.0.2.44");
  });

  it("trims whitespace around forwarded-for entries", () => {
    const headerList = headersFrom({
      "x-forwarded-for": "203.0.113.5 ,  192.0.2.44  ",
    });
    expect(resolveClientIpForFingerprint(headerList)).toBe("192.0.2.44");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headerList = headersFrom({ "x-real-ip": "192.0.2.44" });
    expect(resolveClientIpForFingerprint(headerList)).toBe("192.0.2.44");
  });

  it("falls back to a shared bucket when no usable header is present", () => {
    const headerList = headersFrom({});
    expect(resolveClientIpForFingerprint(headerList)).toBe("unknown-client");
  });

  it("falls back to a shared bucket for a blank x-forwarded-for value", () => {
    const headerList = headersFrom({ "x-forwarded-for": "  ,  " });
    expect(resolveClientIpForFingerprint(headerList)).toBe("unknown-client");
  });
});

describe("computeRateLimitFingerprint", () => {
  const secretA = "a".repeat(32);
  const secretB = "b".repeat(32);

  it("is deterministic for the same secret and IP", () => {
    expect(computeRateLimitFingerprint(secretA, "192.0.2.44")).toBe(
      computeRateLimitFingerprint(secretA, "192.0.2.44"),
    );
  });

  it("differs for different IPs under the same secret", () => {
    expect(computeRateLimitFingerprint(secretA, "192.0.2.44")).not.toBe(
      computeRateLimitFingerprint(secretA, "192.0.2.45"),
    );
  });

  it("differs for different secrets given the same IP", () => {
    expect(computeRateLimitFingerprint(secretA, "192.0.2.44")).not.toBe(
      computeRateLimitFingerprint(secretB, "192.0.2.44"),
    );
  });

  it("never contains the raw IP address in its output", () => {
    const fingerprint = computeRateLimitFingerprint(secretA, "192.0.2.44");
    expect(fingerprint).not.toContain("192.0.2.44");
  });
});
