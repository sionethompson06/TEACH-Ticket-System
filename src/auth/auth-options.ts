import type { BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { verifyGoogleIdToken } from "better-auth/social-providers";
import { REFERENCE_ORGANIZATION } from "../db/reference-data";
import { account, session, user, verification } from "../db/schema";
import type { AuthAccessMode } from "./access-mode";
import {
  evaluateGoogleInviteOnlyIdentity,
  evaluateGoogleWorkspaceIdentity,
} from "./google-identity-policy";
import {
  acceptPendingInvitation,
  findPendingInvitation,
  type Database as InvitationDatabase,
} from "./invitations";

export const TEACH_WORKSPACE_HOSTED_DOMAIN = "teachps.org";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours
export const SESSION_UPDATE_AGE_SECONDS = 60 * 60; // 1 hour
export const REQUESTER_BASE_ROLE = "requester";

export interface BuildBetterAuthOptionsParams {
  // Loosely typed on purpose: this is a pure config builder exercised by
  // unit tests with a dependency-injected fake, so it must not require a
  // real Drizzle/pg database handle to construct or type-check.
  db: Parameters<typeof drizzleAdapter>[0];
  googleClientId: string;
  googleClientSecret: string;
  baseUrl: string;
  secret: string;
  accessMode: AuthAccessMode;
}

// Pure function: given already-resolved dependencies, returns the plain
// Better Auth options object. No environment reads, no singletons, no I/O
// beyond what the caller's `db` handle performs — safe to call repeatedly
// in tests with fake credentials and a fake db.
export function buildBetterAuthOptions({
  db,
  googleClientId,
  googleClientSecret,
  baseUrl,
  secret,
  accessMode,
}: BuildBetterAuthOptionsParams): BetterAuthOptions {
  return {
    baseURL: baseUrl,
    secret,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    advanced: {
      database: {
        generateId: "uuid",
      },
    },
    emailAndPassword: {
      enabled: false,
    },
    account: {
      accountLinking: {
        enabled: false,
      },
    },
    session: {
      expiresIn: SESSION_MAX_AGE_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
    },
    user: {
      additionalFields: {
        organizationId: {
          type: "string",
          required: true,
          input: false,
          defaultValue: REFERENCE_ORGANIZATION.id,
        },
        baseRole: {
          type: "string",
          required: true,
          input: false,
          defaultValue: REQUESTER_BASE_ROLE,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          // Belt-and-suspenders alongside the additionalFields defaults
          // above and the SQL CHECK constraints in the schema: every new
          // user is atomically pinned to the canonical TEACH organization
          // and the nonprivileged Requester role, regardless of anything
          // an OAuth profile or request body could otherwise supply.
          //
          // In invite_only mode, this is also the only point where a
          // first-time sign-in can be denied provisioning entirely:
          // returning `false` here aborts user creation (Better Auth's own
          // create-with-hooks contract), so a noninvited Google account
          // never receives a user row, an account link, or a session —
          // Better Auth surfaces this as a generic "unable to create user"
          // OAuth error, routed to the same friendly sign-in denial state
          // as any other failed sign-in attempt.
          before: async (userRecord) => {
            if (accessMode.kind === "invite_only") {
              const email = String(userRecord.email ?? "").toLowerCase();
              const invitation = await findPendingInvitation(
                db as InvitationDatabase,
                REFERENCE_ORGANIZATION.id,
                email,
              );
              if (!invitation) {
                return false;
              }
            }

            return {
              data: {
                ...userRecord,
                organizationId: REFERENCE_ORGANIZATION.id,
                baseRole: REQUESTER_BASE_ROLE,
              },
            };
          },
          // Marks the invitation this new user was just provisioned under
          // as accepted. Safe under retry: acceptPendingInvitation only
          // ever matches a still-pending row, so a duplicate call (or a
          // call racing a concurrent one) is a harmless no-op.
          after: async (createdUser) => {
            if (accessMode.kind === "invite_only") {
              await acceptPendingInvitation(db as InvitationDatabase, {
                organizationId: REFERENCE_ORGANIZATION.id,
                email: createdUser.email.toLowerCase(),
                acceptedByUserId: createdUser.id,
              });
            }
          },
        },
      },
      account: {
        create: {
          before: async (accountRecord) => {
            return { data: stripProviderCredentials(accountRecord) };
          },
        },
        update: {
          before: async (accountRecord) => {
            return { data: stripProviderCredentials(accountRecord) };
          },
        },
      },
    },
    socialProviders: {
      google: {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        // Sent as the authorization-request hint AND enforced by Better
        // Auth against the verified callback profile — defense in depth
        // alongside the custom getUserInfo check below. Only sent at all
        // in workspace mode: invite-only mode must never hint a hosted
        // domain to Google, since an invited address may belong to any
        // domain (or none, for a personal Gmail account).
        ...(accessMode.kind === "workspace"
          ? { hd: accessMode.allowedDomain }
          : {}),
        prompt: "select_account",
        // Explicit, self-documenting minimal OIDC scope — independent of
        // whatever the library's own default scope list happens to be.
        // Identical in both access modes: invite-only pilot access is
        // still never a reason to request Gmail, Drive, Calendar, or
        // offline-access scopes.
        disableDefaultScope: true,
        scope: ["openid", "email", "profile"],
        // Only the standard server-side authorization-code flow is
        // supported; a browser can never sign in by posting an ID token
        // directly to this server.
        disableIdTokenSignIn: true,
        async getUserInfo(token) {
          if (!token.idToken) {
            return null;
          }

          // Full signature/issuer/audience/expiry verification via Better
          // Auth's own Google provider utility — never a bare JWT decode.
          const claims = await verifyGoogleIdToken({
            token: token.idToken,
            audience: googleClientId,
          });
          if (!claims) {
            return null;
          }

          const profile = {
            sub: claims.sub,
            email: claims.email,
            email_verified: claims.email_verified,
            hd: claims.hd,
          };
          const decision =
            accessMode.kind === "workspace"
              ? evaluateGoogleWorkspaceIdentity(
                  profile,
                  accessMode.allowedDomain,
                )
              : evaluateGoogleInviteOnlyIdentity(profile);
          if (!decision.allowed) {
            return null;
          }

          return {
            user: {
              id: decision.sub,
              name:
                typeof claims.name === "string" ? claims.name : decision.email,
              email: decision.email,
              image:
                typeof claims.picture === "string" ? claims.picture : undefined,
              emailVerified: true,
            },
            data: claims,
          };
        },
      },
    },
  };
}

function stripProviderCredentials<T extends Record<string, unknown>>(
  record: T,
): T {
  return {
    ...record,
    accessToken: null,
    refreshToken: null,
    idToken: null,
    password: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
  };
}
