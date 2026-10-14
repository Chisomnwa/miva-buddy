import type { User } from "@supabase/supabase-js";

/** Only an explicit false claim denotes a permanent Supabase Auth user. */
export function isPermanentUser(user: User | null | undefined): user is User {
  return user?.is_anonymous === false;
}

export function profileDestination(programme: string | null | undefined) {
  return programme ? "/home" : "/onboarding";
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parseCanonicalOrigin(value: string, production: boolean): string | null {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    if (value !== url.origin && value !== `${url.origin}/`) return null;
    if (url.protocol === "https:") return url.origin;
    if (!production && url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
      return url.origin;
    }
  } catch {
    return null;
  }
  return null;
}

/** Resolve a trusted browser-facing origin without trusting forwarded or Host headers. */
export function resolveAppBaseUrl(
  requestUrl: URL,
  configured = process.env.APP_BASE_URL,
  nodeEnv = process.env.NODE_ENV,
): string | null {
  const production = nodeEnv === "production";
  const value = configured?.trim();
  if (value) return parseCanonicalOrigin(value, production);
  if (production) return null;

  if (!LOOPBACK_HOSTS.has(requestUrl.hostname.toLowerCase())
    || (requestUrl.protocol !== "http:" && requestUrl.protocol !== "https:")) return null;
  return requestUrl.origin;
}
