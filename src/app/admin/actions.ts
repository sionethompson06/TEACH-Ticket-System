"use server";

import { revalidatePath } from "next/cache";
import { requireActiveActor } from "@/auth/current-actor";
import { getDb } from "@/db/client";
import {
  setDepartmentMembership,
  setSystemAdministrator,
  setUserActive,
} from "@/admin/admin-service";
import { createInvitation, revokeInvitation } from "@/admin/invitations";
import { AdminValidationError } from "@/admin/errors";

// A "use server" file may only export async functions — the initial
// empty-state value lives in admin-action-button.tsx (its only consumer)
// instead of being exported from here.
export interface AdminMutationState {
  status: "idle" | "success" | "error";
  message?: string;
}

function friendlyError(error: unknown, fallback: string): string {
  return error instanceof AdminValidationError ? error.message : fallback;
}

// A membership, activation, or administrator change can affect what the
// support workspace and requester pages show (e.g. a newly deactivated
// agent's ticket-management access), so all three are revalidated on
// every successful mutation, alongside /admin itself.
function revalidateAdminPaths(): void {
  revalidatePath("/admin");
  revalidatePath("/support");
  revalidatePath("/requests");
}

// Every argument bound ahead of (previousState, formData) comes from the
// server-rendered admin page's own data, never from the browser — the
// service layer re-validates all of it regardless.
export async function setDepartmentMembershipAction(
  targetUserId: string,
  departmentCode: string,
  shouldHaveMembership: boolean,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's (state, payload) action signature
  _previousState: AdminMutationState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's (state, payload) action signature
  _formData: FormData,
): Promise<AdminMutationState> {
  const actor = await requireActiveActor("/admin");

  try {
    await setDepartmentMembership(
      getDb(),
      actor,
      targetUserId,
      departmentCode,
      shouldHaveMembership,
    );
  } catch (error) {
    return {
      status: "error",
      message: friendlyError(error, "We couldn't update department access."),
    };
  }

  revalidateAdminPaths();
  return {
    status: "success",
    message: shouldHaveMembership ? "Access added." : "Access removed.",
  };
}

export async function setUserActiveAction(
  targetUserId: string,
  isActive: boolean,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's (state, payload) action signature
  _previousState: AdminMutationState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's (state, payload) action signature
  _formData: FormData,
): Promise<AdminMutationState> {
  const actor = await requireActiveActor("/admin");

  try {
    await setUserActive(getDb(), actor, targetUserId, isActive);
  } catch (error) {
    return {
      status: "error",
      message: friendlyError(error, "We couldn't update this user's status."),
    };
  }

  revalidateAdminPaths();
  return {
    status: "success",
    message: isActive ? "User activated." : "User deactivated.",
  };
}

export async function setSystemAdministratorAction(
  targetUserId: string,
  isSystemAdministrator: boolean,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's (state, payload) action signature
  _previousState: AdminMutationState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's (state, payload) action signature
  _formData: FormData,
): Promise<AdminMutationState> {
  const actor = await requireActiveActor("/admin");

  try {
    await setSystemAdministrator(
      getDb(),
      actor,
      targetUserId,
      isSystemAdministrator,
    );
  } catch (error) {
    return {
      status: "error",
      message: friendlyError(error, "We couldn't update administrator access."),
    };
  }

  revalidateAdminPaths();
  return {
    status: "success",
    message: isSystemAdministrator
      ? "Administrator access granted."
      : "Administrator access removed.",
  };
}

// Unbound — the email comes directly from the form field the administrator
// typed into, unlike every other action above (which only ever act on a
// server-rendered target id). createInvitation still re-validates and
// normalizes the value itself; nothing here is trusted as-is.
export async function createInvitationAction(
  _previousState: AdminMutationState,
  formData: FormData,
): Promise<AdminMutationState> {
  const actor = await requireActiveActor("/admin");
  const email = String(formData.get("email") ?? "");

  try {
    await createInvitation(getDb(), actor, email);
  } catch (error) {
    return {
      status: "error",
      message: friendlyError(error, "We couldn't create that invitation."),
    };
  }

  revalidateAdminPaths();
  return {
    status: "success",
    message: "Invitation created. Tell them to visit the sign-in page.",
  };
}

export async function revokeInvitationAction(
  invitationId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's (state, payload) action signature
  _previousState: AdminMutationState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by useActionState's (state, payload) action signature
  _formData: FormData,
): Promise<AdminMutationState> {
  const actor = await requireActiveActor("/admin");

  try {
    await revokeInvitation(getDb(), actor, invitationId);
  } catch (error) {
    return {
      status: "error",
      message: friendlyError(error, "We couldn't revoke that invitation."),
    };
  }

  revalidateAdminPaths();
  return { status: "success", message: "Invitation revoked." };
}
