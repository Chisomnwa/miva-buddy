import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: (fn: (...args: unknown[]) => unknown) => {
      const results = new Map<unknown, unknown>();
      return (...args: unknown[]) => {
        const key = args[0] ?? "no-arguments";
        if (!results.has(key)) results.set(key, fn(...args));
        return results.get(key);
      };
    },
  };
});
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), hasSupabaseAuthCookie: vi.fn().mockResolvedValue(true) }));

import { AuthVerificationError, getPermanentUser } from "@/lib/auth/permanent-user";

function clientFor(user: unknown, error: unknown = null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error }) },
  } as never;
}

describe("getPermanentUser", () => {
  it("reuses one verification result within the same render", async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "verified-user", is_anonymous: false } }, error: null });
    const client = { auth: { getUser } } as never;
    const [first, second] = await Promise.all([getPermanentUser(client), getPermanentUser(client)]);
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it("accepts an explicitly permanent user returned by Supabase getUser", async () => {
    const client = clientFor({ id: "verified-user", is_anonymous: false });
    const result = await getPermanentUser(client);
    expect(result.user).toMatchObject({ id: "verified-user", is_anonymous: false });
    expect(result.supabase).toBe(client);
  });

  it.each([
    ["anonymous user", { id: "anon", is_anonymous: true }],
    ["missing identity claim", { id: "unknown" }],
    ["missing user", null],
  ])("rejects %s after successful verification", async (_label, user) => {
    const result = await getPermanentUser(clientFor(user));
    expect(result.user).toBeNull();
  });

  it("raises a safe temporary-verification error instead of treating a failed check as signed out", async () => {
    const client = clientFor(null, new Error("private provider details"));
    await expect(getPermanentUser(client)).rejects.toBeInstanceOf(AuthVerificationError);
    await expect(getPermanentUser(client)).rejects.toThrow("auth_verification_unavailable");
  });

  it.each([
    ["missing session", { name: "AuthSessionMissingError" }],
    ["rejected token", { name: "AuthInvalidJwtError" }],
    ["401 response", { name: "AuthApiError", status: 401 }],
  ])("treats a returned %s as signed out", async (_label, error) => {
    const result = await getPermanentUser(clientFor(null, error));
    expect(result.user).toBeNull();
  });

  it.each([
    ["missing session", { name: "AuthSessionMissingError" }],
    ["rejected token", { name: "AuthInvalidJwtError" }],
    ["401 response", { name: "AuthApiError", status: 401 }],
  ])("treats a thrown %s as signed out", async (_label, error) => {
    const client = { auth: { getUser: vi.fn().mockRejectedValue(error) } } as never;
    const result = await getPermanentUser(client);
    expect(result.user).toBeNull();
  });

  it.each([
    ["Auth API failure", { name: "AuthApiError", status: 503 }],
    ["unknown verification error", { name: "AuthApiError", status: 400 }],
  ])("keeps %s fail-closed", async (_label, error) => {
    const client = { auth: { getUser: vi.fn().mockRejectedValue(error) } } as never;
    await expect(getPermanentUser(client)).rejects.toBeInstanceOf(AuthVerificationError);
  });

  it("sanitizes rejected verification requests", async () => {
    const client = {
      auth: { getUser: vi.fn().mockRejectedValue(new Error("private network detail")) },
    } as never;
    await expect(getPermanentUser(client)).rejects.toBeInstanceOf(AuthVerificationError);
    await expect(getPermanentUser(client)).rejects.toThrow("auth_verification_unavailable");
  });

});
