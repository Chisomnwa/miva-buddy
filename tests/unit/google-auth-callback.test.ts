import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), auth: {} as Record<string, ReturnType<typeof vi.fn>>, profileQuery: {} as Record<string, ReturnType<typeof vi.fn>> }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { GET } from "@/app/auth/callback/route";

function callbackUrl(query = "code=synthetic-code&next=https%3A%2F%2Fevil.example") {
  return new Request(`http://localhost:3000/auth/callback?${query}`);
}

describe("Google OAuth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("rejects anonymous or unverifiable identities and clears the local session best-effort", async () => {
    mocks.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "anonymous", is_anonymous: true } }, error: null });
    const response = await GET(callbackUrl());
    expect(response.headers.get("location")).toBe("http://localhost:3000/sign-in?error=session");
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.profileQuery.maybeSingle).not.toHaveBeenCalled();
  });

  it("uses a generic sign-in error when code exchange fails", async () => {
    mocks.auth.exchangeCodeForSession.mockResolvedValueOnce({ error: new Error("private provider detail") });
    const response = await GET(callbackUrl());
    expect(response.headers.get("location")).toBe("http://localhost:3000/sign-in?error=oauth");
    expect(mocks.auth.getUser).not.toHaveBeenCalled();
  });
});
