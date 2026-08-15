import { beforeEach, describe, expect, it, vi } from "vitest";
import { TicketValidationError } from "@/tickets/errors";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "192.0.2.44" })),
}));

vi.mock("@/db/client", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("@/public-intake/env", () => ({
  isPublicTicketIntakeEnabled: vi.fn(),
  getPublicIntakeRateLimitSecret: vi.fn(),
}));

vi.mock("@/public-intake/rate-limit", () => ({
  checkAndRecordRateLimit: vi.fn(),
  computeRateLimitFingerprint: vi.fn(() => "fingerprint"),
  resolveClientIpForFingerprint: vi.fn(() => "192.0.2.44"),
}));

vi.mock("@/tickets/public-intake-service", () => ({
  createPublicTicket: vi.fn(),
}));

const { redirect } = await import("next/navigation");
const { isPublicTicketIntakeEnabled, getPublicIntakeRateLimitSecret } =
  await import("@/public-intake/env");
const { checkAndRecordRateLimit } = await import("@/public-intake/rate-limit");
const { createPublicTicket } = await import("@/tickets/public-intake-service");
const { createPublicTicketAction } = await import("./public-actions");

function formDataWith(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

const VALID_VALUES = {
  requesterName: "Pat Public",
  requesterEmail: "pat.public@example.com",
  departmentId: "dept-it",
  serviceLocationId: "loc-1",
  categoryId: "cat-1",
  subject: "Chromebook won't turn on",
  description: "Tried charging overnight.",
};

const INITIAL_STATE = {
  status: "idle" as const,
  fieldErrors: {},
  values: {
    requesterName: "",
    requesterEmail: "",
    departmentId: "",
    serviceLocationId: "",
    categoryId: "",
    subject: "",
    description: "",
  },
};

describe("createPublicTicketAction", () => {
  beforeEach(() => {
    vi.mocked(redirect).mockClear();
    vi.mocked(isPublicTicketIntakeEnabled).mockReset();
    vi.mocked(getPublicIntakeRateLimitSecret).mockReset();
    vi.mocked(checkAndRecordRateLimit).mockReset();
    vi.mocked(createPublicTicket).mockReset();
  });

  it("redirects to / and never touches the database when the flag is disabled", async () => {
    vi.mocked(isPublicTicketIntakeEnabled).mockReturnValue(false);

    await expect(
      createPublicTicketAction(INITIAL_STATE, formDataWith(VALID_VALUES)),
    ).rejects.toThrow("NEXT_REDIRECT:/");

    expect(createPublicTicket).not.toHaveBeenCalled();
    expect(checkAndRecordRateLimit).not.toHaveBeenCalled();
  });

  it("creates no ticket and shows a generic success redirect when the honeypot field is filled", async () => {
    vi.mocked(isPublicTicketIntakeEnabled).mockReturnValue(true);

    await expect(
      createPublicTicketAction(
        INITIAL_STATE,
        formDataWith({
          ...VALID_VALUES,
          company_website: "https://spam.example",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/requests/new/submitted");

    expect(createPublicTicket).not.toHaveBeenCalled();
    expect(checkAndRecordRateLimit).not.toHaveBeenCalled();
  });

  it("returns field errors for missing required fields without touching the database", async () => {
    vi.mocked(isPublicTicketIntakeEnabled).mockReturnValue(true);

    const result = await createPublicTicketAction(
      INITIAL_STATE,
      formDataWith({}),
    );

    expect(result.status).toBe("error");
    expect(result.fieldErrors.requesterName).toBeTruthy();
    expect(result.fieldErrors.requesterEmail).toBeTruthy();
    expect(result.fieldErrors.departmentId).toBeTruthy();
    expect(createPublicTicket).not.toHaveBeenCalled();
  });

  it("fails closed with a generic error when the rate-limit secret is not configured", async () => {
    vi.mocked(isPublicTicketIntakeEnabled).mockReturnValue(true);
    vi.mocked(getPublicIntakeRateLimitSecret).mockImplementation(() => {
      throw new Error("PUBLIC_INTAKE_RATE_LIMIT_SECRET is not set.");
    });

    const result = await createPublicTicketAction(
      INITIAL_STATE,
      formDataWith(VALID_VALUES),
    );

    expect(result.status).toBe("error");
    expect(result.formError).toMatch(/couldn't submit your request/i);
    expect(result.formError).not.toMatch(/rate limit/i);
    expect(createPublicTicket).not.toHaveBeenCalled();
  });

  it("shows a generic error and creates no ticket when the rate limit is exceeded", async () => {
    vi.mocked(isPublicTicketIntakeEnabled).mockReturnValue(true);
    vi.mocked(getPublicIntakeRateLimitSecret).mockReturnValue("a".repeat(32));
    vi.mocked(checkAndRecordRateLimit).mockResolvedValue({ allowed: false });

    const result = await createPublicTicketAction(
      INITIAL_STATE,
      formDataWith(VALID_VALUES),
    );

    expect(result.status).toBe("error");
    expect(result.formError).toMatch(/couldn't submit your request/i);
    expect(createPublicTicket).not.toHaveBeenCalled();
  });

  it("redirects to the confirmation page with the ticket number on success", async () => {
    vi.mocked(isPublicTicketIntakeEnabled).mockReturnValue(true);
    vi.mocked(getPublicIntakeRateLimitSecret).mockReturnValue("a".repeat(32));
    vi.mocked(checkAndRecordRateLimit).mockResolvedValue({ allowed: true });
    vi.mocked(createPublicTicket).mockResolvedValue({
      ticketNumber: 42,
    } as never);

    await expect(
      createPublicTicketAction(INITIAL_STATE, formDataWith(VALID_VALUES)),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/requests/new/submitted?ticket=TKT-000042",
    );

    expect(redirect).toHaveBeenCalledWith(
      "/requests/new/submitted?ticket=TKT-000042",
    );
  });

  it("never places the requester's name or email in the redirect URL", async () => {
    vi.mocked(isPublicTicketIntakeEnabled).mockReturnValue(true);
    vi.mocked(getPublicIntakeRateLimitSecret).mockReturnValue("a".repeat(32));
    vi.mocked(checkAndRecordRateLimit).mockResolvedValue({ allowed: true });
    vi.mocked(createPublicTicket).mockResolvedValue({
      ticketNumber: 7,
    } as never);

    try {
      await createPublicTicketAction(INITIAL_STATE, formDataWith(VALID_VALUES));
    } catch {
      // expected NEXT_REDIRECT throw
    }

    const redirectedTo = vi.mocked(redirect).mock.calls.at(-1)?.[0] as string;
    expect(redirectedTo).not.toContain(VALID_VALUES.requesterName);
    expect(redirectedTo).not.toContain(VALID_VALUES.requesterEmail);
  });

  it("surfaces a validation error's own message as the form error", async () => {
    vi.mocked(isPublicTicketIntakeEnabled).mockReturnValue(true);
    vi.mocked(getPublicIntakeRateLimitSecret).mockReturnValue("a".repeat(32));
    vi.mocked(checkAndRecordRateLimit).mockResolvedValue({ allowed: true });
    vi.mocked(createPublicTicket).mockRejectedValue(
      new TicketValidationError("The selected department is not valid."),
    );

    const result = await createPublicTicketAction(
      INITIAL_STATE,
      formDataWith(VALID_VALUES),
    );

    expect(result.status).toBe("error");
    expect(result.formError).toBe("The selected department is not valid.");
  });

  it("shows a generic error for a non-validation failure", async () => {
    vi.mocked(isPublicTicketIntakeEnabled).mockReturnValue(true);
    vi.mocked(getPublicIntakeRateLimitSecret).mockReturnValue("a".repeat(32));
    vi.mocked(checkAndRecordRateLimit).mockResolvedValue({ allowed: true });
    vi.mocked(createPublicTicket).mockRejectedValue(new Error("boom"));

    const result = await createPublicTicketAction(
      INITIAL_STATE,
      formDataWith(VALID_VALUES),
    );

    expect(result.status).toBe("error");
    expect(result.formError).toMatch(/couldn't submit your request/i);
  });
});
