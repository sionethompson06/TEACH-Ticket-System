import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateInvitationForm } from "./create-invitation-form";

vi.mock("./actions", () => ({
  createInvitationAction: vi.fn(),
}));

const { createInvitationAction } = await import("./actions");

describe("CreateInvitationForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits the entered email and shows a success message", async () => {
    vi.mocked(createInvitationAction).mockResolvedValue({
      status: "success",
      message: "Invitation created. Tell them to visit the sign-in page.",
    });
    render(<CreateInvitationForm />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "person@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invitation/i }));

    await waitFor(() => {
      expect(screen.getByText(/invitation created/i)).toBeInTheDocument();
    });
  });

  it("shows a friendly error message on failure", async () => {
    vi.mocked(createInvitationAction).mockResolvedValue({
      status: "error",
      message: "An invitation to this address is already pending.",
    });
    render(<CreateInvitationForm />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "person@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send invitation/i }));

    await waitFor(() => {
      expect(screen.getByText(/already pending/i)).toBeInTheDocument();
    });
  });
});
