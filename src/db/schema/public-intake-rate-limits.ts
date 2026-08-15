import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Phase 9B: a durable, concurrency-safe fixed-window submission counter for
// the temporary public (unauthenticated) ticket-intake path. Keyed by a
// pseudonymous HMAC fingerprint (see src/public-intake/rate-limit.ts) —
// never a raw IP address or any other directly identifying value. This
// table must remain usable from any number of concurrent Vercel Function
// instances, so every read-and-increment happens in a single atomic
// upsert statement rather than a separate select-then-update.
export const publicIntakeRateLimits = pgTable(
  "public_intake_rate_limits",
  {
    // The HMAC-SHA256 hex digest of a resolved client IP, keyed by
    // PUBLIC_INTAKE_RATE_LIMIT_SECRET — not reversible to the original IP
    // without that secret.
    fingerprint: text("fingerprint").primaryKey(),
    // The start of the current fixed one-hour counting window (truncated
    // to the hour). A submission in a new hour resets the counter rather
    // than accumulating across windows.
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "public_intake_rate_limits_count_not_negative_check",
      sql`${table.count} >= 0`,
    ),
  ],
);
