import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RequesterNav } from "./requester-nav";

vi.mock("@/auth/auth-client", () => ({
  authClient: {
    signOut: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}));

describe("RequesterNav", () => {
  it("renders the brand link and every required requester nav item, and nothing else", () => {
    render(<RequesterNav />);

    expect(
      screen.getByRole("link", { name: /teach help desk/i }),
    ).toHaveAttribute("href", "/requests");
    expect(
      screen.getByRole("link", { name: /^request help$/i }),
    ).toHaveAttribute("href", "/requests/new");
    expect(
      screen.getByRole("link", { name: /^my requests$/i }),
    ).toHaveAttribute("href", "/requests");
    expect(screen.getByRole("link", { name: /^account$/i })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(
      screen.getByRole("button", { name: /sign out/i }),
    ).toBeInTheDocument();
  });

  it("does not render an agent dashboard or administration link", () => {
    render(<RequesterNav />);

    expect(
      screen.queryByRole("link", { name: /dashboard/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /admin/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /queue/i }),
    ).not.toBeInTheDocument();
  });
});
