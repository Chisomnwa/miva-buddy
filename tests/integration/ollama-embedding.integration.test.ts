import { describe, expect, it } from "vitest";
import { OllamaEmbeddingProvider } from "@/server/embeddings/providers/ollama";

const enabled = process.env.RUN_OLLAMA_EMBEDDING_TESTS === "1";

describe.skipIf(!enabled)("local Ollama embedding provider", () => {
  it("embeds synthetic batches with consistent finite vectors", async () => {
    const provider = new OllamaEmbeddingProvider(
      process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
      process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text",
    );
    const vectors = await provider.embed({
      texts: [
        "Miva Buddy synthetic embedding integration check.",
        "A second unrelated synthetic text for vector validation.",
      ],
      signal: AbortSignal.timeout(60_000),
    });

    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toHaveLength(768);
    expect(vectors[1]).toHaveLength(768);
    expect(vectors.flat().every(Number.isFinite)).toBe(true);
    expect(vectors[0]).not.toEqual(vectors[1]);
  }, 90_000);
});
