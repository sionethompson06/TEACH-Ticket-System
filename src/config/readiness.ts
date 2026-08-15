import { isValidAllowedDomain } from "../auth/access-mode";

export type ReadinessStatus = "ready" | "not configured" | "invalid";

export interface ReadinessCheckItem {
  label: string;
  status: ReadinessStatus;
  detail?: string;
}

export interface ReadinessResult {
  items: ReadinessCheckItem[];
  ready: boolean;
}

// Substrings that mark an example/placeholder value from .env.example or
// common documentation samples — never a real production credential.
const PLACEHOLDER_MARKERS = [
  "replace-with-your-value",
  "your-value",
  "your-secret",
  "example.com",
  "example",
  "changeme",
  "change-me",
  "placeholder",
  "xxxx",
  "test-client",
  "test-secret",
];

const WEAK_SECRET_VALUES = [
  "changeme",
  "secret",
  "your-secret-here",
  "replace-with-your-value",
  "test",
  "password",
];

const MIN_SECRET_LENGTH = 32;

function containsPlaceholderMarker(value: string): boolean {
  const lowered = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => lowered.includes(marker));
}

function checkDatabaseConfiguration(
  value: string | undefined,
): ReadinessCheckItem {
  const label = "Database configuration";
  if (!value) {
    return { label, status: "not configured" };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { label, status: "invalid", detail: "Not a valid connection URL." };
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    return {
      label,
      status: "invalid",
      detail: "Must be a postgres:// or postgresql:// connection URL.",
    };
  }

  if (!parsed.hostname) {
    return { label, status: "invalid", detail: "Missing a database host." };
  }

  if (containsPlaceholderMarker(value)) {
    return {
      label,
      status: "invalid",
      detail: "Looks like an example value rather than a real connection URL.",
    };
  }

  return { label, status: "ready" };
}

function checkAuthenticationSecret(
  value: string | undefined,
): ReadinessCheckItem {
  const label = "Authentication secret";
  if (!value) {
    return { label, status: "not configured" };
  }

  if (value.length < MIN_SECRET_LENGTH) {
    return {
      label,
      status: "invalid",
      detail: `Must be at least ${MIN_SECRET_LENGTH} characters.`,
    };
  }

  const lowered = value.toLowerCase();
  if (
    WEAK_SECRET_VALUES.some(
      (weak) => lowered === weak || lowered.includes(weak),
    )
  ) {
    return {
      label,
      status: "invalid",
      detail: "Looks like a placeholder value rather than a generated secret.",
    };
  }

  return { label, status: "ready" };
}

