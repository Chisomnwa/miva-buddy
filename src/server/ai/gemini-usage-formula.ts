export const DEFAULT_GEMINI_INTERACTIVE_USER_DAILY_UNITS = 120;
export const DEFAULT_GEMINI_BACKGROUND_USER_DAILY_UNITS = 600;
export const DEFAULT_GEMINI_INTERACTIVE_APP_DAILY_UNITS = 5_000;
export const DEFAULT_GEMINI_BACKGROUND_APP_DAILY_UNITS = 20_000;
export const DEFAULT_GEMINI_TOTAL_APP_DAILY_UNITS = 25_000;
export const DEFAULT_GEMINI_IN_FLIGHT_LIMIT = 4;
export const GEMINI_USAGE_LEASE_SECONDS = 120;

export type GeminiUsageCategory = "interactive" | "background";

const estimatedCharactersPerToken = 3;
const usageUnitTokens = 1_000;

function unitsForTokens(tokens: number) {
  return Math.max(1, Math.ceil(tokens / usageUnitTokens));
}

/** Estimate input tokens conservatively from UTF-16 text length, plus the full output cap. */
export function estimateGeminiGenerationUnits(input: {
  messages: Array<{ role: string; content: string }>;
  responseSchema: Record<string, unknown>;
  maxTokens?: number;
}) {
  const inputCharacters = JSON.stringify({ messages: input.messages, responseSchema: input.responseSchema }).length;
  const estimatedInputTokens = Math.ceil(inputCharacters / estimatedCharactersPerToken);
  return unitsForTokens(estimatedInputTokens + (input.maxTokens ?? 900));
}

/** Each embedding request is budgeted independently; even a small request costs one unit. */
export function estimateGeminiEmbeddingUnits(texts: string[]) {
  // Include room for the provider's task/title wrapper around every submitted text.
  const estimatedInputTokens = Math.ceil(texts.reduce((total, text) => total + text.length + 32, 0) / estimatedCharactersPerToken);
  return unitsForTokens(estimatedInputTokens);
}
