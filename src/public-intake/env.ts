// Pure resolvers for the PUBLIC_TICKET_INTAKE / PUBLIC_INTAKE_RATE_LIMIT_SECRET
// environment configuration — never read process.env directly, so both can
// be exercised in tests with fully synthetic environment objects (mirrors
// the pattern already established by src/auth/access-mode.ts and
// src/config/readiness.ts). Deliberately fails closed: anything other than
// the exact literal "true" leaves public intake disabled, and a missing or
// too-short rate-limit secret is never treated as configured.

const MIN_RATE_LIMIT_SECRET_LENGTH = 32;

// Fails closed: only the exact string "true" enables public intake. Any
// other value (including "TRUE", "1", "yes", or whitespace-padded "true")
// is treated as disabled — there is no permissive default.
export function resolvePublicTicketIntakeEnabled(
  env: Record<string, string | undefined>,
): boolean {
  return env.PUBLIC_TICKET_INTAKE === "true";
}

// Returns the configured secret only when it meets the minimum length —
// never echoes or logs the value itself. Whitespace-only or missing values
// resolve to null, same as an absent variable.
export function resolvePublicIntakeRateLimitSecret(
  env: Record<string, string | undefined>,
): string | null {
  const value = env.PUBLIC_INTAKE_RATE_LIMIT_SECRET;
  if (!value || value.length < MIN_RATE_LIMIT_SECRET_LENGTH) {
    return null;
  }
  return value;
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

// Non-throwing check used by pages/routes to decide whether to render the
// public intake form at all — never logs or exposes any variable's value.
export function isPublicTicketIntakeEnabled(): boolean {
  return resolvePublicTicketIntakeEnabled(process.env);
}

// Throws if the secret is missing or too short — only ever called from a
// code path already gated by isPublicTicketIntakeEnabled(), matching the
// existing getBetterAuthSecret()-style pattern in src/auth/env.ts.
export function getPublicIntakeRateLimitSecret(): string {
  const secret = resolvePublicIntakeRateLimitSecret({
    PUBLIC_INTAKE_RATE_LIMIT_SECRET: readEnv("PUBLIC_INTAKE_RATE_LIMIT_SECRET"),
  });
  if (!secret) {
    throw new Error(
      `PUBLIC_INTAKE_RATE_LIMIT_SECRET is not set to a value of at least ${MIN_RATE_LIMIT_SECRET_LENGTH} characters. Configure it before enabling public ticket intake.`,
    );
  }
  return secret;
}
