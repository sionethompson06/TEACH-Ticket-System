import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PublicRequestForm } from "./public-request-form";

const { createPublicTicketAction } = vi.hoisted(() => ({
  createPublicTicketAction: vi.fn(),
}));

vi.mock("./public-actions", async () => {
  const actual =
    await vi.importActual<typeof import("./public-actions")>(
      "./public-actions",
    );
  return {
    ...actual,
    createPublicTicketAction,
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
  {
    id: "cat-fac-1",
    departmentId: "dept-facilities",
    name: "HVAC and Air Quality",
  },
];

const LOCATIONS = [{ id: "loc-1", name: "TEACH Prep Elementary School" }];

const EMPTY_VALUES = {
  requesterName: "",
  requesterEmail: "",
  departmentId: "",
  serviceLocationId: "",
  categoryId: "",
  subject: "",
  description: "",
};

function renderForm() {
  return render(
    <PublicRequestForm
      departments={DEPARTMENTS}
      categories={CATEGORIES}
      serviceLocations={LOCATIONS}
    />,
  );
}

describe("PublicRequestForm", () => {
  beforeEach(() => {
    createPublicTicketAction.mockReset();
    createPublicTicketAction.mockImplementation(async () => ({
      status: "idle",
      fieldErrors: {},
      values: EMPTY_VALUES,
    }));
  });

  it("labels the requester name and email fields", () => {
    renderForm();

    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your email/i)).toBeInTheDocument();
  });

  it("labels every existing required field, same as the authenticated form", () => {
    renderForm();

    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it("never renders a field for requester id, organization, priority, status, or assignee", () => {
    renderForm();

    for (const forbidden of [
      /organization/i,
      /priority/i,
      /^status$/i,
      /assignee/i,
    ]) {
      expect(screen.queryByLabelText(forbidden)).not.toBeInTheDocument();
    }
  });

  it("includes a privacy warning about sensitive information", () => {
    renderForm();

    expect(screen.getByText(/social security numbers/i)).toBeInTheDocument();
  });

  it("renders the honeypot field visually hidden and outside the tab order, with no visible label text", () => {
    renderForm();

    const honeypot = document.querySelector(
      'input[name="company_website"]',
    ) as HTMLInputElement | null;
    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot?.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("shows field-level validation errors returned by the server action", async () => {
    createPublicTicketAction.mockResolvedValueOnce({
      status: "error",
      fieldErrors: {
        requesterName: "Enter your name.",
        requesterEmail: "Enter your email address.",
      },
      values: EMPTY_VALUES,
    });

    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => {
      expect(screen.getByText("Enter your name.")).toBeInTheDocument();
      expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    });
  });

  it("shows a generic form-level error without disclosing rate limiting or its mechanism", async () => {
    createPublicTicketAction.mockResolvedValueOnce({
      status: "error",
      fieldErrors: {},
      formError:
        "We couldn't submit your request right now. Please try again in a few minutes.",
      values: EMPTY_VALUES,
    });

    renderForm();
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/couldn't submit your request right now/i),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/rate limit/i)).not.toBeInTheDocument();
  });
});
