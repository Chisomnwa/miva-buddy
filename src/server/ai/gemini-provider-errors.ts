import { EmbeddingProviderUnavailableError } from "@/server/embeddings/provider";
import { ProviderUnavailableError } from "./provider";

export const GEMINI_PROVIDER_TIMEOUT_MS = 45_000;

export type GeminiFailureCategory = "rate_limit" | "timeout" | "temporary_failure" | "configuration" | "request";
export type SafeProviderFailureCode = "provider_quota" | "generation_timeout" | "provider_unavailable" | "provider_configuration" | "provider_rejected";

export class GeminiProviderError extends Error {
  constructor(readonly category: GeminiFailureCategory) {
    super("Gemini request failed safely");
    this.name = "GeminiProviderError";
  }
}

export function createGeminiTimeoutSignal(parent: AbortSignal): AbortSignal {
  return AbortSignal.any([parent, AbortSignal.timeout(GEMINI_PROVIDER_TIMEOUT_MS)]);
}

export function geminiHttpFailure(status: number): GeminiProviderError {
  if (status === 429) return new GeminiProviderError("rate_limit");
  if (status === 408) return new GeminiProviderError("timeout");
  if (status === 401 || status === 403) return new GeminiProviderError("configuration");
  if (status >= 500) return new GeminiProviderError("temporary_failure");
  return new GeminiProviderError("request");
}

export function geminiTransportFailure(error: unknown, signal: AbortSignal): unknown {
  const reason = signal.reason;
  if ((reason instanceof Error && reason.name === "TimeoutError")
    || (error instanceof Error && error.name === "TimeoutError")) {
    return new GeminiProviderError("timeout");
  }
  if (signal.aborted) return error;
  return new GeminiProviderError("temporary_failure");
}

export function classifySafeProviderFailure(error: unknown): { code: SafeProviderFailureCode; status: number } | null {
  if (error instanceof GeminiProviderError) {
    switch (error.category) {
      case "rate_limit": return { code: "provider_quota", status: 429 };
      case "timeout": return { code: "generation_timeout", status: 504 };
      case "temporary_failure": return { code: "provider_unavailable", status: 503 };
      case "configuration": return { code: "provider_configuration", status: 503 };
      case "request": return { code: "provider_rejected", status: 502 };
    }
  }
  if (error instanceof ProviderUnavailableError || error instanceof EmbeddingProviderUnavailableError) {
    if (error.statusCode === 429) return { code: "provider_quota", status: 429 };
    if (error.statusCode === 408) return { code: "generation_timeout", status: 504 };
    if (error.statusCode === 401 || error.statusCode === 403) return { code: "provider_configuration", status: 503 };
    if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
      return { code: "provider_rejected", status: 502 };
    }
    return { code: "provider_unavailable", status: 503 };
  }
  return null;
}

export function safeProviderFailureMessage(code: SafeProviderFailureCode): string {
  switch (code) {
    case "provider_quota": return "The AI service is at its current usage limit. Please try again later.";
    case "generation_timeout": return "That took longer than expected. Please try again shortly.";
    case "provider_unavailable": return "The AI service is temporarily unavailable. Please try again shortly.";
    case "provider_configuration": return "AI is temporarily unavailable. Please try again later.";
    case "provider_rejected": return "We couldn’t process that request safely. Please rephrase and try again.";
  }
}
