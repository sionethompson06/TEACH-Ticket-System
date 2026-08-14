import { requireActiveActor } from "@/auth/current-actor";
import { getDb } from "@/db/client";
import { loadTicketFormOptions } from "@/tickets/ticket-queries";
import { RequestForm } from "./request-form";

export default async function RequestHelpPage() {
  const actor = await requireActiveActor("/requests/new");
  const options = await loadTicketFormOptions(getDb(), actor.organizationId);

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
