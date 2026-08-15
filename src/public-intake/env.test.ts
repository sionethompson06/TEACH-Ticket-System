import { describe, expect, it } from "vitest";
import {
  resolvePublicIntakeRateLimitSecret,
  resolvePublicTicketIntakeEnabled,
} from "./env";

const VALID_SECRET = "a".repeat(32);

describe("resolvePublicTicketIntakeEnabled", () => {
  it("is disabled when the flag is absent entirely", () => {
    expect(resolvePublicTicketIntakeEnabled({})).toBe(false);
  });

  it("is enabled only for the exact literal value 'true'", () => {
    expect(
      resolvePublicTicketIntakeEnabled({ PUBLIC_TICKET_INTAKE: "true" }),
    ).toBe(true);
  });

  it.each(["TRUE", "True", "1", "yes", " true", "true ", "truetrue", ""])(
    "fails closed for the non-exact value %j",
    (value) => {
      expect(
        resolvePublicTicketIntakeEnabled({ PUBLIC_TICKET_INTAKE: value }),
      ).toBe(false);
    },
  );
});

describe("resolvePublicIntakeRateLimitSecret", () => {
  it("returns null when the secret is missing entirely", () => {
    expect(resolvePublicIntakeRateLimitSecret({})).toBeNull();
  });

  it("returns null when the secret is shorter than 32 characters", () => {
    expect(
      resolvePublicIntakeRateLimitSecret({
        PUBLIC_INTAKE_RATE_LIMIT_SECRET: "a".repeat(31),
      }),
    ).toBeNull();
  });

  it("returns the value when it is at least 32 characters", () => {
    expect(
      resolvePublicIntakeRateLimitSecret({
        PUBLIC_INTAKE_RATE_LIMIT_SECRET: VALID_SECRET,
      }),
    ).toBe(VALID_SECRET);
  });

  it("returns null for an empty string", () => {
    expect(
      resolvePublicIntakeRateLimitSecret({
        PUBLIC_INTAKE_RATE_LIMIT_SECRET: "",
      }),
    ).toBeNull();
  });
});
