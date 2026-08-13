import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AccountPage from "./page";

vi.mock("@/auth/env", () => ({
  isAuthConfigured: vi.fn(),
}));

vi.mock("@/auth/auth", () => ({
  getAuth: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}));

vi.mock("@/auth/auth-client", () => ({
  authClient: {
    signOut: vi.fn(),
  },
}));

const { isAuthConfigured } = await import("@/auth/env");
const { getAuth } = await import("@/auth/auth");
const { redirect } = await import("next/navigation");

describe("AccountPage", () => {
  beforeEach(() => {
    vi.mocked(isAuthConfigured).mockReset();
    vi.mocked(getAuth).mockReset();
    vi.mocked(redirect).mockClear();
  });

  it("redirects to sign-in without throwing an error when authentication is not configured", async () => {
    vi.mocked(isAuthConfigured).mockReturnValue(false);

    await expect(AccountPage()).rejects.toThrow("NEXT_REDIRECT:/sign-in");
    expect(redirect).toHaveBeenCalledWith("/sign-in");
    expect(getAuth).not.toHaveBeenCalled();
  });

  it("redirects to sign-in when there is no active session", async () => {
    vi.mocked(isAuthConfigured).mockReturnValue(true);
    const getSession = vi.fn(async () => null);
    vi.mocked(getAuth).mockReturnValue({
      api: { getSession },
    } as unknown as ReturnType<typeof getAuth>);

    await expect(AccountPage()).rejects.toThrow("NEXT_REDIRECT:/sign-in");
    expect(redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("renders only the signed-in user's name, email, and the Requester role", async () => {
    vi.mocked(isAuthConfigured).mockReturnValue(true);
    const getSession = vi.fn(async () => ({
      session: { id: "session-1" },
      user: {
        id: "user-1",
        name: "Sample Staff Member",
        email: "sample.staff@teachps.org",
        emailVerified: true,
        baseRole: "requester",
      },
    }));
    vi.mocked(getAuth).mockReturnValue({
      api: { getSession },
    } as unknown as ReturnType<typeof getAuth>);

    const element = await AccountPage();
    render(element);

    expect(screen.getByText("Sample Staff Member")).toBeInTheDocument();
    expect(screen.getByText("sample.staff@teachps.org")).toBeInTheDocument();
    expect(screen.getByText("Requester")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign out/i }),
    ).toBeInTheDocument();
  });

  it("never renders elevated-role or dashboard content", async () => {
    vi.mocked(isAuthConfigured).mockReturnValue(true);
    const getSession = vi.fn(async () => ({
      session: { id: "session-1" },
      user: {
        id: "user-1",
        name: "Sample Staff Member",
        email: "sample.staff@teachps.org",
        emailVerified: true,
        baseRole: "requester",
      },
    }));
    vi.mocked(getAuth).mockReturnValue({
      api: { getSession },
    } as unknown as ReturnType<typeof getAuth>);

    const element = await AccountPage();
    render(element);

    expect(screen.queryByText(/administrator/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/dashboard/i)).not.toBeInTheDocument();
  });
});
