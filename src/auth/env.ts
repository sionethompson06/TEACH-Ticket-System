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
// any variable's value, only whether each required name is present.
export function isAuthConfigured(): boolean {
  return Boolean(
    readEnv("BETTER_AUTH_SECRET") &&
    readEnv("BETTER_AUTH_URL") &&
    readEnv("GOOGLE_CLIENT_ID") &&
    readEnv("GOOGLE_CLIENT_SECRET") &&
    readEnv("DATABASE_URL"),
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
