import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "../db/schema";
import { departmentMemberships, departments, user } from "../db/schema";
import type { ResolvedActor } from "./policy";

type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

// Builds a ResolvedActor strictly from a validated session's user id and
// live database state. There is no parameter for a role, membership, or
// organization claim — a caller (or a compromised client) has no channel
// through which to smuggle a forged value in; every field returned here
// comes from a fresh query.
export async function resolveActor(
  db: Database,
  sessionUserId: string | null,
): Promise<ResolvedActor> {
  if (!sessionUserId) {
    return { status: "anonymous" };
  }

  const [dbUser] = await db
    .select()
    .from(user)
    .where(eq(user.id, sessionUserId));

  if (!dbUser) {
    return { status: "user_not_found" };
  }

  if (!dbUser.isActive) {
    return { status: "inactive" };
  }

  const memberships = await db
    .select({ code: departments.code })
    .from(departmentMemberships)
    .innerJoin(
      departments,
      eq(departmentMemberships.departmentId, departments.id),
    )
    .where(eq(departmentMemberships.userId, dbUser.id));

  return {
    status: "active",
    userId: dbUser.id,
    organizationId: dbUser.organizationId,
    isSystemAdministrator: dbUser.isSystemAdministrator,
    departmentCodes: memberships.map((membership) => membership.code),
  };
}
