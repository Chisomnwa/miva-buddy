import type { EmbeddingInput, EmbeddingProvider } from "../provider";
import { EmbeddingProviderUnavailableError, MalformedEmbeddingOutputError } from "../provider";

function validVectors(value: unknown, expectedCount: number): value is number[][] {
  if (!Array.isArray(value) || value.length !== expectedCount || expectedCount === 0) return false;
  if (!value.every((vector) => Array.isArray(vector) && vector.length > 0
    && vector.every((component) => typeof component === "number" && Number.isFinite(component)))) return false;
  const dimensions = new Set(value.map((vector) => vector.length));
  return dimensions.size === 1;
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async embed(input: EmbeddingInput): Promise<number[][]> {
    if (input.texts.length === 0) return [];

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/embed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: this.model, input: input.texts }),
        signal: input.signal,
      });
    } catch (error) {
      if (input.signal.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
      throw new EmbeddingProviderUnavailableError();
    }

    if (!response.ok) throw new EmbeddingProviderUnavailableError(response.status);
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new MalformedEmbeddingOutputError();
    }
    if (!payload || typeof payload !== "object" || !("embeddings" in payload)
      || !validVectors(payload.embeddings, input.texts.length)) {
      throw new MalformedEmbeddingOutputError();
    }
    return payload.embeddings;
  }
}
