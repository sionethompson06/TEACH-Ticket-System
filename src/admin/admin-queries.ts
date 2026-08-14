import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { authorize, type ResolvedActor } from "../authz/policy";
import * as schema from "../db/schema";
import { departmentMemberships, departments, user } from "../db/schema";
import { AdminAuthorizationError } from "./errors";

// Read-only query for the Phase 8 "People and Access" page. Like
// ticket-queries.ts and support-queries.ts, this module never
// reimplements authorization — it calls the same `administer` action the
// rest of the app already defines, and scopes every query to the actor's
// own organization directly in SQL.

type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

type ActiveActor = Extract<ResolvedActor, { status: "active" }>;

function assertAdministrator(
  actor: ResolvedActor,
): asserts actor is ActiveActor {
  if (actor.status !== "active" || !authorize(actor, { kind: "administer" })) {
    throw new AdminAuthorizationError();
  }
}

// A practical, non-configurable cap — this is a small-organization staff
// list, not a paginated directory.
const MAX_ADMIN_USERS = 200;

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  isSystemAdministrator: boolean;
  departmentCodes: string[];
}

export interface AdminUserListResult {
  users: AdminUserSummary[];
  truncated: boolean;
}

// Only display name, email, active status, administrator status, and
// department codes are ever selected here — no provider account id,
// Google subject, session data, token, or other authentication metadata
// exists in this query's column list at all, so none of it can leak into
// the page by accident.
export async function listOrganizationUsers(
  db: Database,
  actor: ResolvedActor,
  search?: string,
): Promise<AdminUserListResult> {
  assertAdministrator(actor);

  const trimmedSearch = search?.trim();
  const searchCondition = trimmedSearch
    ? or(
        ilike(user.name, `%${trimmedSearch}%`),
        ilike(user.email, `%${trimmedSearch}%`),
      )
    : undefined;
  const conditions = [
    eq(user.organizationId, actor.organizationId),
    ...(searchCondition ? [searchCondition] : []),
  ];

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      isActive: user.isActive,
      isSystemAdministrator: user.isSystemAdministrator,
    })
    .from(user)
    .where(and(...conditions))
    .orderBy(asc(user.name))
    .limit(MAX_ADMIN_USERS + 1);

  const truncated = rows.length > MAX_ADMIN_USERS;
  const limitedRows = truncated ? rows.slice(0, MAX_ADMIN_USERS) : rows;
  const userIds = limitedRows.map((row) => row.id);

  const membershipRows =
    userIds.length === 0
      ? []
      : await db
          .select({
            userId: departmentMemberships.userId,
            code: departments.code,
          })
          .from(departmentMemberships)
          .innerJoin(
            departments,
            eq(departmentMemberships.departmentId, departments.id),
          )
          .where(inArray(departmentMemberships.userId, userIds));

  const departmentCodesByUserId = new Map<string, string[]>();
  for (const row of membershipRows) {
    const codes = departmentCodesByUserId.get(row.userId) ?? [];
    codes.push(row.code);
    departmentCodesByUserId.set(row.userId, codes);
  }

  return {
    users: limitedRows.map((row) => ({
      ...row,
      departmentCodes: departmentCodesByUserId.get(row.id) ?? [],
    })),
    truncated,
  };
}
