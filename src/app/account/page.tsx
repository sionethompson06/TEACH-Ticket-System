import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/auth/auth";
import { isAuthConfigured } from "@/auth/env";
import { SignOutButton } from "./sign-out-button";

export default async function AccountPage() {
  // Fail safe: with no auth configuration there can be no valid session,
  // so redirect straight to /sign-in (which itself renders a clear
  // "configuration pending" state) instead of throwing.
  if (!isAuthConfigured()) {
    redirect("/sign-in");
  }

  const sessionData = await getAuth().api.getSession({
    headers: await headers(),
  });

  if (!sessionData) {
    redirect("/sign-in");
  }

  const { user } = sessionData;

  return (
    <div className="flex flex-1 flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 px-6 py-6 dark:border-slate-800 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          TEACH Public Schools
        </p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Account</h1>
      </header>

      <main className="flex flex-1 flex-col gap-6 px-6 py-10 sm:px-10">
        <dl className="grid max-w-md grid-cols-1 gap-4 sm:grid-cols-[auto_1fr] sm:gap-x-6">
          <dt className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Name
          </dt>
          <dd className="text-base text-slate-900 dark:text-slate-100">
            {user.name}
          </dd>

          <dt className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Email
          </dt>
          <dd className="text-base text-slate-900 dark:text-slate-100">
            {user.email}
          </dd>

          <dt className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Role
          </dt>
          <dd className="text-base text-slate-900 dark:text-slate-100">
            Requester
          </dd>
        </dl>

        <SignOutButton />
      </main>
    </div>
  );
}
