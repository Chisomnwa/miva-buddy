export type EmbeddingInput = {
  texts: string[];
  signal: AbortSignal;
};

export interface EmbeddingProvider {
  embed(input: EmbeddingInput): Promise<number[][]>;
}

export class EmbeddingProviderUnavailableError extends Error {
  constructor(readonly statusCode?: number) {
    super("Embedding provider unavailable");
    this.name = "EmbeddingProviderUnavailableError";
  }
}

export class MalformedEmbeddingOutputError extends Error {
  constructor() {
    super("Embedding provider returned malformed output");
    this.name = "MalformedEmbeddingOutputError";
  }
}
