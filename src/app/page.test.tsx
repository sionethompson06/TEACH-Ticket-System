import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home page", () => {
  it("renders the application name", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: /teach ticket system/i }),
    ).toBeInTheDocument();
  });

  it("renders the Phase 2 operational status", () => {
    render(<Home />);

    expect(
      screen.getByText(/phase 2: database foundation operational/i),
    ).toBeInTheDocument();
  });

  it("states that sign-in is not enabled", () => {
    render(<Home />);

    expect(screen.getByText(/sign-in is not enabled/i)).toBeInTheDocument();
  });

  it("states that ticket submission is not enabled", () => {
    render(<Home />);

    expect(
      screen.getByText(/ticket submission is not enabled/i),
    ).toBeInTheDocument();
  });
});
