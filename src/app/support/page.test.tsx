import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SupportQueuePage from "./page";

const { requireActiveActor } = vi.hoisted(() => ({
  requireActiveActor: vi.fn(),
}));
const { listSupportFilterOptions, listSupportQueueTickets } = vi.hoisted(
  () => ({
    listSupportFilterOptions: vi.fn(),
    listSupportQueueTickets: vi.fn(),
  }),
);

vi.mock("@/auth/current-actor", () => ({ requireActiveActor }));
vi.mock("@/db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/tickets/support-queries", () => ({
  listSupportFilterOptions,
  listSupportQueueTickets,
}));

const REQUESTER = {
  status: "active",
  userId: "user-1",
  organizationId: "org-1",
  isSystemAdministrator: false,
  departmentCodes: [],
};

const IT_AGENT = {
  status: "active",
  userId: "agent-1",
  organizationId: "org-1",
  isSystemAdministrator: false,
  departmentCodes: ["IT"],
};

const NO_FILTER_OPTIONS = {
  departments: [{ id: "dept-it", code: "IT", name: "Information Technology" }],
  serviceLocations: [{ id: "loc-1", name: "TEACH Prep Elementary School" }],
};

const DEFAULT_FILTERS = {
  departmentId: null,
  serviceLocationId: null,
  status: null,
  assignment: "all" as const,
};

async function renderPage(searchParams: Record<string, string> = {}) {
  const element = await SupportQueuePage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(searchParams),
  });
  return render(element);
}

describe("SupportQueuePage", () => {
  it("shows a safe access-denied message for an ordinary requester, with no queue content", async () => {
    requireActiveActor.mockResolvedValue(REQUESTER);
    await renderPage();

    expect(
      screen.getByText(/don't have access to the support workspace/i),
    ).toBeInTheDocument();
    expect(listSupportQueueTickets).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/department/i)).not.toBeInTheDocument();
  });

  it("shows a helpful empty state with no filters applied", async () => {
    requireActiveActor.mockResolvedValue(IT_AGENT);
    listSupportFilterOptions.mockResolvedValue(NO_FILTER_OPTIONS);
    listSupportQueueTickets.mockResolvedValue({
      tickets: [],
      filters: DEFAULT_FILTERS,
    });

    await renderPage();
    expect(screen.getByText("No active requests.")).toBeInTheDocument();
  });

  it("shows a different empty message when filters are applied and nothing matches", async () => {
    requireActiveActor.mockResolvedValue(IT_AGENT);
    listSupportFilterOptions.mockResolvedValue(NO_FILTER_OPTIONS);
    listSupportQueueTickets.mockResolvedValue({
      tickets: [],
      filters: { ...DEFAULT_FILTERS, assignment: "mine" as const },
    });

    await renderPage({ assignment: "mine" });
    expect(
      screen.getByText("No requests match these filters."),
    ).toBeInTheDocument();
  });

  it("renders ticket rows with friendly labels and no raw enum values or UUIDs", async () => {
    requireActiveActor.mockResolvedValue(IT_AGENT);
    listSupportFilterOptions.mockResolvedValue(NO_FILTER_OPTIONS);
    listSupportQueueTickets.mockResolvedValue({
      tickets: [
        {
          id: "ticket-uuid-1",
          ticketNumber: 42,
          subject: "Chromebook broken",
          requesterName: "Jamie Requester",
          departmentName: "Information Technology",
          serviceLocationName: "TEACH Prep Elementary School",
          status: "in_progress",
          priority: "urgent",
          assignedAgentName: null,
          createdAt: new Date("2026-08-01T12:00:00Z"),
          updatedAt: new Date("2026-08-02T12:00:00Z"),
        },
      ],
      filters: DEFAULT_FILTERS,
    });

    const { container } = await renderPage();
    const queue = screen.getByLabelText("Support queue");
    expect(screen.getByText("TKT-000042")).toBeInTheDocument();
    expect(screen.getByText("Chromebook broken")).toBeInTheDocument();
    expect(within(queue).getByText("In progress")).toBeInTheDocument();
    expect(within(queue).getByText(/urgent priority/i)).toBeInTheDocument();
    expect(within(queue).getByText("Unassigned")).toBeInTheDocument();
    expect(container.textContent).not.toContain("in_progress");
    expect(container.textContent).not.toContain("ticket-uuid-1");
    expect(screen.getByRole("link", { name: /TKT-000042/ })).toHaveAttribute(
      "href",
      "/support/TKT-000042",
    );
  });

  it("hides the department filter when the agent has only one department", async () => {
    requireActiveActor.mockResolvedValue(IT_AGENT);
    listSupportFilterOptions.mockResolvedValue(NO_FILTER_OPTIONS);
    listSupportQueueTickets.mockResolvedValue({
      tickets: [],
      filters: DEFAULT_FILTERS,
    });

    await renderPage();
    expect(screen.queryByLabelText(/^department$/i)).not.toBeInTheDocument();
  });

  it("shows the department filter for an agent with more than one department", async () => {
    requireActiveActor.mockResolvedValue(IT_AGENT);
    listSupportFilterOptions.mockResolvedValue({
      departments: [
        { id: "dept-it", code: "IT", name: "Information Technology" },
        { id: "dept-fac", code: "FACILITIES", name: "Facilities" },
      ],
      serviceLocations: NO_FILTER_OPTIONS.serviceLocations,
    });
    listSupportQueueTickets.mockResolvedValue({
      tickets: [],
      filters: DEFAULT_FILTERS,
    });

    await renderPage();
    expect(screen.getByLabelText(/^department$/i)).toBeInTheDocument();
  });

  it("includes a Clear filters action", async () => {
    requireActiveActor.mockResolvedValue(IT_AGENT);
    listSupportFilterOptions.mockResolvedValue(NO_FILTER_OPTIONS);
    listSupportQueueTickets.mockResolvedValue({
      tickets: [],
      filters: DEFAULT_FILTERS,
    });

    await renderPage();
    expect(
      screen.getByRole("link", { name: /clear filters/i }),
    ).toHaveAttribute("href", "/support");
  });
});
