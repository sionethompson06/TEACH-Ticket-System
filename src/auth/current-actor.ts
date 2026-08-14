import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveActor } from "../authz/resolve-actor";
import type { ResolvedActor } from "../authz/policy";
import { getDb } from "../db/client";
import { getAuth } from "./auth";
import { isAuthConfigured } from "./env";

export type ActiveActor = Extract<ResolvedActor, { status: "active" }>;

// Resolves the current requester's actor strictly from a validated Better
// Auth session and fresh database state — never from anything the client
// supplied. Missing authentication configuration fails closed (treated
// identically to no session at all), matching the fail-safe pattern
// already used by /account.
export async function getCurrentActor(): Promise<ResolvedActor> {
  if (!isAuthConfigured()) {
    return { status: "anonymous" };
  }

  const sessionData = await getAuth().api.getSession({
    headers: await headers(),
  });

  return resolveActor(getDb(), sessionData?.user.id ?? null);
}

// For use at the top of every protected requester page: returns the
// active actor, or redirects to /sign-in (carrying the current page as a
// validated same-origin callback destination) for anonymous, missing, or
// inactive users alike — the same generic outcome regardless of which
// case applies, so no requester route ever reveals why access was denied.
export async function requireActiveActor(
  callbackPath: string,
): Promise<ActiveActor> {
  const actor = await getCurrentActor();
  if (actor.status !== "active") {
    redirect(`/sign-in?callbackURL=${encodeURIComponent(callbackPath)}`);
  }
  return actor;
}
