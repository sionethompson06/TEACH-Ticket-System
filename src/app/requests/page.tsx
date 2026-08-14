import Link from "next/link";
import { requireActiveActor } from "@/auth/current-actor";
import { getDb } from "@/db/client";
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from "@/tickets/labels";
import { formatTicketNumber } from "@/tickets/ticket-number";
import { listMyTickets } from "@/tickets/ticket-queries";

function formatUpdatedDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

export default async function MyRequestsPage() {
  const actor = await requireActiveActor("/requests");
  const myTickets = await listMyTickets(getDb(), actor);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-3xl">My Requests</h1>
        <Link
          href="/requests/new"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Request Help
        </Link>
      </div>

      {myTickets.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-lg border border-slate-200 bg-slate-50 px-6 py-10 dark:border-slate-800 dark:bg-slate-900">
          <p className="max-w-md text-base leading-7 text-slate-700 dark:text-slate-300">
            You haven&apos;t submitted any help requests yet. Need something
            from IT or Facilities? We&apos;re here to help.
          </p>
          <Link
            href="/requests/new"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Request Help
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Your requests">
          {myTickets.map((ticket) => {
            const number = formatTicketNumber(ticket.ticketNumber);
            return (
              <li key={ticket.ticketNumber}>
                <Link
                  href={`/requests/${number}`}
                  className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-lg border border-slate-200 px-5 py-4 transition-colors hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:border-slate-800 dark:hover:border-slate-600 sm:grid-cols-[auto_1fr_auto_auto_auto] sm:items-center"
                >
                  <span className="font-mono text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {number}
                  </span>
                  <span className="font-semibold">{ticket.subject}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {ticket.departmentName} · {ticket.serviceLocationName}
                  </span>
                  <span className="inline-flex w-fit items-center rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                    {TICKET_STATUS_LABELS[ticket.status]}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {TICKET_PRIORITY_LABELS[ticket.priority]} priority · updated{" "}
                    {formatUpdatedDate(ticket.updatedAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
