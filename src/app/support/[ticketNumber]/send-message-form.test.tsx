import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SendMessageForm } from "./send-message-form";

const { sendSupportMessageAction } = vi.hoisted(() => ({
  sendSupportMessageAction: vi.fn(),
}));

vi.mock("./actions", async () => {
  const actual = await vi.importActual<typeof import("./actions")>("./actions");
  return {
    ...actual,
    sendSupportMessageAction,
  };
});

describe("Support SendMessageForm", () => {
  beforeEach(() => {
    sendSupportMessageAction.mockReset();
    sendSupportMessageAction.mockImplementation(async () => ({
      status: "idle",
      body: "",
    }));
  });

  it("renders a message field and a Send Message button", () => {
    render(<SendMessageForm ticketId="ticket-1" ticketNumber="TKT-000001" />);
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send message/i }),
    ).toBeInTheDocument();
  });

  it("shows a friendly error when the action rejects a blank message", async () => {
    sendSupportMessageAction.mockResolvedValueOnce({
      status: "error",
      formError: "Enter a message before sending.",
      body: "",
    });
    render(<SendMessageForm ticketId="ticket-1" ticketNumber="TKT-000001" />);
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => {
      expect(
        screen.getByText("Enter a message before sending."),
      ).toBeInTheDocument();
    });
  });

  it("shows a pending state while sending", async () => {
    let resolveAction: (value: unknown) => void = () => {};
    sendSupportMessageAction.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );
    render(<SendMessageForm ticketId="ticket-1" ticketNumber="TKT-000001" />);
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();
    });
    resolveAction({ status: "success", body: "" });
  });

  it("clears the message field after a successful send", async () => {
    sendSupportMessageAction.mockResolvedValueOnce({
      status: "success",
      body: "",
    });
    render(<SendMessageForm ticketId="ticket-1" ticketNumber="TKT-000001" />);
    const textarea = screen.getByLabelText(/message/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Looking into it." } });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => {
      expect(textarea.value).toBe("");
    });
  });
});
