export const AUTH_VERIFICATION_CATEGORIES = [
  "missing_session",
  "token_rejected",
  "auth_retryable",
  "unknown",
] as const;

export type AuthVerificationCategory = (typeof AUTH_VERIFICATION_CATEGORIES)[number];

type SafeErrorShape = {
  name: string | undefined;
  status: number | undefined;
  code: string | undefined;
};

function errorShape(error: unknown): SafeErrorShape {
  if (!error || typeof error !== "object") return { name: undefined, status: undefined, code: undefined };
  const candidate = error as SafeErrorShape;
  return {
    name: typeof candidate.name === "string" ? candidate.name : undefined,
    status: typeof candidate.status === "number" ? candidate.status : undefined,
    code: typeof candidate.code === "string" ? candidate.code : undefined,
  };
}

export function classifyAuthVerificationFailure(error: unknown): AuthVerificationCategory {
  const { name, status, code } = errorShape(error);
  if (name === "AuthSessionMissingError") return "missing_session";
  if (name === "AuthInvalidJwtError" || ["invalid_jwt", "bad_jwt", "session_not_found", "token_expired"].includes(code ?? "")) {
    return "token_rejected";
  }
  if (status === 401) return "token_rejected";
  if (name === "AuthRetryableFetchError" || name === "TypeError" || name === "AbortError" || status === 429 || (status !== undefined && status >= 500)) {
    return "auth_retryable";
  }
  return "unknown";
}

export function hasSupabaseAuthCookieName(cookieNames: readonly string[]): boolean {
  return cookieNames.some((name) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name));
}

export function logAuthVerificationDiagnostic(category: AuthVerificationCategory, authCookiePresent: boolean): void {
  console.warn("auth_verification_diagnostic", { category, auth_cookie_present: authCookiePresent });
}
