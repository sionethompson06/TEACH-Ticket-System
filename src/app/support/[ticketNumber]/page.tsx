import { notFound } from "next/navigation";
import { requireActiveActor } from "@/auth/current-actor";
import { getDb } from "@/db/client";
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from "@/tickets/labels";
import { listTicketComments } from "@/tickets/ticket-queries";
import {
  getSupportTicketDetailByNumber,
  listActiveDepartmentAgents,
  listTicketActivity,
} from "@/tickets/support-queries";
import { SendMessageForm } from "./send-message-form";
import {
  AssignmentControl,
  PriorityControl,
  StatusControl,
} from "./support-controls";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function SupportTicketWorkspacePage({
  params,
}: PageProps<"/support/[ticketNumber]">) {
  const { ticketNumber } = await params;
  const actor = await requireActiveActor(`/support/${ticketNumber}`);
  const db = getDb();

  // getSupportTicketDetailByNumber returns null uniformly for a malformed
  // number, a nonexistent ticket, an ordinary requester with no support
  // access at all, and an existing-but-wrong-department ticket —
  // notFound() renders the same friendly page for every case.
  const ticket = await getSupportTicketDetailByNumber(db, actor, ticketNumber);
  if (!ticket) {
    notFound();
  }

  const [comments, activity, agents] = await Promise.all([
    listTicketComments(db, actor, ticket.id),
    listTicketActivity(db, actor, ticket.id),
    listActiveDepartmentAgents(db, actor, ticket.id),
  ]);

  const isClosed = ticket.status === "closed";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="font-mono text-sm font-semibold text-slate-500 dark:text-slate-400">
          {ticketNumber}
        </p>
        <h1 className="text-2xl font-bold sm:text-3xl">{ticket.subject}</h1>
      </div>

      <section aria-labelledby="status-heading" className="flex flex-col gap-3">
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
          <span className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold dark:border-slate-700">
            {ticket.assignedAgentName
              ? `Assigned to ${ticket.assignedAgentName}`
              : "Unassigned"}
          </span>
        </div>
        {isClosed && (
          <p
            role="status"
            className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            This request is closed. No further changes or messages can be made.
          </p>
        )}
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
              Requested by
            </dt>
            <dd>{ticket.requesterName}</dd>
          </div>
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
              Category
            </dt>
            <dd>{ticket.categoryName}</dd>
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
        </dl>
        <div>
          <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Description
          </h3>
          <p className="mt-1 whitespace-pre-wrap">{ticket.description}</p>
        </div>
      </section>

      {!isClosed && (
        <section
          aria-labelledby="controls-heading"
          className="flex flex-col gap-6 rounded-lg border border-slate-200 p-5 dark:border-slate-800"
        >
          <h2 id="controls-heading" className="text-lg font-semibold">
            Support controls
          </h2>
          <AssignmentControl
            ticketId={ticket.id}
            ticketNumber={ticketNumber}
            currentAssigneeId={ticket.assignedAgentId}
            currentUserId={actor.userId}
            agents={agents ?? []}
          />
          <StatusControl
            ticketId={ticket.id}
            ticketNumber={ticketNumber}
            currentStatus={ticket.status}
          />
          <PriorityControl
            ticketId={ticket.id}
            ticketNumber={ticketNumber}
            currentPriority={ticket.priority}
          />
        </section>
      )}

      <section
        aria-labelledby="conversation-heading"
        className="flex flex-col gap-4"
      >
        <h2 id="conversation-heading" className="text-lg font-semibold">
          Conversation
        </h2>
        {!comments || comments.length === 0 ? (
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
                  <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    {comment.isFromRequester ? "Requester" : "Support Team"}
                  </span>
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

        {isClosed ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This request is closed, so no further replies can be sent.
          </p>
        ) : (
          <SendMessageForm ticketId={ticket.id} ticketNumber={ticketNumber} />
        )}
      </section>

      <section
        aria-labelledby="activity-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="activity-heading" className="text-lg font-semibold">
          Activity history
        </h2>
        {!activity || activity.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No activity yet.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {activity.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline gap-2 text-sm text-slate-700 dark:text-slate-300"
              >
                <span>{entry.description}</span>
                <time
                  dateTime={entry.createdAt.toISOString()}
                  className="text-slate-500 dark:text-slate-400"
                >
                  {formatDateTime(entry.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
