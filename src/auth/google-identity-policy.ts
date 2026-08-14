// Server-only policy for deciding whether a Google identity is eligible to
// sign in. Deliberately framework-agnostic (no Better Auth or Google SDK
// imports) so it can be unit tested in isolation and reused wherever a
// trusted provider profile needs the same strict check.
//
// Two policies exist, one per AUTH_ACCESS_MODE (src/auth/access-mode.ts):
// evaluateGoogleWorkspaceIdentity (workspace mode — exact-domain identity
// eligibility, unchanged from Phase 3/9) and evaluateGoogleInviteOnlyIdentity
// (Phase 9A invite-only mode — identity eligibility only; whether the
// address is actually invited is a separate, database-backed decision made
// by the Better Auth provisioning hooks in src/auth/auth-options.ts).

// Exactly one "@", no whitespace, nonempty local and domain parts. Domain
// exactness against an allowed domain is checked separately, only in
// workspace mode — this only validates that the value has a plausible
// email shape.
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

type BaseIdentityResult =
  | { allowed: true; sub: string; normalizedEmail: string }
  | { allowed: false; reason: GoogleIdentityDenialReason };

// The checks common to both modes: a stable nonempty subject, a
// plausible, verified email. Domain/hosted-domain checks are layered on
// top of this only by evaluateGoogleWorkspaceIdentity.
function evaluateBaseGoogleIdentity(
  profile: TrustedGoogleProfile,
): BaseIdentityResult {
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

  return { allowed: true, sub: profile.sub, normalizedEmail };
}

// Evaluates a trusted (already provider-verified) Google profile against
// the strict Workspace eligibility policy for a given exact domain. Every
// check is an exact-match comparison after normalization — never a
// prefix/suffix/`endsWith` check — so lookalike and subdomain values
// cannot slip through. `allowedDomain` is caller-supplied (from
// AUTH_ALLOWED_DOMAIN) rather than hardcoded, so the same policy shape
// works for the TEACH deployment or, in principle, another future
// Workspace-mode deployment.
export function evaluateGoogleWorkspaceIdentity(
  profile: TrustedGoogleProfile,
  allowedDomain: string,
): GoogleIdentityDecision {
  const base = evaluateBaseGoogleIdentity(profile);
  if (!base.allowed) {
    return base;
  }

  const emailDomain = extractDomain(base.normalizedEmail);
  if (emailDomain !== allowedDomain) {
    return { allowed: false, reason: "domain_not_allowed" };
  }

  if (typeof profile.hd !== "string" || profile.hd.trim().length === 0) {
    return { allowed: false, reason: "missing_hosted_domain" };
  }

  const normalizedHostedDomain = profile.hd.trim().toLowerCase();
  if (normalizedHostedDomain !== allowedDomain) {
    return { allowed: false, reason: "hosted_domain_not_allowed" };
  }

  return { allowed: true, sub: base.sub, email: base.normalizedEmail };
}

// Evaluates a trusted Google profile for invite-only mode: identity
// eligibility only (stable subject, verified, plausible email) — no
// domain or hosted-domain requirement at all, since an invited address may
// be a personal Gmail account or belong to any organization's Workspace.
// Whether this specific address is actually invited is decided separately,
// against the database, by the caller (src/auth/auth-options.ts).
export function evaluateGoogleInviteOnlyIdentity(
  profile: TrustedGoogleProfile,
): GoogleIdentityDecision {
  const base = evaluateBaseGoogleIdentity(profile);
  if (!base.allowed) {
    return base;
  }

  return { allowed: true, sub: base.sub, email: base.normalizedEmail };
}
