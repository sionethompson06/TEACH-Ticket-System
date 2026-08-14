"use server";

import { revalidatePath } from "next/cache";
import { requireActiveActor } from "@/auth/current-actor";
import { getDb } from "@/db/client";
import { TicketValidationError } from "@/tickets/errors";
import {
  addTicketComment,
  assignTicket,
  updateTicketPriority,
  updateTicketStatus,
} from "@/tickets/ticket-service";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/tickets/ticket-status";

export interface SupportActionState {
  status: "idle" | "error" | "success";
  formError?: string;
}

export const EMPTY_SUPPORT_ACTION_STATE: SupportActionState = {
  status: "idle",
};

function friendlyError(error: unknown, fallback: string): string {
  return error instanceof TicketValidationError ? error.message : fallback;
}

// Every mutation revalidates both sides of the same ticket — the support
// queue and workspace, and the requester's own list and detail page — so
// a change is visible everywhere immediately, without ever changing
// status/priority/assignment as a side effect of an unrelated action.
function revalidateTicketPaths(ticketNumberPath: string): void {
  revalidatePath("/support");
  revalidatePath(`/support/${ticketNumberPath}`);
  revalidatePath("/requests");
  revalidatePath(`/requests/${ticketNumberPath}`);
}

// The general assignment control: reads the selected agent id (or empty
// string for "Unassigned") from the form. assignTicket() itself re-checks
// that the id names an active department agent for this ticket's own
// department — a tampered value is rejected there, not trusted here.
export async function assignTicketAction(
  ticketId: string,
  ticketNumberPath: string,
  _previousState: SupportActionState,
  formData: FormData,
): Promise<SupportActionState> {
  const actor = await requireActiveActor(`/support/${ticketNumberPath}`);
  const raw = String(formData.get("assigneeId") ?? "");
  const assigneeUserId = raw === "" ? null : raw;

  try {
    await assignTicket(getDb(), actor, ticketId, assigneeUserId);
  } catch (error) {
    return {
      status: "error",
      formError: friendlyError(error, "We couldn't update the assignment."),
    };
  }

  revalidateTicketPaths(ticketNumberPath);
  return { status: "success" };
}

// "Assign to me" never reads a client-supplied user id at all — it always
// assigns the actor resolved from the validated server session.
export async function assignToMeAction(
  ticketId: string,
  ticketNumberPath: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's (state, payload) action signature
  _previousState: SupportActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's (state, payload) action signature
  _formData: FormData,
): Promise<SupportActionState> {
  const actor = await requireActiveActor(`/support/${ticketNumberPath}`);

  try {
    await assignTicket(getDb(), actor, ticketId, actor.userId);
  } catch (error) {
    return {
      status: "error",
      formError: friendlyError(error, "We couldn't update the assignment."),
    };
  }

  revalidateTicketPaths(ticketNumberPath);
  return { status: "success" };
}

export async function updateStatusAction(
  ticketId: string,
  ticketNumberPath: string,
  _previousState: SupportActionState,
  formData: FormData,
): Promise<SupportActionState> {
  const actor = await requireActiveActor(`/support/${ticketNumberPath}`);
  const raw = String(formData.get("status") ?? "");

  if (!(TICKET_STATUSES as readonly string[]).includes(raw)) {
    return { status: "error", formError: "Choose a valid status." };
  }

  try {
    await updateTicketStatus(
      getDb(),
      actor,
      ticketId,
      raw as (typeof TICKET_STATUSES)[number],
    );
  } catch (error) {
    return {
      status: "error",
      formError: friendlyError(error, "We couldn't update the status."),
    };
  }

  revalidateTicketPaths(ticketNumberPath);
  return { status: "success" };
}

export async function updatePriorityAction(
  ticketId: string,
  ticketNumberPath: string,
  _previousState: SupportActionState,
  formData: FormData,
): Promise<SupportActionState> {
  const actor = await requireActiveActor(`/support/${ticketNumberPath}`);
  const raw = String(formData.get("priority") ?? "");

  if (!(TICKET_PRIORITIES as readonly string[]).includes(raw)) {
    return { status: "error", formError: "Choose a valid priority." };
  }

  try {
    await updateTicketPriority(
      getDb(),
      actor,
      ticketId,
      raw as (typeof TICKET_PRIORITIES)[number],
    );
  } catch (error) {
    return {
      status: "error",
      formError: friendlyError(error, "We couldn't update the priority."),
    };
  }

  revalidateTicketPaths(ticketNumberPath);
  return { status: "success" };
}

export interface SendMessageState {
  status: "idle" | "error" | "success";
  formError?: string;
  body: string;
}

export const EMPTY_SEND_MESSAGE_STATE: SendMessageState = {
  status: "idle",
  body: "",
};

// Uses the same public-comment behavior as the requester's Send Message
// form (addTicketComment enforces its own access_ticket authorization and
// closed-ticket rule) — this action only adds the support-side
// revalidation targets.
export async function sendSupportMessageAction(
  ticketId: string,
  ticketNumberPath: string,
  _previousState: SendMessageState,
  formData: FormData,
): Promise<SendMessageState> {
  const actor = await requireActiveActor(`/support/${ticketNumberPath}`);
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
    return {
      status: "error",
      formError: friendlyError(error, "We couldn't send your message."),
      body,
    };
  }

  revalidateTicketPaths(ticketNumberPath);
  return { status: "success", body: "" };
}
