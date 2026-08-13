// Server-only policy for deciding whether a Google identity is eligible to
// sign in. Deliberately framework-agnostic (no Better Auth or Google SDK
// imports) so it can be unit tested in isolation and reused wherever a
// trusted provider profile needs the same strict check.

export const ALLOWED_GOOGLE_WORKSPACE_DOMAIN = "teachps.org";

// Exactly one "@", no whitespace, nonempty local and domain parts. Domain
// exactness against ALLOWED_GOOGLE_WORKSPACE_DOMAIN is checked separately
// below — this only validates that the value has a plausible email shape.
const EMAIL_SHAPE_PATTERN = /^[^\s@]+@[^\s@]+$/;

export interface TrustedGoogleProfile {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  hd?: unknown;
}

export type GoogleIdentityDenialReason =
  | "missing_subject"
  | "missing_email"
  | "invalid_email"
  | "email_not_verified"
  | "domain_not_allowed"
  | "missing_hosted_domain"
  | "hosted_domain_not_allowed";

export type GoogleIdentityDecision =
  | { allowed: true; sub: string; email: string }
  | { allowed: false; reason: GoogleIdentityDenialReason };

function extractDomain(normalizedEmail: string): string {
  return normalizedEmail.slice(normalizedEmail.indexOf("@") + 1);
}

// Evaluates a trusted (already provider-verified) Google profile against
// the TEACH Workspace eligibility policy. Every check is an exact-match
// comparison after normalization — never a prefix/suffix/`endsWith` check —
// so lookalike and subdomain values cannot slip through.
export function evaluateGoogleWorkspaceIdentity(
  profile: TrustedGoogleProfile,
): GoogleIdentityDecision {
  if (typeof profile.sub !== "string" || profile.sub.trim().length === 0) {
    return { allowed: false, reason: "missing_subject" };
  }

  if (typeof profile.email !== "string" || profile.email.trim().length === 0) {
    return { allowed: false, reason: "missing_email" };
  }

  const normalizedEmail = profile.email.trim().toLowerCase();
  if (!EMAIL_SHAPE_PATTERN.test(normalizedEmail)) {
    return { allowed: false, reason: "invalid_email" };
  }

  if (profile.email_verified !== true) {
    return { allowed: false, reason: "email_not_verified" };
  }

  const emailDomain = extractDomain(normalizedEmail);
  if (emailDomain !== ALLOWED_GOOGLE_WORKSPACE_DOMAIN) {
    return { allowed: false, reason: "domain_not_allowed" };
  }

  if (typeof profile.hd !== "string" || profile.hd.trim().length === 0) {
    return { allowed: false, reason: "missing_hosted_domain" };
  }

  const normalizedHostedDomain = profile.hd.trim().toLowerCase();
  if (normalizedHostedDomain !== ALLOWED_GOOGLE_WORKSPACE_DOMAIN) {
    return { allowed: false, reason: "hosted_domain_not_allowed" };
  }

  return { allowed: true, sub: profile.sub, email: normalizedEmail };
}
