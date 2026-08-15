import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RequestHelpPage from "./page";

const { requireActiveActor, getCurrentActor } = vi.hoisted(() => ({
  requireActiveActor: vi.fn(),
  getCurrentActor: vi.fn(),
}));
const { loadTicketFormOptions } = vi.hoisted(() => ({
  loadTicketFormOptions: vi.fn(),
}));
const { isPublicTicketIntakeEnabled } = vi.hoisted(() => ({
  isPublicTicketIntakeEnabled: vi.fn(),
}));

vi.mock("@/auth/current-actor", () => ({
  requireActiveActor,
  getCurrentActor,
}));
vi.mock("@/db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/tickets/ticket-queries", () => ({ loadTicketFormOptions }));
vi.mock("@/public-intake/env", () => ({ isPublicTicketIntakeEnabled }));

const ACTOR = {
  status: "active",
  userId: "user-1",
  organizationId: "org-1",
  isSystemAdministrator: false,
  departmentCodes: [],
};

const FORM_OPTIONS = {
  departments: [
    { id: "dept-it", code: "IT", name: "Information Technology" },
    { id: "dept-fac", code: "FACILITIES", name: "Facilities" },
  ],
  categories: [{ id: "cat-1", departmentId: "dept-it", name: "Network Issue" }],
  serviceLocations: [{ id: "loc-1", name: "TEACH Prep Elementary School" }],
};

describe("RequestHelpPage", () => {
  beforeEach(() => {
    requireActiveActor.mockReset();
    getCurrentActor.mockReset();
    loadTicketFormOptions.mockReset();
    isPublicTicketIntakeEnabled.mockReset();
  });

  it("requires an active actor and renders the authenticated form when public intake is disabled", async () => {
    isPublicTicketIntakeEnabled.mockReturnValue(false);
    requireActiveActor.mockResolvedValue(ACTOR);
    loadTicketFormOptions.mockResolvedValue(FORM_OPTIONS);

    render(await RequestHelpPage());

    expect(requireActiveActor).toHaveBeenCalledWith("/requests/new");
    expect(getCurrentActor).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: /request help/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /information technology/i }),
    ).toBeInTheDocument();
    expect(loadTicketFormOptions).toHaveBeenCalledWith(
      expect.anything(),
      ACTOR.organizationId,
    );
  });

  it("renders the authenticated form for an active actor when public intake is enabled", async () => {
    isPublicTicketIntakeEnabled.mockReturnValue(true);
    getCurrentActor.mockResolvedValue(ACTOR);
    loadTicketFormOptions.mockResolvedValue(FORM_OPTIONS);

    render(await RequestHelpPage());

    expect(requireActiveActor).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: /request help/i }),
    ).toBeInTheDocument();
    expect(loadTicketFormOptions).toHaveBeenCalledWith(
      expect.anything(),
      ACTOR.organizationId,
    );
  });

  it("renders the public form for an anonymous visitor when public intake is enabled", async () => {
    isPublicTicketIntakeEnabled.mockReturnValue(true);
    getCurrentActor.mockResolvedValue({ status: "anonymous" });
    loadTicketFormOptions.mockResolvedValue(FORM_OPTIONS);

    render(await RequestHelpPage());

    expect(requireActiveActor).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: /submit a request/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your email/i)).toBeInTheDocument();
    expect(
      screen.getByText(/sign-in is temporarily not required/i),
    ).toBeInTheDocument();
  });

  it("renders the public form for an inactive actor when public intake is enabled", async () => {
    isPublicTicketIntakeEnabled.mockReturnValue(true);
    getCurrentActor.mockResolvedValue({ status: "inactive" });
    loadTicketFormOptions.mockResolvedValue(FORM_OPTIONS);

    render(await RequestHelpPage());

    expect(
      screen.getByRole("heading", { name: /submit a request/i }),
    ).toBeInTheDocument();
  });
});
