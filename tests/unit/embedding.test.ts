import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeEmbeddingProvider } from "@/server/embeddings/providers/fake";
import { OllamaEmbeddingProvider } from "@/server/embeddings/providers/ollama";
import { EmbeddingProviderUnavailableError, MalformedEmbeddingOutputError } from "@/server/embeddings/provider";

const input = { texts: ["binary tree", "hash map"], signal: new AbortController().signal };

describe("replaceable embedding provider boundary", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates deterministic test vectors without relying on a hosted service", async () => {
    const provider = new FakeEmbeddingProvider();
    const first = await provider.embed(input);
    expect(first).toEqual(await provider.embed(input));
    expect(first).toHaveLength(2);
    expect(first[0]).toHaveLength(768);
  });

  it("uses the Ollama batch embedding endpoint and configured model", async () => {
    const vectors = [[0.1, 0.2], [0.3, 0.4]];
    const fetchMock = vi.fn(async (url: string | URL | Request, init: RequestInit) => {
      expect(String(url)).toBe("http://127.0.0.1:11434/api/embed");
      expect(JSON.parse(String(init.body))).toEqual({ model: "nomic-embed-text", input: input.texts });
      expect(init.signal).toBe(input.signal);
      return Response.json({ embeddings: vectors });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(new OllamaEmbeddingProvider("http://127.0.0.1:11434/", "nomic-embed-text").embed(input))
      .resolves.toEqual(vectors);
  });

  it("rejects vectors with the wrong count, inconsistent dimensions, or non-finite values", async () => {
    const provider = new OllamaEmbeddingProvider("http://ollama.local", "nomic-embed-text");
    for (const embeddings of [[[0.1]], [[0.1], [0.2, 0.3]], [[0.1], [Number.NaN]]]) {
      vi.stubGlobal("fetch", vi.fn(async () => Response.json({ embeddings })));
      await expect(provider.embed(input)).rejects.toBeInstanceOf(MalformedEmbeddingOutputError);
    }
  });

  it("returns a provider-safe availability error for an HTTP rejection", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("unavailable", { status: 503 })));
    await expect(new OllamaEmbeddingProvider("http://ollama.local", "nomic-embed-text").embed(input))
      .rejects.toBeInstanceOf(EmbeddingProviderUnavailableError);
  });
});
