"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { type AdminMutationState } from "./actions";
const EMPTY_ADMIN_MUTATION_STATE: AdminMutationState = { status: "idle" };

function SubmitButton({
  label,
  pendingLabel,
  confirmMessage,
}: {
  label: string;
  pendingLabel: string;
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={
        confirmMessage
          ? (event) => {
              if (!window.confirm(confirmMessage)) {
                event.preventDefault();
              }
            }
          : undefined
      }
      className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

// One reusable button for every admin mutation (add/remove department
// access, activate/deactivate, grant/remove administrator access) — each
// call site passes its own already-bound Server Action (prebound with the
// target user id and, where relevant, the department code and desired
// value via .bind()), so this component itself never needs to know which
// mutation it is triggering.
export function AdminActionButton({
  action,
  label,
  pendingLabel,
  confirmMessage,
}: {
  action: (
    state: AdminMutationState,
    formData: FormData,
  ) => Promise<AdminMutationState>;
  label: string;
  pendingLabel: string;
  confirmMessage?: string;
}) {
  const [state, formAction] = useActionState(
    action,
    EMPTY_ADMIN_MUTATION_STATE,
  );

  return (
    <div className="flex flex-col gap-1">
      <form action={formAction}>
        <SubmitButton
          label={label}
          pendingLabel={pendingLabel}
          confirmMessage={confirmMessage}
        />
      </form>
      {state.status === "success" && state.message && (
        <p role="status" className="text-xs text-green-700 dark:text-green-400">
          {state.message}
        </p>
      )}
      {state.status === "error" && state.message && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {state.message}
        </p>
      )}
    </div>
  );
}
