"use client";

import { useActionState, useMemo } from "react";
import { useFormStatus } from "react-dom";
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from "@/tickets/labels";
import {
  canTransitionTicketStatus,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from "@/tickets/ticket-status";
import {
  assignTicketAction,
  assignToMeAction,
  EMPTY_SUPPORT_ACTION_STATE,
  updatePriorityAction,
  updateStatusAction,
} from "./actions";

function ControlButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-fit items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

const selectClassName =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900";

export function AssignmentControl({
  ticketId,
  ticketNumber,
  currentAssigneeId,
  currentUserId,
  agents,
}: {
  ticketId: string;
  ticketNumber: string;
  currentAssigneeId: string | null;
  currentUserId: string;
  agents: { id: string; name: string }[];
}) {
  const boundAssignToMe = useMemo(
    () => assignToMeAction.bind(null, ticketId, ticketNumber),
    [ticketId, ticketNumber],
  );
  const [assignToMeState, assignToMeFormAction] = useActionState(
    boundAssignToMe,
    EMPTY_SUPPORT_ACTION_STATE,
  );

  const boundAssign = useMemo(
    () => assignTicketAction.bind(null, ticketId, ticketNumber),
    [ticketId, ticketNumber],
  );
  const [assignState, assignFormAction] = useActionState(
    boundAssign,
    EMPTY_SUPPORT_ACTION_STATE,
  );

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Assignment</h3>

      {currentAssigneeId !== currentUserId && (
        <form action={assignToMeFormAction}>
          <ControlButton label="Assign to me" pendingLabel="Assigning…" />
        </form>
      )}
      {assignToMeState.formError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {assignToMeState.formError}
        </p>
      )}

      <form
        action={assignFormAction}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="assigneeId" className="text-sm">
            Assignee
          </label>
          <select
            id="assigneeId"
            name="assigneeId"
            defaultValue={currentAssigneeId ?? ""}
            className={selectClassName}
          >
            <option value="">Unassigned</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
        <ControlButton label="Save assignment" pendingLabel="Saving…" />
      </form>
      {assignState.formError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {assignState.formError}
        </p>
      )}
    </div>
  );
}

export function StatusControl({
  ticketId,
  ticketNumber,
  currentStatus,
}: {
  ticketId: string;
  ticketNumber: string;
  currentStatus: TicketStatus;
}) {
  const boundAction = useMemo(
    () => updateStatusAction.bind(null, ticketId, ticketNumber),
    [ticketId, ticketNumber],
  );
  const [state, formAction] = useActionState(
    boundAction,
    EMPTY_SUPPORT_ACTION_STATE,
  );

  const validNextStatuses = TICKET_STATUSES.filter((status) =>
    canTransitionTicketStatus(currentStatus, status),
  );

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Status</h3>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-sm">
            New status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={validNextStatuses[0]}
            className={selectClassName}
          >
            {validNextStatuses.map((status) => (
              <option key={status} value={status}>
                {TICKET_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <ControlButton label="Update status" pendingLabel="Updating…" />
      </form>
      {state.formError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.formError}
        </p>
      )}
    </div>
  );
}

export function PriorityControl({
  ticketId,
  ticketNumber,
  currentPriority,
}: {
  ticketId: string;
  ticketNumber: string;
  currentPriority: TicketPriority;
}) {
  const boundAction = useMemo(
    () => updatePriorityAction.bind(null, ticketId, ticketNumber),
    [ticketId, ticketNumber],
  );
  const [state, formAction] = useActionState(
    boundAction,
    EMPTY_SUPPORT_ACTION_STATE,
  );

  const otherPriorities = TICKET_PRIORITIES.filter(
    (priority) => priority !== currentPriority,
  );

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Priority</h3>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="priority" className="text-sm">
            New priority
          </label>
          <select
            id="priority"
            name="priority"
            defaultValue={otherPriorities[0]}
            className={selectClassName}
          >
            {otherPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {TICKET_PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </div>
        <ControlButton label="Update priority" pendingLabel="Updating…" />
      </form>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        For an active emergency, priority alone does not notify anyone in real
        time — follow TEACH emergency procedures.
      </p>
      {state.formError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {state.formError}
        </p>
      )}
    </div>
  );
}
