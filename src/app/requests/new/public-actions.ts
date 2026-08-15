"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import {
  getPublicIntakeRateLimitSecret,
  isPublicTicketIntakeEnabled,
} from "@/public-intake/env";
import {
  checkAndRecordRateLimit,
  computeRateLimitFingerprint,
  resolveClientIpForFingerprint,
} from "@/public-intake/rate-limit";
import { TicketValidationError } from "@/tickets/errors";
import { createPublicTicket } from "@/tickets/public-intake-service";
import { formatTicketNumber } from "@/tickets/ticket-number";

// A separate Server Action boundary from src/app/requests/new/actions.ts's
// createTicketAction — this one never resolves or requires a session, and
// never calls the authenticated createTicket() service. It only ever calls
// the separate public-intake-service.ts, which hardcodes the fixed
// organization and reserved requester itself.

export interface CreatePublicTicketFormValues {
  requesterName: string;
  requesterEmail: string;
  departmentId: string;
  serviceLocationId: string;
  categoryId: string;
  subject: string;
  description: string;
}

export interface CreatePublicTicketFormState {
  status: "idle" | "error";
  fieldErrors: Partial<Record<keyof CreatePublicTicketFormValues, string>>;
  formError?: string;
  values: CreatePublicTicketFormValues;
}

export const EMPTY_PUBLIC_TICKET_VALUES: CreatePublicTicketFormValues = {
  requesterName: "",
  requesterEmail: "",
  departmentId: "",
  serviceLocationId: "",
  categoryId: "",
  subject: "",
  description: "",
};

// Deliberately generic: never states whether the problem was rate
// limiting, a missing rate-limit configuration, or anything else — the
// abuse-protection mechanism is never revealed to the caller.
const GENERIC_SUBMISSION_ERROR =
  "We couldn't submit your request right now. Please try again in a few minutes.";

// The name a real requester never fills in, but a simple automated form
// filler often will. Not disclosed anywhere in the rendered page's visible
// text or accessible labels.
const HONEYPOT_FIELD_NAME = "company_website";

function readFormValues(formData: FormData): CreatePublicTicketFormValues {
  return {
    requesterName: String(formData.get("requesterName") ?? ""),
    requesterEmail: String(formData.get("requesterEmail") ?? ""),
    departmentId: String(formData.get("departmentId") ?? ""),
    serviceLocationId: String(formData.get("serviceLocationId") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    description: String(formData.get("description") ?? ""),
  };
}

export async function createPublicTicketAction(
  _previousState: CreatePublicTicketFormState,
  formData: FormData,
): Promise<CreatePublicTicketFormState> {
  const values = readFormValues(formData);

  // Defense in depth: even if this action were somehow invoked while the
  // flag is off (e.g. a stale rendered page after a configuration change),
  // never create a ticket.
  if (!isPublicTicketIntakeEnabled()) {
    redirect("/");
  }

  // A completed honeypot field creates no ticket, but still lands on the
  // same generic confirmation page a real submission would — the
  // mechanism itself is never revealed by a different response shape.
  const honeypotValue = String(formData.get(HONEYPOT_FIELD_NAME) ?? "");
  if (honeypotValue.trim().length > 0) {
    redirect("/requests/new/submitted");
  }

  const fieldErrors: CreatePublicTicketFormState["fieldErrors"] = {};
  if (values.requesterName.trim().length === 0) {
    fieldErrors.requesterName = "Enter your name.";
  }
  if (values.requesterEmail.trim().length === 0) {
    fieldErrors.requesterEmail = "Enter your email address.";
  }
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
    return { status: "error", fieldErrors, values };
  }

  // Fail closed: if the rate-limit secret isn't configured at all, no
  // submission can be fingerprinted or limited, so none is accepted.
  let rateLimitSecret: string;
  try {
    rateLimitSecret = getPublicIntakeRateLimitSecret();
  } catch {
    return {
      status: "error",
      fieldErrors: {},
      formError: GENERIC_SUBMISSION_ERROR,
      values,
    };
  }

  const clientIp = resolveClientIpForFingerprint(await headers());
  const fingerprint = computeRateLimitFingerprint(rateLimitSecret, clientIp);
  // Never logged: not the client IP, not the fingerprint, not the outcome.
  const rateLimit = await checkAndRecordRateLimit(getDb(), fingerprint);
  if (!rateLimit.allowed) {
    return {
      status: "error",
      fieldErrors: {},
      formError: GENERIC_SUBMISSION_ERROR,
      values,
    };
  }

  let ticketNumber: number;
  try {
    const ticket = await createPublicTicket(getDb(), values);
    ticketNumber = ticket.ticketNumber;
  } catch (error) {
    const formError =
      error instanceof TicketValidationError
        ? error.message
        : GENERIC_SUBMISSION_ERROR;
    return { status: "error", fieldErrors: {}, formError, values };
  }

  // The ticket number alone is not sensitive and cannot be used to look
  // anything up (the confirmation page never queries the database) — but
  // the requester's name and email are never placed in this or any URL.
  redirect(
    `/requests/new/submitted?ticket=${formatTicketNumber(ticketNumber)}`,
  );
}
