import "server-only";
import { getServerConfig } from "@/lib/config";
import type { EmbeddingProvider } from "./provider";
import { FakeEmbeddingProvider } from "./providers/fake";
import { GeminiEmbeddingProvider } from "./providers/gemini";
import { OllamaEmbeddingProvider } from "./providers/ollama";

export function createEmbeddingProvider(): EmbeddingProvider {
  const config = getServerConfig();
  if (config.EMBEDDING_PROVIDER === "fake") {
    if (process.env.NODE_ENV === "production") throw new Error("Embedding provider is not configured");
    return new FakeEmbeddingProvider();
  }
  if (config.EMBEDDING_PROVIDER === "gemini") {
    if (!config.GEMINI_API_KEY) throw new Error("Gemini embedding provider is not configured");
    return new GeminiEmbeddingProvider(config.GEMINI_API_KEY, config.GEMINI_EMBEDDING_MODEL);
  }
  return new OllamaEmbeddingProvider(config.OLLAMA_BASE_URL, config.OLLAMA_EMBEDDING_MODEL);
}
