import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PublicTicketSubmittedPage from "./page";

const { isPublicTicketIntakeEnabled } = vi.hoisted(() => ({
  isPublicTicketIntakeEnabled: vi.fn(),
}));

vi.mock("@/public-intake/env", () => ({ isPublicTicketIntakeEnabled }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

async function renderPage(searchParams: Record<string, string> = {}) {
  const element = await PublicTicketSubmittedPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(searchParams),
  });
  return render(element);
}

describe("PublicTicketSubmittedPage", () => {
  it("redirects to / when public intake is disabled", async () => {
    isPublicTicketIntakeEnabled.mockReturnValue(false);

    await expect(
      PublicTicketSubmittedPage({
        params: Promise.resolve({}),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/");
  });

  it("displays a well-formed ticket number", async () => {
    isPublicTicketIntakeEnabled.mockReturnValue(true);
    await renderPage({ ticket: "TKT-000042" });

    expect(screen.getByText("TKT-000042")).toBeInTheDocument();
  });

  it("never displays a malformed or query-injected ticket value", async () => {
    isPublicTicketIntakeEnabled.mockReturnValue(true);
    await renderPage({ ticket: "<script>alert(1)</script>" });

    expect(
      screen.queryByText("<script>alert(1)</script>"),
    ).not.toBeInTheDocument();
  });

  it("renders a generic confirmation with no ticket parameter (honeypot outcome)", async () => {
    isPublicTicketIntakeEnabled.mockReturnValue(true);
    await renderPage({});

    expect(
      screen.getByRole("heading", { name: /request received/i }),
    ).toBeInTheDocument();
  });

  it("never mentions tracking, reopening, or checking status on this page", async () => {
    isPublicTicketIntakeEnabled.mockReturnValue(true);
    await renderPage({ ticket: "TKT-000042" });

    expect(
      screen.getByText(/can.t be used to check your request/i),
    ).toBeInTheDocument();
  });

  it("never renders requester name/email fields on the page", async () => {
    isPublicTicketIntakeEnabled.mockReturnValue(true);
    await renderPage({ ticket: "TKT-000042" });

    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });
});
