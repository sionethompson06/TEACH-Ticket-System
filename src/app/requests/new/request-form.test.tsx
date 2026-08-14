import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequestForm } from "./request-form";

const { createTicketAction } = vi.hoisted(() => ({
  createTicketAction: vi.fn(),
}));

vi.mock("./actions", async () => {
  const actual = await vi.importActual<typeof import("./actions")>("./actions");
  return {
    ...actual,
    createTicketAction,
  };
});

const DEPARTMENTS = [
  { id: "dept-it", code: "IT", name: "Information Technology" },
  { id: "dept-facilities", code: "FACILITIES", name: "Facilities" },
];

const CATEGORIES = [
  {
    id: "cat-it-1",
    departmentId: "dept-it",
    name: "Student and Staff Devices",
  },
  { id: "cat-it-2", departmentId: "dept-it", name: "Network and Connectivity" },
  {
    id: "cat-fac-1",
    departmentId: "dept-facilities",
    name: "HVAC and Air Quality",
  },
];

const LOCATIONS = [
  { id: "loc-1", name: "TEACH Prep Elementary School" },
  { id: "loc-2", name: "TEACH Tech Charter High School" },
];

function renderForm() {
  return render(
    <RequestForm
      departments={DEPARTMENTS}
      categories={CATEGORIES}
      serviceLocations={LOCATIONS}
    />,
  );
}

describe("RequestForm", () => {
  beforeEach(() => {
    createTicketAction.mockReset();
    createTicketAction.mockImplementation(async () => ({
      status: "idle",
      fieldErrors: {},
      values: {
        departmentId: "",
        serviceLocationId: "",
        categoryId: "",
        subject: "",
        description: "",
      },
    }));
  });

  it("renders IT and Facilities as two distinct choices", () => {
    renderForm();

    expect(
      screen.getByRole("radio", { name: /information technology/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /facilities/i }),
    ).toBeInTheDocument();
  });

  it("renders every active location", () => {
    renderForm();

    const locationSelect = screen.getByLabelText(/location/i);
    for (const location of LOCATIONS) {
      expect(
        screen.getByRole("option", { name: location.name }),
      ).toBeInTheDocument();
    }
    expect(locationSelect).toBeInTheDocument();
  });

  it("labels every required field", () => {
    renderForm();

    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it("disables the category field until a department is chosen, then filters by department", () => {
    renderForm();

    const categorySelect = screen.getByLabelText(/category/i);
    expect(categorySelect).toBeDisabled();
    expect(
      screen.queryByRole("option", { name: "Student and Staff Devices" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("radio", { name: /information technology/i }),
    );

    expect(screen.getByLabelText(/category/i)).toBeEnabled();
    expect(
      screen.getByRole("option", { name: "Student and Staff Devices" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "HVAC and Air Quality" }),
    ).not.toBeInTheDocument();
  });

  it("shows the Facilities emergency warning only once Facilities is chosen", () => {
    renderForm();

    expect(screen.queryByRole("note")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /facilities/i }));

    expect(screen.getByRole("note")).toHaveTextContent(/emergency/i);
    expect(screen.getByRole("note")).toHaveTextContent(/911/);
  });

  it("never renders a field for requester, organization, priority, status, or assignee", () => {
    renderForm();

    for (const forbidden of [
      /requester/i,
      /organization/i,
      /priority/i,
      /status/i,
      /assignee/i,
    ]) {
      expect(screen.queryByLabelText(forbidden)).not.toBeInTheDocument();
    }
  });

  it("shows field-level validation errors returned by the server action", async () => {
    createTicketAction.mockResolvedValueOnce({
      status: "error",
      fieldErrors: {
        departmentId: "Choose IT or Facilities.",
        subject: "Enter a short subject.",
      },
      values: {
        departmentId: "",
        serviceLocationId: "",
        categoryId: "",
        subject: "",
        description: "",
      },
    });

    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => {
      expect(screen.getByText("Choose IT or Facilities.")).toBeInTheDocument();
      expect(screen.getByText("Enter a short subject.")).toBeInTheDocument();
    });
  });

  it("shows a pending submission state and disables the submit button while pending", async () => {
    let resolveAction: (value: unknown) => void = () => {};
    createTicketAction.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    renderForm();
    const submitButton = screen.getByRole("button", {
      name: /submit request/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /submitting request/i }),
      ).toBeDisabled();
    });

    resolveAction({
      status: "idle",
      fieldErrors: {},
      values: {
        departmentId: "",
        serviceLocationId: "",
        categoryId: "",
        subject: "",
        description: "",
      },
    });
  });
});
