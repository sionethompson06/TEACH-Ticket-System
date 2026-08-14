import Link from "next/link";

// Rendered identically whether the ticket number doesn't exist, is
// malformed, or belongs to a department this signed-in agent has no
// membership for — never revealing which case applies.
export default function SupportTicketNotFound() {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-bold sm:text-3xl">
        We couldn&apos;t find that request
      </h1>
      <p className="max-w-md text-base leading-7 text-slate-600 dark:text-slate-400">
        This request may not exist, or you may not have access to it. If you
        think this is a mistake, contact your system administrator.
      </p>
      <Link
        href="/support"
        className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
      >
        Back to Support Queue
      </Link>
    </div>
  );
}
