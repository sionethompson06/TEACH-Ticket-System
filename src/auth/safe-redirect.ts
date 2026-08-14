// Guards against open-redirect attacks in a post-sign-in callback
// destination. Only a plain, same-origin relative path is ever accepted —
// never a protocol-relative URL (//evil.com), an absolute URL
// (https://evil.com), or anything else that could send a signed-in user
// off this application.

export const DEFAULT_SIGN_IN_DESTINATION = "/requests";

export function resolveSafeCallbackPath(
  candidate: string | string[] | undefined,
  fallback: string = DEFAULT_SIGN_IN_DESTINATION,
): string {
  const value = Array.isArray(candidate) ? candidate[0] : candidate;
  if (!value) {
    return fallback;
  }
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("://")
  ) {
    return fallback;
  }
  return value;
}
