import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleSignInButton } from "./google-sign-in-button";

vi.mock("@/auth/auth-client", () => ({
  authClient: {
    signIn: {
      social: vi.fn(),
    },
  },
}));

const { authClient } = await import("@/auth/auth-client");

describe("GoogleSignInButton", () => {
  beforeEach(() => {
    vi.mocked(authClient.signIn.social).mockReset();
  });

  it("shows a pending state while sign-in is starting", () => {
    vi.mocked(authClient.signIn.social).mockImplementation(
      () => new Promise(() => {}),
    );
    render(<GoogleSignInButton callbackPath="/requests" />);

    fireEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(
      screen.getByRole("button", { name: /connecting to google/i }),
    ).toBeDisabled();
  });

  it("recovers to a friendly, retryable state if starting sign-in fails", async () => {
    vi.mocked(authClient.signIn.social).mockImplementation(((
      _body: unknown,
      options?: { onError?: (ctx: unknown) => void },
    ) => {
      options?.onError?.({ error: { message: "network error" } });
      return Promise.resolve({ data: null, error: { message: "failed" } });
    }) as typeof authClient.signIn.social);
    render(<GoogleSignInButton callbackPath="/requests" />);

    fireEvent.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByRole("alert").textContent).not.toMatch(
      /network error|stack|undefined/i,
    );
    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).not.toBeDisabled();
  });
});
