import Link from "next/link";
import { requireActiveActor } from "@/auth/current-actor";
import { isSupportStaff } from "@/authz/policy";
import { getDb } from "@/db/client";
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from "@/tickets/labels";
import { formatTicketNumber } from "@/tickets/ticket-number";
import { TICKET_STATUSES } from "@/tickets/ticket-status";
import {
  listSupportFilterOptions,
  listSupportQueueTickets,
  type SupportAssignmentFilter,
} from "@/tickets/support-queries";

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

const ASSIGNMENT_OPTIONS: { value: SupportAssignmentFilter; label: string }[] =
  [
    { value: "all", label: "All" },
    { value: "mine", label: "Mine" },
    { value: "unassigned", label: "Unassigned" },
  ];

export default async function SupportQueuePage({
  searchParams,
}: PageProps<"/support">) {
  const actor = await requireActiveActor("/support");

  if (!isSupportStaff(actor)) {
    return (
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-2xl font-bold sm:text-3xl">
          Support workspace access
        </h1>
        <p className="max-w-md text-base leading-7 text-slate-600 dark:text-slate-400">
          You don&apos;t have access to the support workspace. If you believe
          this is a mistake, contact your system administrator.
        </p>
        <Link
          href="/requests"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Back to My Requests
        </Link>
      </div>
    );
  }

  const resolvedSearchParams = await searchParams;
  const db = getDb();
  const options = await listSupportFilterOptions(db, actor);
  const { tickets, filters } = await listSupportQueueTickets(db, actor, {
    department: firstValue(resolvedSearchParams.department),
    location: firstValue(resolvedSearchParams.location),
    status: firstValue(resolvedSearchParams.status),
    assignment: firstValue(resolvedSearchParams.assignment),
  });

  const hasActiveFilters =
    filters.departmentId !== null ||
    filters.serviceLocationId !== null ||
    filters.status !== null ||
    filters.assignment !== "all";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Support Queue</h1>
        <p className="mt-1 max-w-2xl text-base text-slate-600 dark:text-slate-400">
          Active requests for your department
          {options.departments.length > 1 ? "s" : ""}.
        </p>
      </div>

      <form
        method="get"
        className="flex flex-col gap-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:flex-wrap sm:items-end"
      >
        {options.departments.length > 1 && (
          <div className="flex flex-col gap-1">
            <label htmlFor="department" className="text-sm font-semibold">
              Department
            </label>
            <select
              id="department"
              name="department"
              defaultValue={filters.departmentId ?? ""}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">All departments</option>
              {options.departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="location" className="text-sm font-semibold">
            Location
          </label>
          <select
            id="location"
            name="location"
            defaultValue={filters.serviceLocationId ?? ""}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">All locations</option>
            {options.serviceLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-sm font-semibold">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={filters.status ?? ""}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Active (default)</option>
            {TICKET_STATUSES.map((status) => (
              <option key={status} value={status}>
                {TICKET_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="assignment" className="text-sm font-semibold">
            Assignment
          </label>
          <select
            id="assignment"
            name="assignment"
            defaultValue={filters.assignment}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {ASSIGNMENT_OPTIONS.map((assignmentOption) => (
              <option
                key={assignmentOption.value}
                value={assignmentOption.value}
              >
                {assignmentOption.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Apply filters
          </button>
          <Link
            href="/support"
            className="text-sm font-medium text-slate-700 hover:underline dark:text-slate-300"
          >
            Clear filters
          </Link>
        </div>
      </form>

      {tickets.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-6 py-10 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-base text-slate-700 dark:text-slate-300">
            {hasActiveFilters
              ? "No requests match these filters."
              : "No active requests."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Support queue">
          {tickets.map((ticket) => {
            const number = formatTicketNumber(ticket.ticketNumber);
            return (
              <li key={ticket.id}>
                <Link
                  href={`/support/${number}`}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 px-5 py-4 transition-colors hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:border-slate-800 dark:hover:border-slate-600"
                >
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="font-mono text-sm font-semibold text-slate-500 dark:text-slate-400">
                      {number}
                    </span>
                    <span className="font-semibold">{ticket.subject}</span>
                    <span className="inline-flex w-fit items-center rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                      {TICKET_STATUS_LABELS[ticket.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
                    <span>Requested by {ticket.requesterName}</span>
                    <span>
                      {ticket.departmentName} · {ticket.serviceLocationName}
                    </span>
                    <span>
                      {TICKET_PRIORITY_LABELS[ticket.priority]} priority
                    </span>
                    <span>
                      {ticket.assignedAgentName
                        ? `Assigned to ${ticket.assignedAgentName}`
                        : "Unassigned"}
                    </span>
                    <span>Submitted {formatDate(ticket.createdAt)}</span>
                    <span>Updated {formatDate(ticket.updatedAt)}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
