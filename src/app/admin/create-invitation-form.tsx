"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createInvitationAction, type AdminMutationState } from "./actions";

const EMPTY_STATE: AdminMutationState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
    >
      {pending ? "Sending…" : "Send Invitation"}
    </button>
  );
}

export function CreateInvitationForm() {
  const [state, formAction] = useActionState(
    createInvitationAction,
    EMPTY_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="invite-email" className="text-sm font-semibold">
            Email address
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="e.g. person@example.com"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <SubmitButton />
      </div>
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
    </form>
  );
}
