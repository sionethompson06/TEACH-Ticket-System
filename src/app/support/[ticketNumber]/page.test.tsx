import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SupportTicketWorkspacePage from "./page";

const { requireActiveActor } = vi.hoisted(() => ({
  requireActiveActor: vi.fn(),
}));
const { listTicketComments } = vi.hoisted(() => ({
  listTicketComments: vi.fn(),
}));
const {
  getSupportTicketDetailByNumber,
  listActiveDepartmentAgents,
  listTicketActivity,
} = vi.hoisted(() => ({
  getSupportTicketDetailByNumber: vi.fn(),
  listActiveDepartmentAgents: vi.fn(),
  listTicketActivity: vi.fn(),
}));
const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/auth/current-actor", () => ({ requireActiveActor }));
vi.mock("@/db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/tickets/ticket-queries", () => ({ listTicketComments }));
vi.mock("@/tickets/support-queries", () => ({
  getSupportTicketDetailByNumber,
  listActiveDepartmentAgents,
  listTicketActivity,
}));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("./send-message-form", () => ({
  SendMessageForm: () => <div data-testid="send-message-form" />,
}));

const AGENT = {
  status: "active",
  userId: "agent-1",
  organizationId: "org-1",
  isSystemAdministrator: false,
  departmentCodes: ["IT"],
};

const BASE_TICKET = {
  id: "ticket-uuid-1",
  ticketNumber: 42,
  subject: "Chromebook broken",
  description: "It won't turn on at all.",
  status: "in_progress" as const,
  priority: "urgent" as const,
  departmentId: "dept-it",
  departmentName: "Information Technology",
  serviceLocationName: "TEACH Prep Elementary School",
  categoryName: "Student and Staff Devices",
  requesterName: "Jamie Requester",
  assignedAgentId: null,
  assignedAgentName: null,
  createdAt: new Date("2026-08-01T12:00:00Z"),
  updatedAt: new Date("2026-08-02T12:00:00Z"),
};

async function renderPage(ticketNumber: string) {
  const element = await SupportTicketWorkspacePage({
    params: Promise.resolve({ ticketNumber }),
    searchParams: Promise.resolve({}),
  });
  return render(element);
}

describe("SupportTicketWorkspacePage", () => {
  it("shows details, conversation, and activity for an authorized agent", async () => {
    requireActiveActor.mockResolvedValue(AGENT);
    getSupportTicketDetailByNumber.mockResolvedValue(BASE_TICKET);
    listTicketComments.mockResolvedValue([
      {
        id: "comment-1",
        body: "Any update?",
        createdAt: new Date("2026-08-01T13:00:00Z"),
        authorId: "requester-1",
        authorName: "Jamie Requester",
        isFromRequester: true,
      },
    ]);
    listTicketActivity.mockResolvedValue([
      {
        id: "a1",
        description: "Ticket submitted",
        createdAt: new Date("2026-08-01T12:00:00Z"),
      },
    ]);
    listActiveDepartmentAgents.mockResolvedValue([
      { id: "agent-1", name: "Jordan Agent" },
    ]);

    await renderPage("TKT-000042");

    expect(screen.getByText("Chromebook broken")).toBeInTheDocument();
    expect(screen.getAllByText("Jamie Requester").length).toBeGreaterThan(0);
    expect(screen.getByText("Any update?")).toBeInTheDocument();
    expect(screen.getByText("Ticket submitted")).toBeInTheDocument();
  });

  it("never displays the internal ticket UUID or raw enum values", async () => {
    requireActiveActor.mockResolvedValue(AGENT);
    getSupportTicketDetailByNumber.mockResolvedValue(BASE_TICKET);
    listTicketComments.mockResolvedValue([]);
    listTicketActivity.mockResolvedValue([]);
    listActiveDepartmentAgents.mockResolvedValue([]);

    const { container } = await renderPage("TKT-000042");
    expect(container.textContent).not.toContain(BASE_TICKET.id);
    expect(container.textContent).not.toContain("in_progress");
    expect(container.textContent).not.toContain("urgent");
  });

  it("calls notFound for an inaccessible or nonexistent ticket", async () => {
    requireActiveActor.mockResolvedValue(AGENT);
    getSupportTicketDetailByNumber.mockResolvedValue(null);

    await expect(renderPage("TKT-000099")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("hides support controls and shows a closed message for a closed ticket", async () => {
    requireActiveActor.mockResolvedValue(AGENT);
    getSupportTicketDetailByNumber.mockResolvedValue({
      ...BASE_TICKET,
      status: "closed",
    });
    listTicketComments.mockResolvedValue([]);
    listTicketActivity.mockResolvedValue([]);
    listActiveDepartmentAgents.mockResolvedValue([
      { id: "agent-1", name: "Jordan Agent" },
    ]);

    await renderPage("TKT-000042");

    expect(
      screen.getAllByText(/this request is closed/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("heading", { name: /support controls/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("send-message-form")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /assign to me/i }),
    ).not.toBeInTheDocument();
  });

  it("shows support controls for an open ticket", async () => {
    requireActiveActor.mockResolvedValue(AGENT);
    getSupportTicketDetailByNumber.mockResolvedValue(BASE_TICKET);
    listTicketComments.mockResolvedValue([]);
    listTicketActivity.mockResolvedValue([]);
    listActiveDepartmentAgents.mockResolvedValue([
      { id: "agent-1", name: "Jordan Agent" },
    ]);

    await renderPage("TKT-000042");

    expect(
      screen.getByRole("heading", { name: /support controls/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("send-message-form")).toBeInTheDocument();
  });
});
