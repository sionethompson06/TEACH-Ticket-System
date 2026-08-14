import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AssignmentControl,
  PriorityControl,
  StatusControl,
} from "./support-controls";

const {
  assignTicketAction,
  assignToMeAction,
  updateStatusAction,
  updatePriorityAction,
} = vi.hoisted(() => ({
  assignTicketAction: vi.fn(),
  assignToMeAction: vi.fn(),
  updateStatusAction: vi.fn(),
  updatePriorityAction: vi.fn(),
}));

vi.mock("./actions", async () => {
  const actual = await vi.importActual<typeof import("./actions")>("./actions");
  return {
    ...actual,
    assignTicketAction,
    assignToMeAction,
    updateStatusAction,
    updatePriorityAction,
  };
});

describe("AssignmentControl", () => {
  beforeEach(() => {
    assignTicketAction.mockReset();
    assignToMeAction.mockReset();
    assignTicketAction.mockResolvedValue({ status: "success" });
    assignToMeAction.mockResolvedValue({ status: "success" });
  });

  it("shows an Assign to me button when not already assigned to the current user", () => {
    render(
      <AssignmentControl
        ticketId="ticket-1"
        ticketNumber="TKT-000001"
        currentAssigneeId={null}
        currentUserId="agent-1"
        agents={[{ id: "agent-1", name: "Jordan Agent" }]}
      />,
    );
    expect(
      screen.getByRole("button", { name: /assign to me/i }),
    ).toBeInTheDocument();
  });

  it("hides the Assign to me button when already assigned to the current user", () => {
    render(
      <AssignmentControl
        ticketId="ticket-1"
        ticketNumber="TKT-000001"
        currentAssigneeId="agent-1"
        currentUserId="agent-1"
        agents={[{ id: "agent-1", name: "Jordan Agent" }]}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /assign to me/i }),
    ).not.toBeInTheDocument();
  });

  it("offers only the given department agents, plus Unassigned", () => {
    render(
      <AssignmentControl
        ticketId="ticket-1"
        ticketNumber="TKT-000001"
        currentAssigneeId={null}
        currentUserId="agent-2"
        agents={[
          { id: "agent-1", name: "Jordan Agent" },
          { id: "agent-2", name: "Alex Agent" },
        ]}
      />,
    );
    expect(
      screen.getByRole("option", { name: "Unassigned" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Jordan Agent" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Alex Agent" }),
    ).toBeInTheDocument();
  });

  it("shows a friendly error when assignment fails", async () => {
    assignTicketAction.mockResolvedValue({
      status: "error",
      formError:
        "The assignee must be an active agent for the ticket's department.",
    });
    render(
      <AssignmentControl
        ticketId="ticket-1"
        ticketNumber="TKT-000001"
        currentAssigneeId={null}
        currentUserId="agent-2"
        agents={[{ id: "agent-1", name: "Jordan Agent" }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /save assignment/i }));
    await waitFor(() => {
      expect(screen.getByText(/must be an active agent/i)).toBeInTheDocument();
    });
  });
});

describe("StatusControl", () => {
  beforeEach(() => {
    updateStatusAction.mockReset();
    updateStatusAction.mockResolvedValue({ status: "success" });
  });

  it("offers only valid next statuses for the current status", () => {
    render(
      <StatusControl
        ticketId="ticket-1"
        ticketNumber="TKT-000001"
        currentStatus="resolved"
      />,
    );
    expect(
      screen.getByRole("option", { name: "Reopened" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Closed" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "In progress" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Received" }),
    ).not.toBeInTheDocument();
  });

  it("shows a friendly error when the status update fails", async () => {
    updateStatusAction.mockResolvedValue({
      status: "error",
      formError: "Cannot change ticket status.",
    });
    render(
      <StatusControl
        ticketId="ticket-1"
        ticketNumber="TKT-000001"
        currentStatus="submitted"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /update status/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/cannot change ticket status/i),
      ).toBeInTheDocument();
    });
  });
});

describe("PriorityControl", () => {
  beforeEach(() => {
    updatePriorityAction.mockReset();
    updatePriorityAction.mockResolvedValue({ status: "success" });
  });

  it("excludes the current priority from the choices", () => {
    render(
      <PriorityControl
        ticketId="ticket-1"
        ticketNumber="TKT-000001"
        currentPriority="normal"
      />,
    );
    expect(
      screen.queryByRole("option", { name: "Normal" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Low" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Urgent" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Critical" }),
    ).toBeInTheDocument();
  });

  it("shows the emergency-procedures reminder", () => {
    render(
      <PriorityControl
        ticketId="ticket-1"
        ticketNumber="TKT-000001"
        currentPriority="normal"
      />,
    );
    expect(
      screen.getByText(/follow teach emergency procedures/i),
    ).toBeInTheDocument();
  });

  it("shows a friendly error when the priority update fails", async () => {
    updatePriorityAction.mockResolvedValue({
      status: "error",
      formError: "We couldn't update the priority.",
    });
    render(
      <PriorityControl
        ticketId="ticket-1"
        ticketNumber="TKT-000001"
        currentPriority="normal"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /update priority/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/we couldn't update the priority/i),
      ).toBeInTheDocument();
    });
  });
});
