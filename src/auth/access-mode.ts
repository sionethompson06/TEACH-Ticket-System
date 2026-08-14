// Pure resolver for the AUTH_ACCESS_MODE / AUTH_ALLOWED_DOMAIN environment
// configuration — never reads process.env directly, so it can be exercised
// in tests with fully synthetic environment objects (mirrors the pattern
// already established by src/config/readiness.ts). Deliberately fails
// closed: a missing, unknown, or incomplete configuration resolves to
// `null` rather than silently defaulting to a permissive mode.

export type AuthAccessMode =
  { kind: "invite_only" } | { kind: "workspace"; allowedDomain: string };

// A plain registrable domain: labels of letters/digits/hyphens (no
// leading/trailing hyphen), at least one dot — deliberately simple, since
// this only needs to reject obviously malformed configuration, not
// validate real-world DNS edge cases.
const DOMAIN_PATTERN =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function isValidAllowedDomain(domain: string): boolean {
  return DOMAIN_PATTERN.test(domain);
}

export function resolveAuthAccessMode(
  env: Record<string, string | undefined>,
): AuthAccessMode | null {
  const rawMode = env.AUTH_ACCESS_MODE?.trim();

  if (rawMode === "invite_only") {
    return { kind: "invite_only" };
  }

  if (rawMode === "workspace") {
    const domain = env.AUTH_ALLOWED_DOMAIN?.trim().toLowerCase();
    if (!domain || !isValidAllowedDomain(domain)) {
      return null;
    }
    return { kind: "workspace", allowedDomain: domain };
  }

  // Absent or any other value: fail closed, never a default mode.
  return null;
}
