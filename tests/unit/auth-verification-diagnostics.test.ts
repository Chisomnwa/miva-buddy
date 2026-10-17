import { describe, expect, it, vi } from "vitest";
import { classifyAuthVerificationFailure, hasSupabaseAuthCookieName, logAuthVerificationDiagnostic } from "@/lib/auth/verification-diagnostics";

describe("safe Auth diagnostics", () => {
  it.each([
    [{ name: "AuthSessionMissingError" }, "missing_session"],
    [{ name: "AuthInvalidJwtError" }, "token_rejected"],
    [{ name: "AuthApiError", status: 401 }, "token_rejected"],
    [{ name: "AuthApiError", status: 429 }, "auth_retryable"],
    [{ name: "AuthApiError", status: 503 }, "auth_retryable"],
    [{ name: "AuthApiError", status: 403 }, "unknown"],
    [{ name: "AuthRetryableFetchError" }, "auth_retryable"],
    [new TypeError("sensitive detail"), "auth_retryable"],
    [{ name: "AuthApiError", status: 400 }, "unknown"],
  ] as const)("classifies %j", (error, category) => {
    expect(classifyAuthVerificationFailure(error)).toBe(category);
  });

  it("recognizes only Supabase auth cookie names and chunks", () => {
    expect(hasSupabaseAuthCookieName(["theme", "sb-project-auth-token.0"])).toBe(true);
    expect(hasSupabaseAuthCookieName(["theme", "unrelated-auth-token"])).toBe(false);
  });

  it("logs only a fixed category and cookie-presence boolean", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    logAuthVerificationDiagnostic("auth_retryable", true);
    expect(warn).toHaveBeenCalledWith("auth_verification_diagnostic", { category: "auth_retryable", auth_cookie_present: true });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("sensitive");
    warn.mockRestore();
  });
});
