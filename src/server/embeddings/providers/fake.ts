import type { EmbeddingInput, EmbeddingProvider } from "../provider";

export class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly modelId = "fake-v1";

  async embed(input: EmbeddingInput): Promise<number[][]> {
    if (input.signal.aborted) throw new DOMException("Aborted", "AbortError");
    return input.texts.map((text) => {
      const vector = Array.from({ length: 768 }, (_, index) => {
        let value = index + 1;
        for (let position = index; position < text.length; position += 8) {
          value = (value * 31 + text.charCodeAt(position)) % 1_000_003;
        }
        return value / 1_000_003;
      });
      return vector;
    });
  }
}
