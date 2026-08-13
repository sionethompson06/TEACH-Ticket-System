import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignInPage from "./page";

vi.mock("@/auth/env", () => ({
  isAuthConfigured: vi.fn(),
}));

vi.mock("@/auth/auth-client", () => ({
  authClient: {
    signIn: {
      social: vi.fn(),
    },
  },
}));

const { isAuthConfigured } = await import("@/auth/env");

async function renderSignInPage(searchParams: Record<string, string> = {}) {
  const element = await SignInPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(searchParams),
  });
  render(element);
}

describe("SignInPage", () => {
  beforeEach(() => {
    vi.mocked(isAuthConfigured).mockReset();
  });

  it("always states access is restricted to verified @teachps.org accounts", async () => {
    vi.mocked(isAuthConfigured).mockReturnValue(false);

    await renderSignInPage();

    expect(screen.getByText(/restricted to verified/i)).toBeInTheDocument();
    expect(
      screen.getByText(/@teachps\.org Google Workspace accounts/i),
    ).toBeInTheDocument();
  });

  it("renders a configuration-pending notice and no sign-in action when unconfigured", async () => {
    vi.mocked(isAuthConfigured).mockReturnValue(false);

    await renderSignInPage();

    expect(
      screen.getByText(/authentication configuration pending/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /continue with google/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the Google sign-in action when configured", async () => {
    vi.mocked(isAuthConfigured).mockReturnValue(true);

    await renderSignInPage();

    expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/authentication configuration pending/i),
    ).not.toBeInTheDocument();
  });

  it("does not render an error notice absent an error search param", async () => {
    vi.mocked(isAuthConfigured).mockReturnValue(true);

    await renderSignInPage();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders a generic denial message on an error search param, never revealing account or org details", async () => {
    vi.mocked(isAuthConfigured).mockReturnValue(true);

    await renderSignInPage({ error: "1" });

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).not.toMatch(
      /exist|found|not a member|organization/i,
    );
  });
});
