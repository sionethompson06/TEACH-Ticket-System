import Link from "next/link";
import { SignOutButton } from "@/app/account/sign-out-button";

// Small, uncluttered nav shared by every requester page. No agent
// dashboard or administration links — this is the requester's whole
// navigation surface.
export function RequesterNav() {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800">
      <nav
        aria-label="Primary"
        className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 sm:px-10"
      >
        <Link href="/requests" className="text-base font-bold">
          TEACH Help Desk
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/requests/new"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Request Help
          </Link>
          <Link
            href="/requests"
            className="text-sm font-medium text-slate-700 hover:underline dark:text-slate-300"
          >
            My Requests
          </Link>
          <Link
            href="/account"
            className="text-sm font-medium text-slate-700 hover:underline dark:text-slate-300"
          >
            Account
          </Link>
          <SignOutButton />
        </div>
      </nav>
    </header>
  );
}
