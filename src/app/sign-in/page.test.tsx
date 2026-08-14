import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignInPage from "./page";

vi.mock("@/auth/env", () => ({
  isAuthConfigured: vi.fn(),
  getAuthAccessModeOrNull: vi.fn(),
}));

vi.mock("@/auth/auth-client", () => ({
  authClient: {
    signIn: {
      social: vi.fn(),
    },
  },
}));

const { isAuthConfigured, getAuthAccessModeOrNull } =
  await import("@/auth/env");

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
    vi.mocked(getAuthAccessModeOrNull).mockReset();
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

  describe("workspace mode", () => {
    beforeEach(() => {
      vi.mocked(isAuthConfigured).mockReturnValue(true);
      vi.mocked(getAuthAccessModeOrNull).mockReturnValue({
        kind: "workspace",
        allowedDomain: "teachps.org",
      });
    });

    it("states access is restricted to verified @teachps.org accounts", async () => {
      await renderSignInPage();

      expect(screen.getByText(/restricted to verified/i)).toBeInTheDocument();
      expect(
        screen.getByText(/@teachps\.org Google Workspace accounts/i),
      ).toBeInTheDocument();
    });

    it("states the system is for TEACH staff and that help is available after signing in", async () => {
      await renderSignInPage();

      expect(
        screen.getByText(/this system is for teach public schools staff/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/request it or facilities help/i),
      ).toBeInTheDocument();
    });

    it("renders the Google sign-in action", async () => {
      await renderSignInPage();

      expect(
        screen.getByRole("button", { name: /continue with google/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/authentication configuration pending/i),
      ).not.toBeInTheDocument();
    });

    it("does not render an error notice absent an error search param", async () => {
      await renderSignInPage();

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("renders a generic denial message on an error search param, never revealing account or org details", async () => {
      await renderSignInPage({ error: "1" });

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).not.toMatch(
        /exist|found|not a member|organization/i,
      );
      expect(alert.textContent).toMatch(/@teachps\.org/i);
    });
  });

  describe("invite_only mode", () => {
    beforeEach(() => {
      vi.mocked(isAuthConfigured).mockReturnValue(true);
      vi.mocked(getAuthAccessModeOrNull).mockReturnValue({
        kind: "invite_only",
      });
    });

    it("states sign-in is limited to invited Google accounts, never claiming @teachps.org is required", async () => {
      await renderSignInPage();

      expect(
        screen.getByText(/sign in with an invited google account/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/limited to people invited by an administrator/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/teachps\.org/i)).not.toBeInTheDocument();
    });

    it("tells the visitor to contact the system administrator for access", async () => {
      await renderSignInPage();

      expect(
        screen.getByText(/contact the system administrator/i),
      ).toBeInTheDocument();
    });

    it("still renders a Continue with Google action", async () => {
      await renderSignInPage();

      expect(
        screen.getByRole("button", { name: /continue with google/i }),
      ).toBeInTheDocument();
    });

    it("renders a generic denial message on error, never mentioning teachps.org", async () => {
      await renderSignInPage({ error: "1" });

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert.textContent).not.toMatch(/teachps\.org/i);
      expect(alert.textContent).toMatch(/invited google account/i);
    });
  });
});
