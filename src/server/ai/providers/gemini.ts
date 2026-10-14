import type { GenerationInput, GenerationProvider } from "../provider";
import { MalformedProviderOutputError } from "../provider";
import { createGeminiTimeoutSignal, geminiHttpFailure, geminiTransportFailure } from "../gemini-provider-errors";

const endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

export class GeminiGenerationProvider implements GenerationProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generate(input: GenerationInput): Promise<string> {
    const signal = createGeminiTimeoutSignal(input.signal);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages: input.messages,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "miva_learn_response",
              strict: true,
              schema: input.responseSchema,
            },
          },
          max_tokens: input.maxTokens ?? 900,
        }),
        signal,
      });
    } catch (error) {
      throw geminiTransportFailure(error, signal);
    }

    if (!response.ok) throw geminiHttpFailure(response.status);
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (signal.aborted) throw geminiTransportFailure(error, signal);
      throw new MalformedProviderOutputError();
    }
    if (!payload || typeof payload !== "object" || !("choices" in payload) || !Array.isArray(payload.choices)) {
      throw new MalformedProviderOutputError();
    }
    const choice = payload.choices[0];
    if (!choice || typeof choice !== "object" || !("message" in choice)) {
      throw new MalformedProviderOutputError();
    }
    const message = choice.message;
    if (!message || typeof message !== "object" || !("content" in message) || typeof message.content !== "string") {
      throw new MalformedProviderOutputError();
    }
    return message.content;
  }
}
