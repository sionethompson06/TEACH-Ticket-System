import { render, screen } from "@testing-library/react";
import GlobalError from "./global-error";

describe("global error fallback", () => {
  it("renders a friendly message and a way back home", () => {
    render(<GlobalError />);

    expect(
      screen.getByRole("heading", { name: "We couldn't load this page." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/contact your system administrator/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
