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

// Pure function over a plain env-like object (never process.env directly)
// so it can be exercised in tests with fully synthetic values — this is
// the same validation the CLI wrapper in src/scripts/readiness-check.ts
// prints, and it never returns the values it was given, only a status
// and a safe, generic explanation.
export function checkReadiness(
  env: Record<string, string | undefined>,
): ReadinessResult {
  const items: ReadinessCheckItem[] = [
    checkDatabaseConfiguration(env.DATABASE_URL),
    checkAuthenticationSecret(env.BETTER_AUTH_SECRET),
    checkApplicationOrigin(env.BETTER_AUTH_URL),
    checkGoogleOAuthConfiguration(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
    ),
  ];

  return {
    items,
    ready: items.every((item) => item.status === "ready"),
  };
}
