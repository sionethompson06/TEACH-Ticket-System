import { notFound } from "next/navigation";
import { requireActiveActor } from "@/auth/current-actor";
import { getDb } from "@/db/client";
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from "@/tickets/labels";
import { formatTicketNumber } from "@/tickets/ticket-number";
import {
  getTicketDetailByNumber,
  listTicketComments,
} from "@/tickets/ticket-queries";
import { SendMessageForm } from "./send-message-form";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function TicketDetailPage({
  params,
  searchParams,
}: PageProps<"/requests/[ticketNumber]">) {
  const { ticketNumber } = await params;
  const resolvedSearchParams = await searchParams;
  const actor = await requireActiveActor(`/requests/${ticketNumber}`);
  const db = getDb();

  // getTicketDetailByNumber returns null uniformly for a malformed
  // number, a nonexistent ticket, and an existing-but-inaccessible one —
  // notFound() renders the same friendly page for all three.
  const ticket = await getTicketDetailByNumber(db, actor, ticketNumber);
  if (!ticket) {
    notFound();
  }

  const comments = (await listTicketComments(db, actor, ticket.id)) ?? [];
  const justSubmitted = resolvedSearchParams.submitted === "1";

  return (
    <div className="flex flex-col gap-8">
      {justSubmitted && (
        <p
          role="status"
          className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
        >
          Your request {formatTicketNumber(ticket.ticketNumber)} was submitted.
          We&apos;ll be in touch soon.
        </p>
      )}

      <div>
        <p className="font-mono text-sm font-semibold text-slate-500 dark:text-slate-400">
          {formatTicketNumber(ticket.ticketNumber)}
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">{ticket.subject}</h1>
      </div>

      <section aria-labelledby="status-heading" className="flex flex-col gap-2">
        <h2 id="status-heading" className="text-lg font-semibold">
          Current status
        </h2>
        <div className="flex flex-wrap gap-3">
          <span className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold dark:border-slate-700">
            {TICKET_STATUS_LABELS[ticket.status]}
          </span>
          <span className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold dark:border-slate-700">
            {TICKET_PRIORITY_LABELS[ticket.priority]} priority
          </span>
        </div>
      </section>

      <section
        aria-labelledby="details-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="details-heading" className="text-lg font-semibold">
          Request details
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Department
            </dt>
            <dd>{ticket.departmentName}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Location
            </dt>
            <dd>{ticket.serviceLocationName}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Submitted
            </dt>
            <dd>{formatDate(ticket.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Last updated
            </dt>
            <dd>{formatDate(ticket.updatedAt)}</dd>
          </div>
          {ticket.assignedAgentName && (
            <div>
              <dt className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                Assigned to
              </dt>
              <dd>{ticket.assignedAgentName}</dd>
            </div>
          )}
        </dl>
        <div>
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Description
          </h3>
          <p className="mt-1 whitespace-pre-wrap">{ticket.description}</p>
        </div>
      </section>

      <section
        aria-labelledby="conversation-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="conversation-heading" className="text-lg font-semibold">
          Conversation
        </h2>
        {comments.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No messages yet.
          </p>
        ) : (
          <ol className="flex flex-col gap-4">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-800"
              >
                <p className="flex flex-wrap items-baseline gap-2 text-sm">
                  <strong>{comment.authorName}</strong>
                  {!comment.isFromRequester && (
                    <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-300">
                      Support Team
                    </span>
                  )}
                  <time
                    dateTime={comment.createdAt.toISOString()}
                    className="text-slate-500 dark:text-slate-400"
                  >
                    {formatDateTime(comment.createdAt)}
                  </time>
                </p>
                <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
              </li>
            ))}
          </ol>
        )}

        <SendMessageForm ticketId={ticket.id} ticketNumber={ticketNumber} />
      </section>
    </div>
  );
}
