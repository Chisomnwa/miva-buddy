import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import packageJson from "../../package.json";
import { getServerConfig } from "@/lib/config";
import { loadWorkerConfig, WorkerConfigurationError } from "@/server/worker/config";

function syntheticDatabaseUrl() {
  const url = new URL(["post", "gresql", "://localhost:5432/miva_buddy"].join(""));
  url.username = "test-user";
  url.password = "synthetic-password";
  return url.toString();
}

function configured(overrides: Record<string, string> = {}) {
  return vi.fn(() => ({
    ...getServerConfig(),
    DATABASE_URL: syntheticDatabaseUrl(),
    AI_PROVIDER: "gemini" as const,
    EMBEDDING_PROVIDER: "gemini" as const,
    GEMINI_API_KEY: "test-secret",
    ...overrides,
  }));
}

describe("worker configuration", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("keeps production web and worker commands separate from the tsx development runner", () => {
    const dependencies = packageJson.dependencies as Record<string, string>;
    const devDependencies = packageJson.devDependencies as Record<string, string>;
    expect(packageJson.scripts.start).toBe("next start");
    expect(packageJson.scripts["worker:dev"]).toContain("tsx");
    expect(packageJson.scripts["worker:start"]).toContain("node --conditions=react-server");
    expect(packageJson.scripts["worker:start"]).not.toContain("tsx");
    expect(devDependencies.esbuild).toBeDefined();
    expect(dependencies.esbuild).toBeUndefined();
    expect(dependencies["drizzle-kit"]).toBeUndefined();
  });

  it("accepts complete real-provider configuration", () => {
    expect(loadWorkerConfig(configured(), "production").DATABASE_URL).toContain("postgresql://");
  });

  it.each([
    ["database_not_configured", { DATABASE_URL: undefined }],
    ["fake_provider_in_production", { AI_PROVIDER: "fake", EMBEDDING_PROVIDER: "fake" }],
    ["generation_provider_not_configured", { AI_PROVIDER: "groq", GROQ_API_KEY: undefined }],
    ["embedding_provider_not_configured", { AI_PROVIDER: "groq", GROQ_API_KEY: "test-key", EMBEDDING_PROVIDER: "gemini", GEMINI_API_KEY: undefined }],
  ] as const)("rejects %s with a safe category", (category, overrides) => {
    const readConfig = configured(overrides as Record<string, string>);
    try {
      loadWorkerConfig(readConfig, "production");
      throw new Error("expected worker configuration failure");
    } catch (error) {
      expect(error).toBeInstanceOf(WorkerConfigurationError);
      expect((error as WorkerConfigurationError).category).toBe(category);
      expect((error as Error).message).not.toContain("test-secret");
      expect((error as Error).message).not.toContain("postgresql://");
    }
  });

  it("replaces parser errors with a safe configuration category", () => {
    const readConfig = vi.fn(() => { throw new Error("private database URL and secret"); });
    try {
      loadWorkerConfig(readConfig, "production");
      throw new Error("expected worker configuration failure");
    } catch (error) {
      expect(error).toBeInstanceOf(WorkerConfigurationError);
      expect((error as WorkerConfigurationError).category).toBe("invalid_configuration");
      expect((error as Error).message).toBe("Worker configuration is invalid");
      expect((error as Error).message).not.toContain("private database URL and secret");
    }
  });
});
