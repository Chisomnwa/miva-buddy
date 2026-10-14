import type { EmbeddingInput, EmbeddingProvider } from "../provider";
import { MalformedEmbeddingOutputError } from "../provider";
import { createGeminiTimeoutSignal, geminiHttpFailure, geminiTransportFailure } from "@/server/ai/gemini-provider-errors";

export const GEMINI_EMBEDDING_DIMENSIONS = 768;
export const GEMINI_EMBEDDING_FORMAT_VERSION = "course-retrieval-v1";

type GeminiEmbeddingResponse = { embeddings?: Array<{ values?: unknown }> };

function isVector(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.length === GEMINI_EMBEDDING_DIMENSIONS
    && value.every((component) => typeof component === "number" && Number.isFinite(component));
}

export function formatGeminiEmbeddingModelId(model: string) {
  return `gemini:${model}:${GEMINI_EMBEDDING_DIMENSIONS}:${GEMINI_EMBEDDING_FORMAT_VERSION}`;
}

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  get modelId() {
    return formatGeminiEmbeddingModelId(this.model);
  }

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    if (!apiKey.trim()) throw new Error("Gemini embedding provider is not configured");
  }

  async embed(input: EmbeddingInput): Promise<number[][]> {
    if (input.texts.length === 0) return [];
    if (input.task !== "document" && input.task !== "query") {
      throw new MalformedEmbeddingOutputError();
    }

    const modelName = `models/${this.model}`;
    const signal = createGeminiTimeoutSignal(input.signal);
    const requests = input.texts.map((text) => ({
      model: modelName,
      content: {
        parts: [{
          text: input.task === "document"
            ? `title: none | text: ${text}`
            : `task: search result | query: ${text}`,
        }],
      },
      embedContentConfig: { outputDimensionality: GEMINI_EMBEDDING_DIMENSIONS },
    }));

    let response: Response;
    try {
      response = await this.fetcher(
        `https://generativelanguage.googleapis.com/v1beta/${modelName}:batchEmbedContents`,
        {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
          body: JSON.stringify({ requests }),
          signal,
        },
      );
    } catch (error) {
      throw geminiTransportFailure(error, signal);
    }

    if (!response.ok) throw geminiHttpFailure(response.status);
    let payload: GeminiEmbeddingResponse;
    try {
      payload = await response.json() as GeminiEmbeddingResponse;
    } catch (error) {
      if (signal.aborted) throw geminiTransportFailure(error, signal);
      throw new MalformedEmbeddingOutputError();
    }

    if (!Array.isArray(payload?.embeddings)
      || payload.embeddings.length !== input.texts.length
      || !payload.embeddings.every((embedding) => isVector(embedding?.values))) {
      throw new MalformedEmbeddingOutputError();
    }
    return payload.embeddings.map((embedding) => embedding.values as number[]);
  }
}
