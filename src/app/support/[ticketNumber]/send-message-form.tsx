"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";
import { useFormStatus } from "react-dom";
import { EMPTY_SEND_MESSAGE_STATE, sendSupportMessageAction } from "./actions";

// A near-duplicate of the requester-side SendMessageForm
// (src/app/requests/[ticketNumber]/send-message-form.tsx), bound to the
// support-side action instead — both ultimately call the same
// addTicketComment service function and behave identically from the
// agent's point of view.
export function SendMessageForm({
  ticketId,
  ticketNumber,
}: {
  ticketId: string;
  ticketNumber: string;
}) {
  const boundAction = useMemo(
    () => sendSupportMessageAction.bind(null, ticketId, ticketNumber),
    [ticketId, ticketNumber],
  );
  const [state, formAction] = useActionState(
    boundAction,
    EMPTY_SEND_MESSAGE_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-800"
    >
      <label htmlFor="support-body" className="text-sm font-semibold">
        Message
      </label>
      <textarea
        id="support-body"
        name="body"
        defaultValue={state.body}
        required
        maxLength={4000}
        rows={4}
        aria-describedby={state.formError ? "support-body-error" : undefined}
        aria-invalid={Boolean(state.formError)}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        placeholder="Reply to the requester"
      />
      {state.formError && (
        <p
          id="support-body-error"
          role="alert"
          className="text-sm text-red-700 dark:text-red-400"
        >
          {state.formError}
        </p>
      )}
      <SendButton />
    </form>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-fit items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
    >
      {pending ? "Sending…" : "Send Message"}
    </button>
  );
}
