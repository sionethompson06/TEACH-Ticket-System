import Link from "next/link";
import { StatusIndicator } from "@/components/StatusIndicator";
import { isAuthConfigured } from "@/auth/env";

export default function Home() {
  const configured = isAuthConfigured();

  return (
    <div className="flex flex-1 flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 px-6 py-6 dark:border-slate-800 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          TEACH Public Schools
        </p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
          TEACH Ticket System
        </h1>
      </header>

      <main className="flex flex-1 flex-col gap-8 px-6 py-10 sm:px-10">
        <section
          aria-labelledby="status-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="status-heading" className="text-lg font-semibold">
            Application status
          </h2>
          <StatusIndicator label="Operational" />
          <p className="max-w-2xl text-base leading-7 text-slate-700 dark:text-slate-300">
            Sign in, request help, and track your requests are now available.
          </p>
        </section>

        <section
          aria-labelledby="about-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="about-heading" className="text-lg font-semibold">
            About this system
          </h2>
          <p className="max-w-2xl text-base leading-7 text-slate-700 dark:text-slate-300">
            The TEACH Ticket System is a secure, system-wide service-request
            platform for TEACH Public Schools staff, covering{" "}
            <strong>Information Technology</strong> and{" "}
            <strong>Facilities</strong> requests. Staff sign in with a verified{" "}
            <strong>@teachps.org</strong> Google Workspace account, submit a
            request, and follow the conversation with the support team until
            it&apos;s resolved.
          </p>
        </section>

        <section
          aria-labelledby="availability-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="availability-heading" className="text-lg font-semibold">
            Availability
          </h2>
          <p className="max-w-2xl text-base leading-7 text-slate-700 dark:text-slate-300">
            After signing in, use <strong>Request Help</strong> to submit a
            request and <strong>My Requests</strong> to see its status and send
            messages to the support team. IT and Facilities staff see an
            additional Support Queue, and system administrators see People and
            Access.
          </p>
          {configured ? (
            <Link
              href="/sign-in"
              className="inline-flex w-fit items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Sign in with Google
            </Link>
          ) : (
            <p className="max-w-2xl rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Authentication configuration pending. Sign-in is not available
              yet.
            </p>
          )}
        </section>
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
