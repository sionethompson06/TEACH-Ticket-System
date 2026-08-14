import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { FriendlyState } from "./friendly-state";

describe("FriendlyState", () => {
  it("renders the title and message", () => {
    render(
      <FriendlyState
        title="We couldn't load this page."
        message="Please try again."
      />,
    );

    expect(
      screen.getByRole("heading", { name: "We couldn't load this page." }),
    ).toBeInTheDocument();
    expect(screen.getByText("Please try again.")).toBeInTheDocument();
  });

  it("renders an href action as a link", () => {
    render(
      <FriendlyState
        title="Not found"
        message="Missing."
        actions={[{ label: "Return Home", href: "/" }]}
      />,
    );

    const link = screen.getByRole("link", { name: "Return Home" });
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders an onClick action as a button and calls it when clicked", () => {
    const onClick = vi.fn();
    render(
      <FriendlyState
        title="Error"
        message="Something went wrong."
        actions={[{ label: "Try Again", onClick }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders no action container when no actions are provided", () => {
    render(<FriendlyState title="Empty" message="Nothing here." />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
