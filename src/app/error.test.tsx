import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import ErrorBoundary from "./error";

describe("root error boundary", () => {
  it("renders a friendly message without exposing the error's technical details", () => {
    const error = Object.assign(
      new Error(
        "connection refused at postgres://user:pass@internal-host:5432/db",
      ),
      { digest: "abc123" },
    );
    render(<ErrorBoundary error={error} reset={() => {}} />);

    expect(
      screen.getByRole("heading", { name: "We couldn't load this page." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/contact your system administrator/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/postgres:\/\//i)).not.toBeInTheDocument();
    expect(screen.queryByText(/connection refused/i)).not.toBeInTheDocument();
    expect(screen.queryByText("abc123")).not.toBeInTheDocument();
  });

  it("calls reset when Try Again is clicked", () => {
    const reset = vi.fn();
    render(<ErrorBoundary error={new Error("boom")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("provides a link back home", () => {
    render(<ErrorBoundary error={new Error("boom")} reset={() => {}} />);

    expect(screen.getByRole("link", { name: "Return Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
