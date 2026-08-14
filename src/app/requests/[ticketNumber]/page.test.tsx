import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TicketDetailPage from "./page";

const { requireActiveActor } = vi.hoisted(() => ({
  requireActiveActor: vi.fn(),
}));
const { getTicketDetailByNumber, listTicketComments } = vi.hoisted(() => ({
  getTicketDetailByNumber: vi.fn(),
  listTicketComments: vi.fn(),
}));
const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/auth/current-actor", () => ({ requireActiveActor }));
vi.mock("@/db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/tickets/ticket-queries", () => ({
  getTicketDetailByNumber,
  listTicketComments,
}));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("./send-message-form", () => ({
  SendMessageForm: () => <div data-testid="send-message-form" />,
}));

const ACTOR = {
  status: "active",
  userId: "user-1",
  organizationId: "org-1",
  isSystemAdministrator: false,
  departmentCodes: [],
};

const BASE_TICKET = {
  id: "ticket-uuid-1",
  ticketNumber: 42,
  subject: "Chromebook broken",
  description: "It won't turn on at all.",
  status: "in_progress" as const,
  priority: "urgent" as const,
  departmentName: "Information Technology",
  serviceLocationName: "TEACH Prep Elementary School",
  categoryName: "Student and Staff Devices",
  assignedAgentName: null,
  createdAt: new Date("2026-08-01T12:00:00Z"),
  updatedAt: new Date("2026-08-02T12:00:00Z"),
  resolvedAt: null,
  closedAt: null,
  requesterId: "user-1",
};

async function renderDetailPage(
  ticketNumber: string,
  searchParams: Record<string, string> = {},
) {
  const element = await TicketDetailPage({
    params: Promise.resolve({ ticketNumber }),
    searchParams: Promise.resolve(searchParams),
  });
  return render(element);
}

describe("TicketDetailPage", () => {
  it("shows the owner their own ticket, details, and comments", async () => {
    requireActiveActor.mockResolvedValue(ACTOR);
    getTicketDetailByNumber.mockResolvedValue(BASE_TICKET);
    listTicketComments.mockResolvedValue([
      {
        id: "comment-1",
        body: "Any update?",
        createdAt: new Date("2026-08-01T13:00:00Z"),
        authorId: "user-1",
        authorName: "Jamie Requester",
        isFromRequester: true,
      },
      {
        id: "comment-2",
        body: "Looking into it now.",
        createdAt: new Date("2026-08-01T14:00:00Z"),
        authorId: "agent-1",
        authorName: "Alex Agent",
        isFromRequester: false,
      },
    ]);

    await renderDetailPage("TKT-000042");

    expect(screen.getByText("Chromebook broken")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText(/urgent priority/i)).toBeInTheDocument();
    expect(screen.getByText("It won't turn on at all.")).toBeInTheDocument();
    expect(screen.getByText("Any update?")).toBeInTheDocument();
    expect(screen.getByText("Looking into it now.")).toBeInTheDocument();
    expect(screen.getByText("Support Team")).toBeInTheDocument();
  });

  it("renders comments in chronological order", async () => {
    requireActiveActor.mockResolvedValue(ACTOR);
    getTicketDetailByNumber.mockResolvedValue(BASE_TICKET);
    listTicketComments.mockResolvedValue([
      {
        id: "comment-1",
        body: "First message",
        createdAt: new Date("2026-08-01T13:00:00Z"),
        authorId: "user-1",
        authorName: "Jamie Requester",
        isFromRequester: true,
      },
      {
        id: "comment-2",
        body: "Second message",
        createdAt: new Date("2026-08-01T14:00:00Z"),
        authorId: "agent-1",
        authorName: "Alex Agent",
        isFromRequester: false,
      },
    ]);

    await renderDetailPage("TKT-000042");

    const listItems = screen.getAllByRole("listitem");
    const messageItems = listItems.filter((item) =>
      /First message|Second message/.test(item.textContent ?? ""),
    );
    expect(messageItems[0].textContent).toContain("First message");
    expect(messageItems[1].textContent).toContain("Second message");
  });

  it("calls notFound for a ticket the actor cannot access, never revealing why", async () => {
    requireActiveActor.mockResolvedValue(ACTOR);
    getTicketDetailByNumber.mockResolvedValue(null);

    await expect(renderDetailPage("TKT-000099")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFound).toHaveBeenCalled();
  });

  it("never displays the internal ticket UUID or raw enum values", async () => {
    requireActiveActor.mockResolvedValue(ACTOR);
    getTicketDetailByNumber.mockResolvedValue(BASE_TICKET);
    listTicketComments.mockResolvedValue([]);

    const { container } = await renderDetailPage("TKT-000042");

    expect(container.textContent).not.toContain(BASE_TICKET.id);
    expect(container.textContent).not.toContain("in_progress");
    expect(container.textContent).not.toContain("urgent");
  });

  it("shows a closed-request message instead of the Send Message form when closed", async () => {
    requireActiveActor.mockResolvedValue(ACTOR);
    getTicketDetailByNumber.mockResolvedValue({
      ...BASE_TICKET,
      status: "closed",
    });
    listTicketComments.mockResolvedValue([]);

    render(
      await TicketDetailPage({
        params: Promise.resolve({ ticketNumber: "TKT-000042" }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(
      screen.getAllByText(/this request is closed/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: /send message/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/message/i)).not.toBeInTheDocument();
  });
});
