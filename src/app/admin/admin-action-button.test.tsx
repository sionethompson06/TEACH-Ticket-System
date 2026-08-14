import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminActionButton } from "./admin-action-button";
import type { AdminMutationState } from "./actions";

describe("AdminActionButton", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the action and shows a success message", async () => {
    const action = vi.fn().mockResolvedValue({
      status: "success",
      message: "Access added.",
    });
    render(
      <AdminActionButton
        action={action}
        label="Add IT Access"
        pendingLabel="Adding…"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /add it access/i }));
    await waitFor(() => {
      expect(screen.getByText("Access added.")).toBeInTheDocument();
    });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("shows a friendly error message on failure", async () => {
    const action = vi.fn().mockResolvedValue({
      status: "error",
      message: "We couldn't update department access.",
    });
    render(
      <AdminActionButton
        action={action}
        label="Add IT Access"
        pendingLabel="Adding…"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /add it access/i }));
    await waitFor(() => {
      expect(
        screen.getByText("We couldn't update department access."),
      ).toBeInTheDocument();
    });
  });

  it("shows a pending state and disables the button while submitting", async () => {
    let resolveAction: (value: AdminMutationState) => void = () => {};
    const action = vi.fn(
      () =>
        new Promise<AdminMutationState>((resolve) => {
          resolveAction = resolve;
        }),
    );
    render(
      <AdminActionButton
        action={action}
        label="Add IT Access"
        pendingLabel="Adding…"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /add it access/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /adding/i })).toBeDisabled();
    });
    resolveAction({ status: "success", message: "Access added." });
  });

  it("does not call the action when the confirmation is declined", async () => {
    const action = vi.fn().mockResolvedValue({ status: "success" });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <AdminActionButton
        action={action}
        label="Deactivate User"
        pendingLabel="Deactivating…"
        confirmMessage="Deactivate this user?"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /deactivate user/i }));
    expect(window.confirm).toHaveBeenCalledWith("Deactivate this user?");
    expect(action).not.toHaveBeenCalled();
  });

  it("calls the action when the confirmation is accepted", async () => {
    const action = vi.fn().mockResolvedValue({
      status: "success",
      message: "User deactivated.",
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <AdminActionButton
        action={action}
        label="Deactivate User"
        pendingLabel="Deactivating…"
        confirmMessage="Deactivate this user?"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /deactivate user/i }));
    await waitFor(() => {
      expect(screen.getByText("User deactivated.")).toBeInTheDocument();
    });
    expect(action).toHaveBeenCalledTimes(1);
  });
});
