"use client";

import { useState } from "react";
import { authClient } from "@/auth/auth-client";

export function GoogleSignInButton({ callbackPath }: { callbackPath: string }) {
  const [isPending, setIsPending] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setIsPending(true);
          setFailed(false);
          authClient.signIn.social(
            {
              provider: "google",
              callbackURL: callbackPath,
              errorCallbackURL: "/sign-in?error=1",
            },
            {
              onError: () => {
                setIsPending(false);
                setFailed(true);
              },
            },
          );
        }}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
      >
        {isPending ? "Connecting to Google…" : "Continue with Google"}
      </button>
      {failed && (
        <p role="alert" className="text-sm text-red-800 dark:text-red-300">
          We couldn&apos;t start sign-in. Please try again. If the problem
          continues, contact your system administrator.
        </p>
      )}
    </div>
  );
}
