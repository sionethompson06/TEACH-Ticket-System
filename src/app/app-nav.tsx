import Link from "next/link";
import { authorize, isSupportStaff } from "@/authz/policy";
import { getCurrentActor } from "@/auth/current-actor";
import { SignOutButton } from "@/app/account/sign-out-button";

// Small, uncluttered nav shared by every authenticated page (the
// requester experience, the Phase 7 support workspace, and the Phase 8
// administration page). Support Queue and Administration only appear for
// the roles that can use them — visible only for usability, since every
// /support and /admin route independently re-checks authorization
// server-side regardless of what this nav shows.
export async function AppNav() {
  const actor = await getCurrentActor();
  const showSupportQueue = isSupportStaff(actor);
  const showAdministration = authorize(actor, { kind: "administer" });

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
          {showSupportQueue && (
            <Link
              href="/support"
              className="text-sm font-medium text-slate-700 hover:underline dark:text-slate-300"
            >
              Support Queue
            </Link>
          )}
          {showAdministration && (
            <Link
              href="/admin"
              className="text-sm font-medium text-slate-700 hover:underline dark:text-slate-300"
            >
              Administration
            </Link>
          )}
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
