import Link from "next/link";
import { redirect } from "next/navigation";
import { isPublicTicketIntakeEnabled } from "@/public-intake/env";

// Matches formatTicketNumber()'s "TKT-000001" output exactly. Used only to
// decide whether to display the query parameter at all — this page never
// queries the database, so a ticket number here (real, guessed, or
// fabricated) can never be used to look anything up. It is not an
// authorization token of any kind.
const TICKET_NUMBER_PATTERN = /^TKT-\d{6}$/;

// The generic public confirmation page. Deliberately shows nothing beyond
// a ticket number: no requester name/email, no subject/description, no
// status, no way to look up or track the request further. A completed
// honeypot submission redirects here with no `ticket` parameter at all, so
// its response is indistinguishable from a real submission's from the
// outside.
export default async function PublicTicketSubmittedPage({
  searchParams,
}: PageProps<"/requests/new/submitted">) {
  if (!isPublicTicketIntakeEnabled()) {
    redirect("/");
  }

  const resolvedSearchParams = await searchParams;
  const rawTicket = resolvedSearchParams.ticket;
  const ticketNumber =
    typeof rawTicket === "string" && TICKET_NUMBER_PATTERN.test(rawTicket)
      ? rawTicket
      : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Request received</h1>
      <p className="max-w-2xl text-base leading-7 text-slate-700 dark:text-slate-300">
        Thanks — we&apos;ve received your request.
      </p>
      {ticketNumber && (
        <p className="max-w-2xl text-base leading-7 text-slate-700 dark:text-slate-300">
          Your request number is{" "}
          <strong className="font-mono">{ticketNumber}</strong>.
        </p>
      )}
      <p className="max-w-2xl text-base leading-7 text-slate-700 dark:text-slate-300">
        Our support team will contact you at the email address you provided.
        This page can&apos;t be used to check your request&apos;s status or view
        its details, and it can&apos;t be reopened here — please wait for that
        email.
      </p>
      <Link
        href="/requests/new"
        className="inline-flex w-fit items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
      >
        Submit another request
      </Link>
    </div>
  );
}