function checkApplicationOrigin(value: string | undefined): ReadinessCheckItem {
  const label = "Application origin";
  if (!value) {
    return { label, status: "not configured" };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { label, status: "invalid", detail: "Not a valid absolute URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { label, status: "invalid", detail: "Must use http or https." };
  }

  const isLocal =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (!isLocal && parsed.protocol !== "https:") {
    return {
      label,
      status: "invalid",
      detail: "Production origins must use https.",
    };
  }

  if (
    (parsed.pathname !== "" && parsed.pathname !== "/") ||
    parsed.search ||
    parsed.hash
  ) {
    return {
      label,
      status: "invalid",
      detail: "Must be an origin only, with no path, query, or fragment.",
    };
  }

  if (containsPlaceholderMarker(value)) {
    return {
      label,
      status: "invalid",
      detail: "Looks like an example value rather than a real origin.",
    };
  }

  return { label, status: "ready" };
}

function checkGoogleOAuthConfiguration(
  clientId: string | undefined,
  clientSecret: string | undefined,
): ReadinessCheckItem {
  const label = "Google OAuth configuration";
  if (!clientId && !clientSecret) {
    return { label, status: "not configured" };
  }

  if (!clientId || !clientSecret) {
    return {
      label,
      status: "invalid",
      detail:
        "Both the Google client ID and client secret must be set together.",
    };
  }

  if (
    containsPlaceholderMarker(clientId) ||
    containsPlaceholderMarker(clientSecret)
  ) {
    return {
      label,
      status: "invalid",
      detail:
        "Looks like an example value rather than real Google OAuth credentials.",
    };
  }

  return { label, status: "ready" };
}

const MIN_PUBLIC_INTAKE_SECRET_LENGTH = 32;

// Phase 9B: recognizes the temporary public (unauthenticated) ticket
// intake mode as a second, independently valid runtime configuration —
// not merely a variant of the normal authenticated mode. "not configured"
// here (the flag absent or not exactly "true") is a completely normal,
// expected state whenever the deployment is using ordinary Google OAuth
// sign-in instead; it is never itself a reason overall readiness fails.
function checkPublicTicketIntake(
  rawFlag: string | undefined,
  rawRateLimitSecret: string | undefined,
): ReadinessCheckItem {
  const label = "Public ticket intake";

  if (rawFlag !== "true") {
    return {
      label,
      status: "not configured",
      detail:
        "Temporary public intake mode is off; normal Google OAuth sign-in is required to submit a request.",
    };
  }

  if (!rawRateLimitSecret) {
    return {
      label,
      status: "invalid",
      detail:
        "PUBLIC_INTAKE_RATE_LIMIT_SECRET is required when public ticket intake is enabled.",
    };
  }

  if (rawRateLimitSecret.length < MIN_PUBLIC_INTAKE_SECRET_LENGTH) {
    return {
      label,
      status: "invalid",
      detail: `PUBLIC_INTAKE_RATE_LIMIT_SECRET must be at least ${MIN_PUBLIC_INTAKE_SECRET_LENGTH} characters.`,
    };
  }

  if (containsPlaceholderMarker(rawRateLimitSecret)) {
    return {
      label,
      status: "invalid",
      detail: "Looks like a placeholder value rather than a generated secret.",
    };
  }

  return {
    label,
    status: "ready",
    detail:
      "Temporary public intake mode is on: anyone with the site URL can submit a ticket without signing in. Staff sign-in, support, and administration remain unavailable until Google OAuth is configured.",
  };
}

function checkAccessMode(
  rawMode: string | undefined,
  rawAllowedDomain: string | undefined,
): ReadinessCheckItem {
  const label = "Access mode";
  const mode = rawMode?.trim();

  if (!mode) {
    return { label, status: "not configured" };
  }

  if (mode !== "invite_only" && mode !== "workspace") {
    return {
      label,
      status: "invalid",
      detail: "AUTH_ACCESS_MODE must be either invite_only or workspace.",
    };
  }

  if (mode === "invite_only") {
    return {
      label,
      status: "ready",
      detail:
        "Invite-only mode: access is controlled by database invitations, not a domain restriction.",
    };
  }

  const domain = rawAllowedDomain?.trim().toLowerCase();
  if (!domain) {
    return {
      label,
      status: "invalid",
      detail: "Workspace mode requires AUTH_ALLOWED_DOMAIN to be set.",
    };
  }
  if (!isValidAllowedDomain(domain)) {
    return {
      label,
      status: "invalid",
      detail: "AUTH_ALLOWED_DOMAIN is not a valid domain.",
    };
  }

  return {
    label,
    status: "ready",
    detail: "Workspace mode: access is restricted to the configured domain.",
  };
}

// Pure function over a plain env-like object (never process.env directly)
// so it can be exercised in tests with fully synthetic values — this is
// the same validation the CLI wrapper in src/scripts/readiness-check.ts
// prints, and it never returns the values it was given, only a status
// and a safe, generic explanation.
//
// Phase 9B: exactly two runtime configurations are valid — normal
// authenticated mode (Google OAuth + access mode both ready) or temporary
// public-intake mode (the public-intake item ready) — on top of the
// database/secret/origin configuration both modes always require. Overall
// `ready` never implies support/admin UI is usable without Google OAuth:
// it only means *some* way to submit a ticket is available.
export function checkReadiness(
  env: Record<string, string | undefined>,
): ReadinessResult {
  const database = checkDatabaseConfiguration(env.DATABASE_URL);
  const authSecret = checkAuthenticationSecret(env.BETTER_AUTH_SECRET);
  const origin = checkApplicationOrigin(env.BETTER_AUTH_URL);
  const googleOAuth = checkGoogleOAuthConfiguration(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
  );
  const accessMode = checkAccessMode(
    env.AUTH_ACCESS_MODE,
    env.AUTH_ALLOWED_DOMAIN,
  );
  const publicIntake = checkPublicTicketIntake(
    env.PUBLIC_TICKET_INTAKE,
    env.PUBLIC_INTAKE_RATE_LIMIT_SECRET,
  );

  const items: ReadinessCheckItem[] = [
    database,
    authSecret,
    origin,
    googleOAuth,
    accessMode,
    publicIntake,
  ];

  const coreReady =
    database.status === "ready" &&
    authSecret.status === "ready" &&
    origin.status === "ready";
  const authenticatedModeReady =
    googleOAuth.status === "ready" && accessMode.status === "ready";
  const publicIntakeModeReady = publicIntake.status === "ready";

  return {
    items,
    ready: coreReady && (authenticatedModeReady || publicIntakeModeReady),
  };
}
