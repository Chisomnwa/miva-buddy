export type GenerationRole = "system" | "user" | "assistant";

export type GenerationMessage = {
  role: GenerationRole;
  content: string;
};

export type GenerationInput = {
  messages: GenerationMessage[];
  responseSchema: Record<string, unknown>;
  signal: AbortSignal;
  maxTokens?: number;
  /** Authenticated owner for server-side Gemini usage accounting; never sent to the model. */
  usageUserId?: string;
  /** Explicit budget bucket for Gemini; absent values fail closed in its wrapper. */
  usageCategory?: "interactive" | "background";
};

export interface GenerationProvider {
  generate(input: GenerationInput): Promise<string>;
}

export class ProviderUnavailableError extends Error {
  constructor(readonly statusCode?: number) {
    super("Generation provider unavailable");
    this.name = "ProviderUnavailableError";
  }
}

export class MalformedProviderOutputError extends Error {
  constructor() {
    super("Generation provider returned malformed output");
    this.name = "MalformedProviderOutputError";
  }
}
