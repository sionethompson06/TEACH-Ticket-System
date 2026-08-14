import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MyRequestsPage from "./page";

const { requireActiveActor } = vi.hoisted(() => ({
  requireActiveActor: vi.fn(),
}));
const { listMyTickets } = vi.hoisted(() => ({
  listMyTickets: vi.fn(),
}));

vi.mock("@/auth/current-actor", () => ({ requireActiveActor }));
vi.mock("@/db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/tickets/ticket-queries", () => ({ listMyTickets }));

const ACTOR = {
  status: "active",
  userId: "user-1",
  organizationId: "org-1",
  isSystemAdministrator: false,
  departmentCodes: [],
};

describe("MyRequestsPage", () => {
  it("shows a helpful empty state with a Request Help action when there are no tickets", async () => {
    requireActiveActor.mockResolvedValue(ACTOR);
    listMyTickets.mockResolvedValue([]);

    render(await MyRequestsPage());

    expect(
      screen.getByText(/haven't submitted any help requests/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /request help/i })[0],
    ).toHaveAttribute("href", "/requests/new");
  });

  it("renders friendly labels and formatted ticket numbers for each ticket", async () => {
    requireActiveActor.mockResolvedValue(ACTOR);
    listMyTickets.mockResolvedValue([
      {
        ticketNumber: 42,
        subject: "Chromebook broken",
        departmentName: "Information Technology",
        serviceLocationName: "TEACH Prep Elementary School",
        status: "in_progress",
        priority: "urgent",
        updatedAt: new Date("2026-08-01T12:00:00Z"),
      },
    ]);

    render(await MyRequestsPage());

    expect(screen.getByText("TKT-000042")).toBeInTheDocument();
    expect(screen.getByText("Chromebook broken")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText(/urgent priority/i)).toBeInTheDocument();
    // Internal enum values never appear.
    expect(screen.queryByText("in_progress")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /TKT-000042/ })).toHaveAttribute(
      "href",
      "/requests/TKT-000042",
    );
  });

  it("does not show a raw UUID anywhere for a ticket row", async () => {
    requireActiveActor.mockResolvedValue(ACTOR);
    listMyTickets.mockResolvedValue([
      {
        ticketNumber: 1,
        subject: "Leaky faucet",
        departmentName: "Facilities",
        serviceLocationName: "TEACH Tech Charter High School",
        status: "submitted",
        priority: "normal",
        updatedAt: new Date("2026-08-01T12:00:00Z"),
      },
    ]);

    const { container } = render(await MyRequestsPage());
    const uuidPattern =
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    expect(container.textContent).not.toMatch(uuidPattern);
  });
});
