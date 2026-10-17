import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), auth: {} as Record<string, ReturnType<typeof vi.fn>>, profileQuery: {} as Record<string, ReturnType<typeof vi.fn>> }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient, hasSupabaseAuthCookie: vi.fn().mockResolvedValue(true) }));

import { GET } from "@/app/auth/callback/route";

const publicOrigin = "https://miva-buddy.onrender.com";

function callbackUrl(
  query = "code=synthetic-code&next=https%3A%2F%2Fevil.example",
  origin = "http://localhost:3000",
  headers?: HeadersInit,
) {
  return new Request(`${origin}/auth/callback?${query}`, { headers });
}

describe("Google OAuth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("APP_BASE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    mocks.auth.exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    mocks.auth.getUser = vi.fn().mockResolvedValue({ data: { user: { id: "permanent-user", is_anonymous: false } }, error: null });
    mocks.auth.signOut = vi.fn().mockResolvedValue({ error: null });
    mocks.profileQuery.select = vi.fn(() => mocks.profileQuery);
    mocks.profileQuery.eq = vi.fn(() => mocks.profileQuery);
    mocks.profileQuery.maybeSingle = vi.fn().mockResolvedValue({ data: { programme: null }, error: null });
    mocks.createClient.mockResolvedValue({
      auth: mocks.auth,
      from: vi.fn(() => mocks.profileQuery),
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects callbacks without an authorization code", async () => {
    const response = await GET(callbackUrl("state=synthetic"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/sign-in?error=oauth");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("exchanges the code server-side and routes new Google users to onboarding", async () => {
    const response = await GET(callbackUrl());
    expect(mocks.auth.exchangeCodeForSession).toHaveBeenCalledWith("synthetic-code");
    expect(response.headers.get("location")).toBe("http://localhost:3000/onboarding");
  });

  it("routes returning students with completed profiles to Home, not a caller-provided URL", async () => {
    mocks.profileQuery.maybeSingle.mockResolvedValueOnce({ data: { programme: "Computer Science" }, error: null });
    const response = await GET(callbackUrl());
    expect(response.headers.get("location")).toBe("http://localhost:3000/home");
  });

  it("routes invalid callback sessions to sign-in without exposing provider details", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { name: "AuthInvalidJwtError", message: "private token data" } });
    const response = await GET(callbackUrl());
    expect(response.headers.get("location")).toBe("http://localhost:3000/sign-in?error=session");
    expect(mocks.auth.signOut).not.toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private token data");
    warn.mockRestore();
  });

  it("rejects anonymous or unverifiable identities and clears the local session best-effort", async () => {
    mocks.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "anonymous", is_anonymous: true } }, error: null });
    const response = await GET(callbackUrl());
    expect(response.headers.get("location")).toBe("http://localhost:3000/sign-in?error=session");
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.profileQuery.maybeSingle).not.toHaveBeenCalled();
  });

  it("preserves the exchanged session when user verification returns a temporary error", async () => {
    mocks.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("private verification detail") });
    const response = await GET(callbackUrl());
    expect(response.headers.get("location")).toBe("http://localhost:3000/sign-in?error=verification");
    expect(mocks.auth.signOut).not.toHaveBeenCalled();
    expect(mocks.profileQuery.maybeSingle).not.toHaveBeenCalled();
  });

  it("preserves the exchanged session when user verification rejects", async () => {
    mocks.auth.getUser.mockRejectedValueOnce(new Error("private network detail"));
    const response = await GET(callbackUrl());
    expect(response.headers.get("location")).toBe("http://localhost:3000/sign-in?error=verification");
    expect(mocks.auth.signOut).not.toHaveBeenCalled();
    expect(mocks.profileQuery.maybeSingle).not.toHaveBeenCalled();
  });

  it("uses a generic sign-in error when code exchange fails", async () => {
    mocks.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: new Error("private provider detail") });
    const response = await GET(callbackUrl());
    expect(response.headers.get("location")).toBe("http://localhost:3000/sign-in?error=oauth");
    expect(mocks.auth.getUser).not.toHaveBeenCalled();
  });

  it("uses the configured public origin for production redirects from an internal request URL", async () => {
    vi.stubEnv("APP_BASE_URL", publicOrigin);
    vi.stubEnv("NODE_ENV", "production");

    const response = await GET(callbackUrl("code=synthetic-code", "http://0.0.0.0:10000"));
    expect(response.headers.get("location")).toBe(`${publicOrigin}/onboarding`);
  });

  it("uses the configured public origin for callback errors and completed profiles", async () => {
    vi.stubEnv("APP_BASE_URL", publicOrigin);
    vi.stubEnv("NODE_ENV", "production");
    const internalOrigin = "http://0.0.0.0:10000";

    const missingCode = await GET(callbackUrl("state=synthetic", internalOrigin));
    expect(missingCode.headers.get("location")).toBe(`${publicOrigin}/sign-in?error=oauth`);

    mocks.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: new Error("private provider detail") });
    const exchangeFailure = await GET(callbackUrl("code=synthetic-code", internalOrigin));
    expect(exchangeFailure.headers.get("location")).toBe(`${publicOrigin}/sign-in?error=oauth`);

    mocks.profileQuery.maybeSingle.mockResolvedValueOnce({ data: { programme: "Computer Science" }, error: null });
    const returningStudent = await GET(callbackUrl("code=synthetic-code", internalOrigin));
    expect(returningStudent.headers.get("location")).toBe(`${publicOrigin}/home`);
  });

  it("keeps localhost fallback in development and ignores spoofed forwarding headers", async () => {
    const localResponse = await GET(callbackUrl("code=synthetic-code"));
    expect(localResponse.headers.get("location")).toBe("http://localhost:3000/onboarding");

    vi.stubEnv("APP_BASE_URL", publicOrigin);
    vi.stubEnv("NODE_ENV", "production");
    const spoofedHeaders = {
      host: "attacker.example",
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "http",
    };
    const response = await GET(callbackUrl(
      "code=synthetic-code&next=https%3A%2F%2Fevil.example",
      "http://0.0.0.0:10000",
      spoofedHeaders,
    ));
    expect(response.headers.get("location")).toBe(`${publicOrigin}/onboarding`);
  });

  it("does not use an arbitrary request host as the development fallback", async () => {
    const response = await GET(callbackUrl("code=synthetic-code", "http://attacker.example"));
    expect(response.status).toBe(500);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it.each([
    "",
    "http://miva-buddy.onrender.com",
    "https://miva-buddy.onrender.com/path",
    "https://miva-buddy.onrender.com?next=/",
    "https://miva-buddy.onrender.com#fragment",
    "https://user@miva-buddy.onrender.com",
    "not a URL",
  ])("fails closed for invalid production APP_BASE_URL values", async (invalidOrigin) => {
    vi.stubEnv("APP_BASE_URL", invalidOrigin);
    vi.stubEnv("NODE_ENV", "production");

    const response = await GET(callbackUrl("code=synthetic-code", "http://0.0.0.0:10000"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "oauth_callback_unavailable" });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});
