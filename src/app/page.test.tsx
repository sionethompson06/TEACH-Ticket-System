import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Home from "./page";

const AUTH_ENV_KEYS = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "DATABASE_URL",
  "AUTH_ACCESS_MODE",
  "AUTH_ALLOWED_DOMAIN",
  "PUBLIC_TICKET_INTAKE",
] as const;

function clearAuthEnv() {
  for (const key of AUTH_ENV_KEYS) {
    delete process.env[key];
  }
}

describe("Home page", () => {
  afterEach(() => {
    clearAuthEnv();
  });

  describe("without authentication configuration", () => {
    beforeEach(() => {
      clearAuthEnv();
    });

    it("renders the application name", () => {
      render(<Home />);

      expect(
        screen.getByRole("heading", {
          level: 1,
          name: /teach ticket system/i,
        }),
      ).toBeInTheDocument();
    });

    it("renders the current operational status", () => {
      render(<Home />);

      expect(
        screen.getByText(
          /sign in, request help, and track your requests are now available/i,
        ),
      ).toBeInTheDocument();
    });

    it("describes Request Help and My Requests availability", () => {
      render(<Home />);

      expect(screen.getAllByText(/request help/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/my requests/i).length).toBeGreaterThan(0);
    });

    it("renders a safe configuration-pending state instead of a broken sign-in action", () => {
      render(<Home />);

      expect(
        screen.getByText(/authentication configuration pending/i),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: /sign in with google/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("with authentication configuration present", () => {
    beforeEach(() => {
      process.env.BETTER_AUTH_SECRET = "test-secret-value-not-a-real-secret";
      process.env.BETTER_AUTH_URL = "https://example-teach-ticket-system.test";
      process.env.GOOGLE_CLIENT_ID = "test-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
      process.env.DATABASE_URL = "postgresql://test-host/test-db";
      process.env.AUTH_ACCESS_MODE = "invite_only";
    });

    it("provides the sign-in entry point", () => {
      render(<Home />);

      expect(
        screen.getByRole("link", { name: /sign in with google/i }),
      ).toHaveAttribute("href", "/sign-in");
    });

    it("never claims @teachps.org is required in invite_only mode", () => {
      render(<Home />);

      expect(screen.getByText(/invited google account/i)).toBeInTheDocument();
      expect(screen.queryByText(/teachps\.org/i)).not.toBeInTheDocument();
    });
  });

  describe("with workspace access mode configured", () => {
    beforeEach(() => {
      process.env.BETTER_AUTH_SECRET = "test-secret-value-not-a-real-secret";
      process.env.BETTER_AUTH_URL = "https://example-teach-ticket-system.test";
      process.env.GOOGLE_CLIENT_ID = "test-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
      process.env.DATABASE_URL = "postgresql://test-host/test-db";
      process.env.AUTH_ACCESS_MODE = "workspace";
      process.env.AUTH_ALLOWED_DOMAIN = "teachps.org";
    });

    it("still states the @teachps.org Workspace requirement", () => {
      render(<Home />);

      expect(screen.getByText(/@teachps\.org/i)).toBeInTheDocument();
    });
  });

  describe("with public ticket intake enabled and no authentication configured", () => {
    beforeEach(() => {
      clearAuthEnv();
      process.env.PUBLIC_TICKET_INTAKE = "true";
    });

    it("shows a Submit a ticket call to action linking to /requests/new", () => {
      render(<Home />);

      expect(
        screen.getByRole("link", { name: /submit a ticket/i }),
      ).toHaveAttribute("href", "/requests/new");
    });

    it("explains sign-in is temporarily not required", () => {
      render(<Home />);

      expect(
        screen.getByText(/sign-in temporarily not required/i),
      ).toBeInTheDocument();
    });

    it("includes a privacy warning about sensitive information", () => {
      render(<Home />);

      expect(screen.getByText(/social security numbers/i)).toBeInTheDocument();
    });

    it("still describes My Requests, Support Queue, and Administration as unavailable", () => {
      render(<Home />);

      expect(
        screen.getByText(
          /my requests, support queue, and administration remain unavailable/i,
        ),
      ).toBeInTheDocument();
    });

    it("still shows the authentication configuration pending notice", () => {
      render(<Home />);

      expect(
        screen.getByText(/authentication configuration pending/i),
      ).toBeInTheDocument();
    });
  });

  describe("with public ticket intake disabled (default)", () => {
    beforeEach(() => {
      clearAuthEnv();
    });

    it("never shows the Submit a ticket call to action", () => {
      render(<Home />);

      expect(
        screen.queryByRole("link", { name: /submit a ticket/i }),
      ).not.toBeInTheDocument();
    });
  });
});
