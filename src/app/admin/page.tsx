import Link from "next/link";
import { FriendlyState } from "@/components/friendly-state";
import { requireActiveActor } from "@/auth/current-actor";
import { authorize } from "@/authz/policy";
import { getDb } from "@/db/client";
import { listOrganizationUsers } from "@/admin/admin-queries";
import { AdminActionButton } from "./admin-action-button";
import {
  setDepartmentMembershipAction,
  setSystemAdministratorAction,
  setUserActiveAction,
} from "./actions";

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function AccessBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
      {children}
    </span>
  );
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const actor = await requireActiveActor("/admin");

  // The same "administer" action every other administrative decision in
  // this app already uses (src/authz/policy.ts) — a department agent and
  // an ordinary requester alike are denied here, identically, even if
  // they type the URL directly. No user list is fetched before this
  // check passes.
  if (!authorize(actor, { kind: "administer" })) {
    return (
      <FriendlyState
        title="Administration access"
        message="You don't have access to this page. If you believe this is a mistake, contact your system administrator."
        actions={[{ label: "Back to My Requests", href: "/requests" }]}
      />
    );
  }

  const resolvedSearchParams = await searchParams;
  const search = firstValue(resolvedSearchParams.search);
  const { users, truncated } = await listOrganizationUsers(
    getDb(),
    actor,
    search,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">People and Access</h1>
        <p className="mt-1 max-w-2xl text-base text-slate-600 dark:text-slate-400">
          Manage who can sign in, who has IT or Facilities agent access, and who
          has system-administrator access.
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="search" className="text-sm font-semibold">
            Search by name or email
          </label>
          <input
            id="search"
            name="search"
            type="text"
            defaultValue={search ?? ""}
            placeholder="e.g. Jamie or jamie@teachps.org"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Search
        </button>
        {search && (
          <Link
            href="/admin"
            className="text-sm font-medium text-slate-700 hover:underline dark:text-slate-300"
          >
            Clear search
          </Link>
        )}
      </form>

      {truncated && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Showing the first 200 matching staff. Use search to narrow the list.
        </p>
      )}

      {users.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-6 py-10 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-base text-slate-700 dark:text-slate-300">
            {search
              ? "No staff match this search."
              : "No staff have signed in yet. Staff will appear here after they sign in successfully with their TEACH Google Workspace account."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4" aria-label="Staff accounts">
          {users.map((staffMember) => {
            const isSelf = staffMember.id === actor.userId;
            const hasIt = staffMember.departmentCodes.includes("IT");
            const hasFacilities =
              staffMember.departmentCodes.includes("FACILITIES");

            return (
              <li
                key={staffMember.id}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold">{staffMember.name}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {staffMember.email}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <AccessBadge>
                    {staffMember.isActive ? "Active" : "Inactive"}
                  </AccessBadge>
                  <AccessBadge>Requester</AccessBadge>
                  <AccessBadge>
                    {hasIt ? "IT agent" : "No IT access"}
                  </AccessBadge>
                  <AccessBadge>
                    {hasFacilities
                      ? "Facilities agent"
                      : "No Facilities access"}
                  </AccessBadge>
                  <AccessBadge>
                    {staffMember.isSystemAdministrator
                      ? "System administrator"
                      : "Not an administrator"}
                  </AccessBadge>
                </div>

                <div className="mt-3 flex flex-wrap items-start gap-3">
                  <AdminActionButton
                    action={setDepartmentMembershipAction.bind(
                      null,
                      staffMember.id,
                      "IT",
                      !hasIt,
                    )}
                    label={hasIt ? "Remove IT Access" : "Add IT Access"}
                    pendingLabel={hasIt ? "Removing…" : "Adding…"}
                  />
                  <AdminActionButton
                    action={setDepartmentMembershipAction.bind(
                      null,
                      staffMember.id,
                      "FACILITIES",
                      !hasFacilities,
                    )}
                    label={
                      hasFacilities
                        ? "Remove Facilities Access"
                        : "Add Facilities Access"
                    }
                    pendingLabel={hasFacilities ? "Removing…" : "Adding…"}
                  />

                  {isSelf ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      You cannot deactivate your own account.
                    </p>
                  ) : (
                    <AdminActionButton
                      action={setUserActiveAction.bind(
                        null,
                        staffMember.id,
                        !staffMember.isActive,
                      )}
                      label={
                        staffMember.isActive
                          ? "Deactivate User"
                          : "Activate User"
                      }
                      pendingLabel={
                        staffMember.isActive ? "Deactivating…" : "Activating…"
                      }
                      confirmMessage={
                        staffMember.isActive
                          ? `Deactivate ${staffMember.name}? They will immediately lose access.`
                          : undefined
                      }
                    />
                  )}

                  {isSelf ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      You cannot remove your own administrator access.
                    </p>
                  ) : (
                    <AdminActionButton
                      action={setSystemAdministratorAction.bind(
                        null,
                        staffMember.id,
                        !staffMember.isSystemAdministrator,
                      )}
                      label={
                        staffMember.isSystemAdministrator
                          ? "Remove Admin Access"
                          : "Grant Admin Access"
                      }
                      pendingLabel={
                        staffMember.isSystemAdministrator
                          ? "Removing…"
                          : "Granting…"
                      }
                      confirmMessage={
                        staffMember.isSystemAdministrator
                          ? `Remove system-administrator access from ${staffMember.name}?`
                          : `Grant system-administrator access to ${staffMember.name}? They will be able to manage all staff access.`
                      }
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
