import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { authorize, type ResolvedActor } from "../authz/policy";
import * as schema from "../db/schema";
import { departmentMemberships, departments, user } from "../db/schema";
import { AdminAuthorizationError, AdminValidationError } from "./errors";

// Server-only mutations for the Phase 8 "People and Access" page. Every
// exported function here re-checks authorization itself — it never trusts
// that a caller (a Server Action, a test) already verified anything —
// using the same `administer` action the rest of the app already defines
// in src/authz/policy.ts. No new authorization framework is introduced.

type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

type ActiveActor = Extract<ResolvedActor, { status: "active" }>;

// Fails closed for anonymous, missing, inactive, and active-but-not-administrator
// actors alike — the same generic outcome regardless of which case applies.
function assertAdministrator(
  actor: ResolvedActor,
): asserts actor is ActiveActor {
  if (actor.status !== "active" || !authorize(actor, { kind: "administer" })) {
    throw new AdminAuthorizationError();
  }
}

type UserRow = typeof user.$inferSelect;

// The target must exist and belong to the acting administrator's own
// (canonical) organization — never a user from another organization, and
// never a role/organization value read from anything the browser sent.
async function loadTargetUser(
  db: Database,
  actor: ActiveActor,
  targetUserId: string,
): Promise<UserRow> {
  const [row] = await db.select().from(user).where(eq(user.id, targetUserId));
  if (!row || row.organizationId !== actor.organizationId) {
    throw new AdminValidationError("That user could not be found.");
  }
  return row;
}

// Department membership means department-agent access — there is no
// separate roles/permissions table. The department itself is looked up by
// its code against live database reference data (never a client-supplied
// department id trusted directly), so only a real, active department in
// the actor's own organization can ever be targeted.
export async function setDepartmentMembership(
  db: Database,
  actor: ResolvedActor,
  targetUserId: string,
  departmentCode: string,
  shouldHaveMembership: boolean,
): Promise<void> {
  assertAdministrator(actor);
  const target = await loadTargetUser(db, actor, targetUserId);

  const [department] = await db
    .select()
    .from(departments)
    .where(
      and(
        eq(departments.organizationId, actor.organizationId),
        eq(departments.code, departmentCode),
        eq(departments.isActive, true),
      ),
    );
  if (!department) {
    throw new AdminValidationError("That department is not valid.");
  }

  if (shouldHaveMembership) {
    // Idempotent: onConflictDoNothing relies on the existing
    // department_memberships_user_department_unique constraint, so adding
    // a membership that already exists is a safe no-op, not an error.
    await db
      .insert(departmentMemberships)
      .values({
        userId: target.id,
        departmentId: department.id,
        organizationId: actor.organizationId,
      })
      .onConflictDoNothing();
  } else {
    // Safe no-op if the membership doesn't exist — DELETE simply affects
    // zero rows.
    await db
      .delete(departmentMemberships)
      .where(
        and(
          eq(departmentMemberships.userId, target.id),
          eq(departmentMemberships.departmentId, department.id),
        ),
      );
  }
}

// Deactivating never deletes the account, its tickets, or its comments —
// it only flips the same is_active flag resolveActor() already checks, so
// a deactivated user immediately fails every existing active-actor check
// (requester and support alike) on their very next request.
export async function setUserActive(
  db: Database,
  actor: ResolvedActor,
  targetUserId: string,
  isActive: boolean,
): Promise<void> {
  assertAdministrator(actor);
  if (targetUserId === actor.userId && !isActive) {
    throw new AdminValidationError("You cannot deactivate your own account.");
  }
  const target = await loadTargetUser(db, actor, targetUserId);

  await db
    .update(user)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(user.id, target.id));
}

// An administrator can never remove their own administrator access —
// there is always at least one active administrator left able to fix a
// mistake. Granting access to another active user is otherwise
// unrestricted; the separately approved first-administrator bootstrap
// remains outside this function's concern entirely.
export async function setSystemAdministrator(
  db: Database,
  actor: ResolvedActor,
  targetUserId: string,
  isSystemAdministrator: boolean,
): Promise<void> {
  assertAdministrator(actor);
  if (targetUserId === actor.userId && !isSystemAdministrator) {
    throw new AdminValidationError(
      "You cannot remove your own administrator access.",
    );
  }
  const target = await loadTargetUser(db, actor, targetUserId);

  await db
    .update(user)
    .set({ isSystemAdministrator, updatedAt: new Date() })
    .where(eq(user.id, target.id));
}
