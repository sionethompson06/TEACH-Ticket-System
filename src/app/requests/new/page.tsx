import { getCurrentActor, requireActiveActor } from "@/auth/current-actor";
import { getDb } from "@/db/client";
import { REFERENCE_ORGANIZATION } from "@/db/reference-data";
import { isPublicTicketIntakeEnabled } from "@/public-intake/env";
import { loadTicketFormOptions } from "@/tickets/ticket-queries";
import { PublicRequestForm } from "./public-request-form";
import { RequestForm } from "./request-form";

async function renderAuthenticatedForm(organizationId: string) {
  const options = await loadTicketFormOptions(getDb(), organizationId);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Request Help</h1>
        <p className="mt-1 max-w-2xl text-base text-slate-600 dark:text-slate-400">
          Tell us what&apos;s going on and we&apos;ll route it to the right
          team.
        </p>
      </div>

      <RequestForm
        departments={options.departments}
        categories={options.categories}
        serviceLocations={options.serviceLocations}
      />
    </div>
  );
}

export default async function RequestHelpPage() {
  // Public ticket intake only ever adds a fallback for a visitor who is
  // not (or cannot yet be) signed in — an active, authenticated actor
  // always sees the exact same form and page as when the flag is off.
  if (isPublicTicketIntakeEnabled()) {
    const actor = await getCurrentActor();
    if (actor.status === "active") {
      return renderAuthenticatedForm(actor.organizationId);
    }

    const options = await loadTicketFormOptions(
      getDb(),
      REFERENCE_ORGANIZATION.id,
    );
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Submit a Request</h1>
          <p className="mt-1 max-w-2xl text-base text-slate-600 dark:text-slate-400">
            Sign-in is temporarily not required while TEACH finishes setting up
            staff accounts. Tell us what&apos;s going on and our support team
            will follow up by email.
          </p>
        </div>

        <PublicRequestForm
          departments={options.departments}
          categories={options.categories}
          serviceLocations={options.serviceLocations}
        />
      </div>
    );
  }

  // Unchanged from before public ticket intake existed: an active,
  // authenticated actor is required, or this redirects to /sign-in.
  const actor = await requireActiveActor("/requests/new");
  return renderAuthenticatedForm(actor.organizationId);
}
