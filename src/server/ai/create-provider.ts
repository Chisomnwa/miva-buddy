import "server-only";
import { getServerConfig } from "@/lib/config";
import type { GenerationProvider } from "./provider";
import { FakeGenerationProvider } from "./providers/fake";
import { GeminiGenerationProvider } from "./providers/gemini";
import { GroqGenerationProvider } from "./providers/groq";
import { OllamaGenerationProvider } from "./providers/ollama";
import { GeminiUsageProtectedGenerationProvider } from "./gemini-usage-protected-providers";

export function createGenerationProvider(): GenerationProvider {
  const config = getServerConfig();
  if (config.AI_PROVIDER === "fake") {
    if (process.env.NODE_ENV === "production") throw new Error("AI provider is not configured");
    return new FakeGenerationProvider();
  }
  if (config.AI_PROVIDER === "ollama") {
    return new OllamaGenerationProvider(config.OLLAMA_BASE_URL, config.OLLAMA_MODEL);
  }
  if (config.AI_PROVIDER === "gemini") {
    if (!config.GEMINI_API_KEY) throw new Error("Hosted AI provider is not configured");
    return new GeminiUsageProtectedGenerationProvider(new GeminiGenerationProvider(config.GEMINI_API_KEY, config.GEMINI_MODEL));
  }
  if (!config.GROQ_API_KEY) throw new Error("Hosted AI provider is not configured");
  return new GroqGenerationProvider(config.GROQ_API_KEY, config.GROQ_MODEL);
}
