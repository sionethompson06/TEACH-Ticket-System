"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveActor } from "@/auth/current-actor";
import { getDb } from "@/db/client";
import { TicketValidationError } from "@/tickets/errors";
import { formatTicketNumber } from "@/tickets/ticket-number";
import { createTicket } from "@/tickets/ticket-service";

export interface CreateTicketFormValues {
  departmentId: string;
  serviceLocationId: string;
  categoryId: string;
  subject: string;
  description: string;
}

export interface CreateTicketFormState {
  status: "idle" | "error";
  fieldErrors: Partial<Record<keyof CreateTicketFormValues, string>>;
  formError?: string;
  values: CreateTicketFormValues;
}

export const EMPTY_CREATE_TICKET_VALUES: CreateTicketFormValues = {
  departmentId: "",
  serviceLocationId: "",
  categoryId: "",
  subject: "",
  description: "",
};

function readFormValues(formData: FormData): CreateTicketFormValues {
  return {
    departmentId: String(formData.get("departmentId") ?? ""),
    serviceLocationId: String(formData.get("serviceLocationId") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    description: String(formData.get("description") ?? ""),
  };
}

// The requester and organization are never read from `formData` — they
// come only from the actor resolved fresh from the validated server
// session, so nothing a client submits can influence either value.
export async function createTicketAction(
  _previousState: CreateTicketFormState,
  formData: FormData,
): Promise<CreateTicketFormState> {
  const values = readFormValues(formData);
  const actor = await requireActiveActor("/requests/new");

  const fieldErrors: CreateTicketFormState["fieldErrors"] = {};
  if (!values.departmentId) {
    fieldErrors.departmentId = "Choose IT or Facilities.";
  }
  if (!values.serviceLocationId) {
    fieldErrors.serviceLocationId = "Choose a location.";
  }
  if (!values.categoryId) {
    fieldErrors.categoryId = "Choose a category.";
  }
  if (values.subject.trim().length === 0) {
    fieldErrors.subject = "Enter a short subject.";
  }
  if (values.description.trim().length === 0) {
    fieldErrors.description = "Describe what's going on.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", fieldErrors: fieldErrors, values };
  }

  let ticketNumber: number;
  try {
    const ticket = await createTicket(getDb(), actor, values);
    ticketNumber = ticket.ticketNumber;
  } catch (error) {
    const formError =
      error instanceof TicketValidationError
        ? error.message
        : "We couldn't submit your request. Please try again.";
    return { status: "error", fieldErrors: {}, formError, values };
  }

  revalidatePath("/requests");
  redirect(`/requests/${formatTicketNumber(ticketNumber)}?submitted=1`);
}
