import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminPage from "./page";

const { requireActiveActor } = vi.hoisted(() => ({
  requireActiveActor: vi.fn(),
}));
const { listOrganizationUsers } = vi.hoisted(() => ({
  listOrganizationUsers: vi.fn(),
}));
const { getAuthAccessModeOrNull } = vi.hoisted(() => ({
  getAuthAccessModeOrNull: vi.fn(),
}));
const { listInvitationsForAdmin } = vi.hoisted(() => ({
  listInvitationsForAdmin: vi.fn(),
}));

vi.mock("@/auth/current-actor", () => ({ requireActiveActor }));
vi.mock("@/auth/env", () => ({ getAuthAccessModeOrNull }));
vi.mock("@/db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/admin/admin-queries", () => ({ listOrganizationUsers }));
vi.mock("@/admin/invitations", () => ({ listInvitationsForAdmin }));

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

const ADMIN = {
  status: "active",
  userId: "admin-1",
  organizationId: "org-1",
  isSystemAdministrator: true,
  departmentCodes: [],
};

async function renderPage(searchParams: Record<string, string> = {}) {
  const element = await AdminPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(searchParams),
  });
  return render(element);
}

describe("AdminPage", () => {
  it("denies an ordinary requester with a safe message and no user list", async () => {
    requireActiveActor.mockResolvedValue(REQUESTER);
    await renderPage();

    expect(
      screen.getByText(/don't have access to this page/i),
    ).toBeInTheDocument();
    expect(listOrganizationUsers).not.toHaveBeenCalled();
  });

  it("denies a department agent who is not a system administrator", async () => {
    requireActiveActor.mockResolvedValue(IT_AGENT);
    await renderPage();

    expect(
      screen.getByText(/don't have access to this page/i),
    ).toBeInTheDocument();
    expect(listOrganizationUsers).not.toHaveBeenCalled();
  });

  it("shows a friendly empty state when no staff have signed in", async () => {
    requireActiveActor.mockResolvedValue(ADMIN);
    listOrganizationUsers.mockResolvedValue({ users: [], truncated: false });

    await renderPage();

    expect(
      screen.getByText(/staff will appear here after they sign in/i),
    ).toBeInTheDocument();
  });

  it("shows a distinct empty state when a search matches nothing", async () => {
    requireActiveActor.mockResolvedValue(ADMIN);
    listOrganizationUsers.mockResolvedValue({ users: [], truncated: false });

    await renderPage({ search: "nobody" });

    expect(screen.getByText(/no staff match this search/i)).toBeInTheDocument();
  });

  it("renders staff with display name, email, and access badges, and no raw ids", async () => {
    requireActiveActor.mockResolvedValue(ADMIN);
    listOrganizationUsers.mockResolvedValue({
      users: [
        {
          id: "staff-uuid-1",
          name: "Jamie Requester",
          email: "jamie@teachps.org",
          isActive: true,
          isSystemAdministrator: false,
          departmentCodes: ["IT"],
        },
      ],
      truncated: false,
    });

    const { container } = await renderPage();

    expect(screen.getByText("Jamie Requester")).toBeInTheDocument();
    expect(screen.getByText("jamie@teachps.org")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Requester")).toBeInTheDocument();
    expect(screen.getByText("IT agent")).toBeInTheDocument();
    expect(screen.getByText("No Facilities access")).toBeInTheDocument();
    expect(screen.getByText("Not an administrator")).toBeInTheDocument();
    expect(container.textContent).not.toContain("staff-uuid-1");
  });

  it("shows Add/Remove access action buttons matching current membership state", async () => {
    requireActiveActor.mockResolvedValue(ADMIN);
    listOrganizationUsers.mockResolvedValue({
      users: [
        {
          id: "staff-1",
          name: "Jamie Requester",
          email: "jamie@teachps.org",
          isActive: true,
          isSystemAdministrator: false,
          departmentCodes: ["IT"],
        },
      ],
      truncated: false,
    });

    await renderPage();

    expect(
      screen.getByRole("button", { name: /remove it access/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add facilities access/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /deactivate user/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /grant admin access/i }),
    ).toBeInTheDocument();
  });

  it("hides self-deactivation and self-admin-removal controls for the acting administrator's own row", async () => {
    requireActiveActor.mockResolvedValue(ADMIN);
    listOrganizationUsers.mockResolvedValue({
      users: [
        {
          id: ADMIN.userId,
          name: "Current Admin",
          email: "admin@teachps.org",
          isActive: true,
          isSystemAdministrator: true,
          departmentCodes: [],
        },
      ],
      truncated: false,
    });

    await renderPage();

    expect(
      screen.queryByRole("button", { name: /deactivate user/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /remove admin access/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/cannot deactivate your own account/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/cannot remove your own administrator access/i),
    ).toBeInTheDocument();
  });

  it("passes the search term through to listOrganizationUsers", async () => {
    requireActiveActor.mockResolvedValue(ADMIN);
    listOrganizationUsers.mockResolvedValue({ users: [], truncated: false });

    await renderPage({ search: "jamie" });

    expect(listOrganizationUsers).toHaveBeenCalledWith(
      expect.anything(),
      ADMIN,
      "jamie",
    );
  });

  it("shows a note when the result list is truncated", async () => {
    requireActiveActor.mockResolvedValue(ADMIN);
    listOrganizationUsers.mockResolvedValue({ users: [], truncated: true });

    await renderPage();

    expect(screen.getByText(/showing the first 200/i)).toBeInTheDocument();
  });

  describe("Pilot Invitations section", () => {
    it("is hidden entirely in workspace mode", async () => {
      requireActiveActor.mockResolvedValue(ADMIN);
      listOrganizationUsers.mockResolvedValue({ users: [], truncated: false });
      getAuthAccessModeOrNull.mockReturnValue({
        kind: "workspace",
        allowedDomain: "teachps.org",
      });

      await renderPage();

      expect(
        screen.queryByRole("heading", { name: /pilot invitations/i }),
      ).not.toBeInTheDocument();
      expect(listInvitationsForAdmin).not.toHaveBeenCalled();
    });

    it("is hidden when auth access mode is unset", async () => {
      requireActiveActor.mockResolvedValue(ADMIN);
      listOrganizationUsers.mockResolvedValue({ users: [], truncated: false });
      getAuthAccessModeOrNull.mockReturnValue(null);

      await renderPage();

      expect(
        screen.queryByRole("heading", { name: /pilot invitations/i }),
      ).not.toBeInTheDocument();
    });

    it("shows the create-invitation form and an empty state in invite_only mode", async () => {
      requireActiveActor.mockResolvedValue(ADMIN);
      listOrganizationUsers.mockResolvedValue({ users: [], truncated: false });
      getAuthAccessModeOrNull.mockReturnValue({ kind: "invite_only" });
      listInvitationsForAdmin.mockResolvedValue([]);

      await renderPage();

      expect(
        screen.getByRole("heading", { name: /pilot invitations/i }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByText(/no invitations yet/i)).toBeInTheDocument();
    });

    it("lists invitations with status and a Revoke action only for pending ones, with no internal id shown", async () => {
      requireActiveActor.mockResolvedValue(ADMIN);
      listOrganizationUsers.mockResolvedValue({ users: [], truncated: false });
      getAuthAccessModeOrNull.mockReturnValue({ kind: "invite_only" });
      listInvitationsForAdmin.mockResolvedValue([
        {
          id: "invitation-uuid-1",
          email: "pending.person@example.com",
          status: "pending",
          createdAt: new Date("2026-08-01T00:00:00Z"),
          acceptedAt: null,
          revokedAt: null,
        },
        {
          id: "invitation-uuid-2",
          email: "accepted.person@example.com",
          status: "accepted",
          createdAt: new Date("2026-07-01T00:00:00Z"),
          acceptedAt: new Date("2026-07-02T00:00:00Z"),
          revokedAt: null,
        },
      ]);

      const { container } = await renderPage();

      expect(
        screen.getByText("pending.person@example.com"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("accepted.person@example.com"),
      ).toBeInTheDocument();
      expect(screen.getByText("Pending")).toBeInTheDocument();
      expect(screen.getByText("Accepted")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^revoke$/i }),
      ).toBeInTheDocument();
      expect(container.textContent).not.toContain("invitation-uuid-1");
      expect(container.textContent).not.toContain("invitation-uuid-2");
    });
  });
});
