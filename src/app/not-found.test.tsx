import { render, screen } from "@testing-library/react";
import NotFound from "./not-found";

describe("root not-found page", () => {
  it("renders a friendly message and a way back home", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: "We couldn't find this page." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
