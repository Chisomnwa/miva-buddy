import "server-only";
import type { Pool } from "pg";
import type { GenerationProvider } from "./provider";
import type { EmbeddingProvider } from "@/server/embeddings/provider";
import { estimateGeminiEmbeddingUnits, estimateGeminiGenerationUnits } from "./gemini-usage-formula";
import { withGeminiUsageReservation, type reserveGeminiUsage } from "./gemini-usage-reservations";

export class GeminiUsageProtectedGenerationProvider implements GenerationProvider {
  constructor(private readonly provider: GenerationProvider, private readonly reserve?: typeof reserveGeminiUsage, private readonly pool?: Pool) {}

  generate(input: Parameters<GenerationProvider["generate"]>[0]) {
    return withGeminiUsageReservation({
      userId: input.usageUserId,
      category: input.usageCategory,
      usageUnits: estimateGeminiGenerationUnits(input),
      signal: input.signal,
      reserve: this.reserve,
      pool: this.pool,
      run: (signal) => this.provider.generate({ ...input, signal }),
    });
  }
}

export class GeminiUsageProtectedEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly provider: EmbeddingProvider, private readonly reserve?: typeof reserveGeminiUsage, private readonly pool?: Pool) {}

  get modelId() {
    return this.provider.modelId;
  }

  embed(input: Parameters<EmbeddingProvider["embed"]>[0]) {
    if (input.texts.length === 0) return Promise.resolve([]);
    return withGeminiUsageReservation({
      userId: input.usageUserId,
      category: input.usageCategory,
      usageUnits: estimateGeminiEmbeddingUnits(input.texts),
      signal: input.signal,
      reserve: this.reserve,
      pool: this.pool,
      run: (signal) => this.provider.embed({ ...input, signal }),
    });
  }
}
