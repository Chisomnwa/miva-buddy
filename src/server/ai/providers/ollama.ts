import type { GenerationInput, GenerationProvider } from "../provider";
import { MalformedProviderOutputError, ProviderUnavailableError } from "../provider";

export class OllamaGenerationProvider implements GenerationProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async generate(input: GenerationInput): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages: input.messages,
          stream: false,
          format: input.responseSchema,
          options: { temperature: 0.2 },
        }),
        signal: input.signal,
      });
    } catch (error) {
      if (input.signal.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
      throw new ProviderUnavailableError();
    }

    if (!response.ok) throw new ProviderUnavailableError();
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new MalformedProviderOutputError();
    }
    if (!payload || typeof payload !== "object" || !("message" in payload)) {
      throw new MalformedProviderOutputError();
    }
    const message = payload.message;
    if (!message || typeof message !== "object" || !("content" in message) || typeof message.content !== "string") {
      throw new MalformedProviderOutputError();
    }
    return message.content;
  }
}
