import { betterAuth } from "better-auth";
import { getDb } from "../db/client";
import { buildBetterAuthOptions } from "./auth-options";
import {
  getAuthAccessMode,
  getBetterAuthBaseUrl,
  getBetterAuthSecret,
  getGoogleOAuthCredentials,
} from "./env";

type BetterAuthInstance = ReturnType<typeof betterAuth>;

let authInstance: BetterAuthInstance | undefined;

// Lazy on purpose, matching src/db/client.ts: importing this module must
// never require environment variables or open a database connection. The
// instance (and its underlying database pool) is only constructed the
// first time a caller actually needs it — inside a request handler, never
// at module-import time.
export function getAuth(): BetterAuthInstance {
  if (!authInstance) {
    const { clientId, clientSecret } = getGoogleOAuthCredentials();
    authInstance = betterAuth(
      buildBetterAuthOptions({
        db: getDb(),
        googleClientId: clientId,
        googleClientSecret: clientSecret,
        baseUrl: getBetterAuthBaseUrl(),
        secret: getBetterAuthSecret(),
        accessMode: getAuthAccessMode(),
      }),
    );
  }
  return authInstance;
}
