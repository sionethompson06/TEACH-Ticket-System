import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "../db/schema";

type Database = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

// Approximately five submissions per fingerprint per rolling hour, per the
// product requirement. A fixed (not sliding) one-hour window: simpler to
// make atomic and concurrency-safe than a sliding window, at the cost of a
// submitter being able to send a short burst around a window boundary —
// an acceptable trade-off for an abuse deterrent, not a hard security
// control.
export const RATE_LIMIT_MAX_PER_WINDOW = 5;

// Used only when no usable client-IP header is present at all. Every such
// request shares this single fingerprint bucket, so the *absence* of a
// trusted header degrades toward more restrictive shared rate limiting,
// never toward unlimited submissions.
const FALLBACK_IP_BUCKET = "unknown-client";

// Vercel's edge network appends the actual connecting peer's IP as the
// LAST entry of `x-forwarded-for` (each hop appends to the end of the
// list); any earlier entries could have been set by the client itself and
// are not trusted. `x-real-ip` (also set by Vercel) is used as a secondary
// fallback. See docs/DEPLOYMENT.md's "Public Ticket Intake" section for
// why this specific header/position was chosen.
export function resolveClientIpForFingerprint(
  headerList: Pick<Headers, "get">,
): string {
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    const parts = forwardedFor
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }

  const realIp = headerList.get("x-real-ip");
  if (realIp && realIp.trim().length > 0) {
    return realIp.trim();
  }

  return FALLBACK_IP_BUCKET;
}

// A pseudonymous, non-reversible-without-the-secret fingerprint — never
// the raw IP itself is stored anywhere. HMAC (not a plain hash) so the
// fingerprint can't be recomputed or correlated by anyone without
// PUBLIC_INTAKE_RATE_LIMIT_SECRET, including from a leaked rate-limit
// table.
export function computeRateLimitFingerprint(
  secret: string,
  clientIp: string,
): string {
  return createHmac("sha256", secret).update(clientIp).digest("hex");
}

export interface RateLimitCheckResult {
  allowed: boolean;
}

// Single atomic INSERT ... ON CONFLICT DO UPDATE: Postgres takes a
// row-level lock on the conflicting row before evaluating the SET clause,
// so concurrent calls for the same fingerprint (across any number of
// Vercel Function instances) serialize correctly instead of racing a
// separate select-then-update. A submission in a new hour resets the
// counter; one in the current hour increments it. Fails closed: any error
// reading/writing the durable store denies the submission rather than
// allowing it through.
export async function checkAndRecordRateLimit(
  db: Database,
  fingerprint: string,
): Promise<RateLimitCheckResult> {
  try {
    const result = await db.execute<{ count: number }>(sql`
      INSERT INTO public_intake_rate_limits (fingerprint, window_start, count, updated_at)
      VALUES (${fingerprint}, date_trunc('hour', now()), 1, now())
      ON CONFLICT (fingerprint) DO UPDATE SET
        count = CASE
          WHEN public_intake_rate_limits.window_start = date_trunc('hour', now())
          THEN public_intake_rate_limits.count + 1
          ELSE 1
        END,
        window_start = date_trunc('hour', now()),
        updated_at = now()
      RETURNING count
    `);
    const count = result.rows[0]?.count;
    if (typeof count !== "number") {
      return { allowed: false };
    }
    return { allowed: count <= RATE_LIMIT_MAX_PER_WINDOW };
  } catch {
    // Fail closed: if the durable rate-limit check cannot run at all, the
    // submission is denied rather than silently let through.
    return { allowed: false };
  }
}
