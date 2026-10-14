import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { AuthVerificationError, getPermanentUser } from "@/lib/auth/permanent-user";

function clientFor(user: unknown, error: unknown = null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error }) },
  } as never;
}

describe("getPermanentUser", () => {
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

  it("sanitizes rejected verification requests", async () => {
    const client = {
      auth: { getUser: vi.fn().mockRejectedValue(new Error("private network detail")) },
    } as never;
    await expect(getPermanentUser(client)).rejects.toBeInstanceOf(AuthVerificationError);
    await expect(getPermanentUser(client)).rejects.toThrow("auth_verification_unavailable");
  });

});
