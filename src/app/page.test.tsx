import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Home from "./page";

const AUTH_ENV_KEYS = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "DATABASE_URL",
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

    it("renders the Phase 3 operational status", () => {
      render(<Home />);

      expect(
        screen.getByText(
          /phase 3: google workspace authentication operational/i,
        ),
      ).toBeInTheDocument();
    });

    it("states that ticket submission is not enabled", () => {
      render(<Home />);

      expect(
        screen.getByText(/ticket submission is not enabled/i),
      ).toBeInTheDocument();
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
    });

    it("provides the sign-in entry point", () => {
      render(<Home />);

      expect(
        screen.getByRole("link", { name: /sign in with google/i }),
      ).toHaveAttribute("href", "/sign-in");
    });
  });
});
