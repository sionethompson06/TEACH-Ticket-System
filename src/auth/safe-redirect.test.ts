import { describe, expect, it } from "vitest";
import { resolveSafeCallbackPath } from "./safe-redirect";

describe("resolveSafeCallbackPath", () => {
  it("accepts a plain same-origin relative path", () => {
    expect(resolveSafeCallbackPath("/requests/new")).toBe("/requests/new");
  });

  it("falls back to the default when missing", () => {
    expect(resolveSafeCallbackPath(undefined)).toBe("/requests");
  });

  it("uses the first value when given an array", () => {
    expect(resolveSafeCallbackPath(["/requests", "/other"])).toBe("/requests");
  });

  it("rejects a protocol-relative URL", () => {
    expect(resolveSafeCallbackPath("//evil.example.com")).toBe("/requests");
  });

  it("rejects an absolute URL", () => {
    expect(resolveSafeCallbackPath("https://evil.example.com/phish")).toBe(
      "/requests",
    );
  });

  it("rejects a value that doesn't start with a slash", () => {
    expect(resolveSafeCallbackPath("requests/new")).toBe("/requests");
  });

  it("rejects a scheme embedded later in the string", () => {
    expect(
      resolveSafeCallbackPath("/redirect?next=https://evil.example.com"),
    ).toBe("/requests");
  });

  it("honors a custom fallback", () => {
    expect(resolveSafeCallbackPath(undefined, "/account")).toBe("/account");
    expect(resolveSafeCallbackPath("//evil.example.com", "/account")).toBe(
      "/account",
    );
  });
});
