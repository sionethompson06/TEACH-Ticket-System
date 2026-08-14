import { resolveAuthAccessMode, type AuthAccessMode } from "./access-mode";

export interface GoogleOAuthCredentials {
  clientId: string;
  clientSecret: string;
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(
      `${name} is not set. Configure it in your environment before using authentication.`,
    );
  }
  return value;
}

// Non-throwing check used by pages to decide whether to render the sign-in
// action or a safe "configuration pending" state — never logs or exposes
// any variable's value, only whether each required name is present. A
// missing, unknown, or incomplete AUTH_ACCESS_MODE fails this closed, the
// same as any other missing credential — never a silent permissive default.
export function isAuthConfigured(): boolean {
  return Boolean(
    readEnv("BETTER_AUTH_SECRET") &&
    readEnv("BETTER_AUTH_URL") &&
    readEnv("GOOGLE_CLIENT_ID") &&
    readEnv("GOOGLE_CLIENT_SECRET") &&
    readEnv("DATABASE_URL") &&
    resolveAuthAccessMode(process.env) !== null,
  );
}

export function getBetterAuthSecret(): string {
  return requireEnv("BETTER_AUTH_SECRET");
}

export function getBetterAuthBaseUrl(): string {
  return requireEnv("BETTER_AUTH_URL");
}

export function getGoogleOAuthCredentials(): GoogleOAuthCredentials {
  return {
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
  };
}

// Throws if AUTH_ACCESS_MODE is missing/invalid — only ever called after
// isAuthConfigured() has already gated the call site, matching the
// existing getBetterAuthSecret()/getBetterAuthBaseUrl() pattern.
export function getAuthAccessMode(): AuthAccessMode {
  const mode = resolveAuthAccessMode(process.env);
  if (!mode) {
    throw new Error(
      "AUTH_ACCESS_MODE is not set to a valid value. Configure it in your environment before using authentication.",
    );
  }
  return mode;
}

// Non-throwing variant used by pages that only need to decide what to
// render (e.g. whether to show the /admin Pilot Invitations section, or
// which /sign-in copy applies) — never throws, never exposes a value.
export function getAuthAccessModeOrNull(): AuthAccessMode | null {
  return resolveAuthAccessMode(process.env);
}
