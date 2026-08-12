import { render, screen } from "@testing-library/react";
import { StatusIndicator } from "./StatusIndicator";

describe("StatusIndicator", () => {
  it("renders the provided status label as visible text", () => {
    render(<StatusIndicator label="Operational" />);

    expect(screen.getByText("Operational")).toBeInTheDocument();
  });
});
