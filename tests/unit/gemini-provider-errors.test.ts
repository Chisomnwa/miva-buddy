import { describe, expect, it } from "vitest";
import { GeminiProviderError, classifySafeProviderFailure, safeProviderFailureMessage } from "@/server/ai/gemini-provider-errors";
import { ProviderUnavailableError } from "@/server/ai/provider";
import { EmbeddingProviderUnavailableError } from "@/server/embeddings/provider";

describe("safe Gemini provider failures", () => {
  it.each([
    [new GeminiProviderError("rate_limit"), { code: "provider_quota", status: 429 }],
    [new GeminiProviderError("timeout"), { code: "generation_timeout", status: 504 }],
    [new GeminiProviderError("temporary_failure"), { code: "provider_unavailable", status: 503 }],
    [new GeminiProviderError("configuration"), { code: "provider_configuration", status: 503 }],
    [new GeminiProviderError("request"), { code: "provider_rejected", status: 502 }],
    [new ProviderUnavailableError(429), { code: "provider_quota", status: 429 }],
    [new EmbeddingProviderUnavailableError(503), { code: "provider_unavailable", status: 503 }],
  ])("maps generation and embedding failures to bounded client categories", (error, expected) => {
    expect(classifySafeProviderFailure(error)).toEqual(expected);
  });

  it("provides safe, actionable copy without including provider details", () => {
    for (const code of ["provider_quota", "generation_timeout", "provider_unavailable", "provider_configuration", "provider_rejected"] as const) {
      const message = safeProviderFailureMessage(code);
      expect(message.length).toBeGreaterThan(12);
      expect(message).not.toMatch(/api.?key|prompt|lecture|stack|provider response/i);
    }
    expect(classifySafeProviderFailure(new Error("private provider response"))).toBeNull();
  });
});
