import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeEmbeddingProvider } from "@/server/embeddings/providers/fake";
import { GeminiEmbeddingProvider } from "@/server/embeddings/providers/gemini";
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

  it("requests compatible 768-dimensional Gemini document/query vectors with official task prefixes", async () => {
    const vectors = input.texts.map(() => Array(768).fill(0.125));
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents");
      expect(init?.headers).toMatchObject({ "x-goog-api-key": "test-key" });
      expect(init?.signal).toBe(input.signal);
      const body = JSON.parse(String(init?.body)) as { requests: Array<{ content: { parts: Array<{ text: string }> }; embedContentConfig: { outputDimensionality: number } }> };
      expect(body.requests.map((request) => request.content.parts[0].text)).toEqual([
        "title: none | text: binary tree",
        "title: none | text: hash map",
      ]);
      expect(body.requests.every((request) => request.embedContentConfig.outputDimensionality === 768)).toBe(true);
      return Response.json({ embeddings: vectors.map((values) => ({ values })) });
    });

    await expect(new GeminiEmbeddingProvider("test-key", "gemini-embedding-2", fetchMock).embed({ ...input, task: "document" }))
      .resolves.toEqual(vectors);

    const queryFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { requests: Array<{ content: { parts: Array<{ text: string }> } }> };
      expect(body.requests.map((request) => request.content.parts[0].text)).toEqual([
        "task: search result | query: binary tree",
        "task: search result | query: hash map",
      ]);
      return Response.json({ embeddings: vectors.map((values) => ({ values })) });
    });
    await new GeminiEmbeddingProvider("test-key", "gemini-embedding-2", queryFetch).embed({ ...input, task: "query" });
  });

  it("rejects malformed Gemini responses and vectors that are not exactly 768 finite values", async () => {
    for (const payload of [
      "not-json",
      {},
      { embeddings: [{ values: Array(767).fill(0.1) }, { values: Array(768).fill(0.1) }] },
      { embeddings: [{ values: Array(768).fill(0.1) }, { values: [Number.NaN, ...Array(767).fill(0.1)] }] },
    ]) {
      vi.stubGlobal("fetch", vi.fn(async () => typeof payload === "string"
        ? new Response(payload, { headers: { "content-type": "application/json" } })
        : Response.json(payload)));
      await expect(new GeminiEmbeddingProvider("test-key", "gemini-embedding-2").embed({ ...input, task: "query" }))
        .rejects.toBeInstanceOf(MalformedEmbeddingOutputError);
    }
  });

  it("maps Gemini HTTP and network failures to safe provider errors and preserves aborts", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("provider detail", { status: 429 })));
    const rejected = new GeminiEmbeddingProvider("test-key", "gemini-embedding-2").embed({ ...input, task: "query" });
    await expect(rejected).rejects.toBeInstanceOf(EmbeddingProviderUnavailableError);
    await expect(rejected).rejects.toMatchObject({ statusCode: 429 });

    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network detail"); }));
    await expect(new GeminiEmbeddingProvider("test-key", "gemini-embedding-2").embed({ ...input, task: "query" }))
      .rejects.toBeInstanceOf(EmbeddingProviderUnavailableError);
  });
});
