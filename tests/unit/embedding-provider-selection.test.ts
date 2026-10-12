import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmbeddingProvider } from "@/server/embeddings/create-provider";
import { GeminiEmbeddingProvider } from "@/server/embeddings/providers/gemini";
import { OllamaEmbeddingProvider } from "@/server/embeddings/providers/ollama";

vi.mock("server-only", () => ({}));

describe("embedding provider selection", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("selects Gemini explicitly when configured", () => {
    vi.stubEnv("EMBEDDING_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "mock-gemini-key");

    expect(createEmbeddingProvider()).toBeInstanceOf(GeminiEmbeddingProvider);
  });

  it("fails closed when Gemini is selected without its server-side key", () => {
    vi.stubEnv("EMBEDDING_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "");

    expect(() => createEmbeddingProvider()).toThrow("Gemini embedding provider is not configured");
  });

  it("keeps Ollama available only when explicitly selected", () => {
    vi.stubEnv("EMBEDDING_PROVIDER", "ollama");
    expect(createEmbeddingProvider()).toBeInstanceOf(OllamaEmbeddingProvider);
  });

  it("rejects the fake provider in production rather than falling back", () => {
    vi.stubEnv("EMBEDDING_PROVIDER", "fake");
    vi.stubEnv("NODE_ENV", "production");

    expect(() => createEmbeddingProvider()).toThrow("Embedding provider is not configured");
  });
});
