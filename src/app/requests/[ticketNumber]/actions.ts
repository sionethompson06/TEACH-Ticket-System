"use server";

import { revalidatePath } from "next/cache";
import { requireActiveActor } from "@/auth/current-actor";
import { getDb } from "@/db/client";
import { TicketValidationError } from "@/tickets/errors";
import { addTicketComment } from "@/tickets/ticket-service";

export interface SendMessageFormState {
  status: "idle" | "error" | "success";
  formError?: string;
  body: string;
}

export const EMPTY_SEND_MESSAGE_STATE: SendMessageFormState = {
  status: "idle",
  body: "",
};

// Only the requester who owns this ticket, or another user already
// authorized by the Phase 5 ticket service (a department agent or system
// administrator for its department), can post — addTicketComment enforces
// this itself via the same access_ticket authorization used everywhere
// else; this action never re-implements that check.
export async function sendMessageAction(
  ticketId: string,
  ticketNumberPath: string,
  _previousState: SendMessageFormState,
  formData: FormData,
): Promise<SendMessageFormState> {
  const actor = await requireActiveActor(`/requests/${ticketNumberPath}`);
  const body = String(formData.get("body") ?? "");

  if (body.trim().length === 0) {
    return {
      status: "error",
      formError: "Enter a message before sending.",
      body,
    };
  }

  try {
    await addTicketComment(getDb(), actor, ticketId, body);
  } catch (error) {
    const formError =
      error instanceof TicketValidationError
        ? error.message
        : "We couldn't send your message. Please try again.";
    return { status: "error", formError, body };
  }

  revalidatePath(`/requests/${ticketNumberPath}`);
  return { status: "success", body: "" };
}
