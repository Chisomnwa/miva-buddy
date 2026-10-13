import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { getPermanentUser } from "@/lib/auth/permanent-user";

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
    ["anonymous user", { id: "anon", is_anonymous: true }, null],
    ["missing identity claim", { id: "unknown" }, null],
    ["failed verification", { id: "unverified", is_anonymous: false }, new Error("verification failed")],
    ["missing user", null, null],
  ])("rejects %s", async (_label, user, error) => {
    const result = await getPermanentUser(clientFor(user, error));
    expect(result.user).toBeNull();
  });
});
