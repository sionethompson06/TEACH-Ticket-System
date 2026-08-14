import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RequestHelpPage from "./page";

const { requireActiveActor } = vi.hoisted(() => ({
  requireActiveActor: vi.fn(),
}));
const { loadTicketFormOptions } = vi.hoisted(() => ({
  loadTicketFormOptions: vi.fn(),
}));

vi.mock("@/auth/current-actor", () => ({ requireActiveActor }));
vi.mock("@/db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/tickets/ticket-queries", () => ({ loadTicketFormOptions }));

const ACTOR = {
  status: "active",
  userId: "user-1",
  organizationId: "org-1",
  isSystemAdministrator: false,
  departmentCodes: [],
};

describe("RequestHelpPage", () => {
  it("renders the form with the loaded active options", async () => {
    requireActiveActor.mockResolvedValue(ACTOR);
    loadTicketFormOptions.mockResolvedValue({
      departments: [
        { id: "dept-it", code: "IT", name: "Information Technology" },
        { id: "dept-fac", code: "FACILITIES", name: "Facilities" },
      ],
      categories: [
        { id: "cat-1", departmentId: "dept-it", name: "Network Issue" },
      ],
      serviceLocations: [{ id: "loc-1", name: "TEACH Prep Elementary School" }],
    });

    render(await RequestHelpPage());

    expect(
      screen.getByRole("heading", { name: /request help/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /information technology/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "TEACH Prep Elementary School" }),
    ).toBeInTheDocument();
    expect(loadTicketFormOptions).toHaveBeenCalledWith(
      expect.anything(),
      ACTOR.organizationId,
    );
  });
});
