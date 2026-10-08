import "server-only";
import { getServerConfig } from "@/lib/config";
import type { EmbeddingProvider } from "./provider";
import { FakeEmbeddingProvider } from "./providers/fake";
import { OllamaEmbeddingProvider } from "./providers/ollama";

export function createEmbeddingProvider(): EmbeddingProvider {
  const config = getServerConfig();
  if (config.EMBEDDING_PROVIDER === "fake") {
    if (process.env.NODE_ENV === "production") throw new Error("Embedding provider is not configured");
    return new FakeEmbeddingProvider();
  }
  return new OllamaEmbeddingProvider(config.OLLAMA_BASE_URL, config.OLLAMA_EMBEDDING_MODEL);
}
