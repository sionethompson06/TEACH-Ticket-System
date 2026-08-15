import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppNav } from "./app-nav";

const { getCurrentActor } = vi.hoisted(() => ({ getCurrentActor: vi.fn() }));

vi.mock("@/auth/current-actor", () => ({ getCurrentActor }));
vi.mock("@/auth/auth-client", () => ({
  authClient: { signOut: vi.fn() },
}));
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}));

const REQUESTER = {
  status: "active",
  userId: "user-1",
  organizationId: "org-1",
  isSystemAdministrator: false,
  departmentCodes: [],
};

const IT_AGENT = {
  status: "active",
  userId: "agent-1",
  organizationId: "org-1",
  isSystemAdministrator: false,
  departmentCodes: ["IT"],
};

describe("AppNav", () => {
  it("renders the brand link and every required item for an ordinary requester, with no Support Queue link", async () => {
    getCurrentActor.mockResolvedValue(REQUESTER);
    render(await AppNav());

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
    expect(
      screen.queryByRole("link", { name: /support queue/i }),
    ).not.toBeInTheDocument();
  });

  it("does not render an agent dashboard or administration link for a requester", async () => {
    getCurrentActor.mockResolvedValue(REQUESTER);
    render(await AppNav());

    expect(
      screen.queryByRole("link", { name: /dashboard/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /admin/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the Support Queue link for a department agent", async () => {
    getCurrentActor.mockResolvedValue(IT_AGENT);
    render(await AppNav());

    expect(
      screen.getByRole("link", { name: /support queue/i }),
    ).toHaveAttribute("href", "/support");
  });

  it("shows the Support Queue link for a system administrator with no department membership", async () => {
    getCurrentActor.mockResolvedValue({
      status: "active",
      userId: "admin-1",
      organizationId: "org-1",
      isSystemAdministrator: true,
      departmentCodes: [],
    });
    render(await AppNav());

    expect(
      screen.getByRole("link", { name: /support queue/i }),
    ).toBeInTheDocument();
  });

  it("shows the Administration link only for a system administrator", async () => {
    getCurrentActor.mockResolvedValue({
      status: "active",
      userId: "admin-1",
      organizationId: "org-1",
      isSystemAdministrator: true,
      departmentCodes: [],
    });
    render(await AppNav());

    expect(
      screen.getByRole("link", { name: /^administration$/i }),
    ).toHaveAttribute("href", "/admin");
  });

  it("does not show the Administration link for a department agent who is not an administrator", async () => {
    getCurrentActor.mockResolvedValue(IT_AGENT);
    render(await AppNav());

    expect(
      screen.queryByRole("link", { name: /^administration$/i }),
    ).not.toBeInTheDocument();
  });

  it("does not show the Administration link for an ordinary requester", async () => {
    getCurrentActor.mockResolvedValue(REQUESTER);
    render(await AppNav());

    expect(
      screen.queryByRole("link", { name: /^administration$/i }),
    ).not.toBeInTheDocument();
  });

  it("renders minimal, link-free chrome for a visitor with no active session (Phase 9B public intake)", async () => {
    getCurrentActor.mockResolvedValue({ status: "anonymous" });
    render(await AppNav());

    expect(screen.getByText(/teach help desk/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sign out/i }),
    ).not.toBeInTheDocument();
  });
});
