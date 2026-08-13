import { isAuthConfigured } from "@/auth/env";
import { GoogleSignInButton } from "./google-sign-in-button";

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const resolvedSearchParams = await searchParams;
  const hasError = Boolean(resolvedSearchParams.error);
  const configured = isAuthConfigured();

  return (
    <div className="flex flex-1 flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 px-6 py-6 dark:border-slate-800 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          TEACH Public Schools
        </p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Sign in</h1>
      </header>

      <main className="flex flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
        <p className="max-w-md text-base leading-7 text-slate-700 dark:text-slate-300">
          Access is restricted to verified{" "}
          <strong>@teachps.org Google Workspace accounts</strong>. Personal
          Google accounts and other organizations&apos; accounts cannot sign in.
        </p>

        {hasError && (
          <p
            role="alert"
            className="max-w-md rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
          >
            Sign-in was not completed. Please try again with an authorized
            @teachps.org Google Workspace account.
          </p>
        )}

        {configured ? (
          <GoogleSignInButton />
        ) : (
          <p className="max-w-md rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            Authentication configuration pending. Sign-in is not available yet.
          </p>
        )}
      </main>

      <footer className="border-t border-slate-200 px-6 py-6 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:px-10">
        <p>
          Project documentation is maintained in this repository under{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] dark:bg-slate-900">
            docs/
          </code>
          .
        </p>
      </footer>
    </div>
  );
}
