import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPublicSupabaseConfig: vi.fn(), getPermanentUser: vi.fn(), getProfile: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (destination: string) => { throw new Error(`redirect:${destination}`); } }));
vi.mock("@/lib/config", () => ({ getPublicSupabaseConfig: mocks.getPublicSupabaseConfig }));
vi.mock("@/lib/auth/permanent-user", () => ({ getPermanentUser: mocks.getPermanentUser }));
vi.mock("@/lib/profile", () => ({ getProfile: mocks.getProfile }));

import IndexPage from "@/app/page";

describe("root authentication routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPublicSupabaseConfig.mockReturnValue({ url: "https://project.example", publishableKey: "synthetic-key" });
  });

  it("redirects a verified missing session to sign-in", async () => {
    mocks.getPermanentUser.mockResolvedValue({ supabase: {}, user: null });
    await expect(IndexPage()).rejects.toThrow("redirect:/sign-in");
  });

  it("routes verified users to Home or onboarding based on profile state", async () => {
    mocks.getPermanentUser.mockResolvedValue({ supabase: {}, user: { id: "verified-user", is_anonymous: false } });
    mocks.getProfile.mockResolvedValue({ data: { programme: "Computer Science" }, error: null });
    await expect(IndexPage()).rejects.toThrow("redirect:/home");
    mocks.getProfile.mockResolvedValue({ data: { programme: null }, error: null });
    await expect(IndexPage()).rejects.toThrow("redirect:/onboarding");
  });
});
