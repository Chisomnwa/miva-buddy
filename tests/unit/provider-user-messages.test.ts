import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("server-only", () => ({}));

import { learnPublicErrorMessage } from "@/components/learn-composer";
import { groundedPublicErrorMessage } from "@/components/grounded-learn-composer";
import { flashcardErrorMessage } from "@/components/grounded-concept-learning-modes";
import { safeProviderFailureMessage } from "@/server/ai/gemini-provider-errors";

describe("student-facing AI provider failures", () => {
  it("explains provider quota, timeout, temporary outage, and permanent setup/request failures consistently", () => {
    const codes = ["provider_quota", "generation_timeout", "provider_unavailable", "provider_configuration", "provider_rejected"] as const;
    for (const code of codes) {
      const expected = safeProviderFailureMessage(code);
      expect(learnPublicErrorMessage(code)).toBe(expected);
      expect(groundedPublicErrorMessage(code)).toBe(expected);
      expect(expected).not.toMatch(/api.?key|prompt|lecture|stack trace|private/i);
    }
    expect(flashcardErrorMessage("provider_quota")).toMatch(/usage limit/i);
    expect(flashcardErrorMessage("generation_timeout")).toMatch(/try again/i);
  });
});
