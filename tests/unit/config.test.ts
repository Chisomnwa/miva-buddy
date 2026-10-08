import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicSupabaseConfig, getServerConfig } from "@/lib/config";

describe("server environment configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("treats an empty optional database URL as unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("DATABASE_URL", "");

    expect(getServerConfig().DATABASE_URL).toBeUndefined();
  });

  it("rejects a Supabase REST endpoint instead of a project URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co/rest/v1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");

    expect(getPublicSupabaseConfig()).toBeNull();
  });

  it("treats an empty optional hosted-provider key as unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("GROQ_API_KEY", "  ");

    expect(getServerConfig().GROQ_API_KEY).toBeUndefined();
  });

  it("keeps the observed Gemini model identifier as the default", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("GEMINI_API_KEY", "");

    expect(getServerConfig().GEMINI_MODEL).toBe("models/gemini-3.5-flash-lite");
    expect(getServerConfig().GEMINI_API_KEY).toBeUndefined();
  });

  it("accepts Gemini as a server-selected provider without requiring a key during config parsing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "");

    const config = getServerConfig();
    expect(config.AI_PROVIDER).toBe("gemini");
    expect(config.GEMINI_API_KEY).toBeUndefined();
  });
});
