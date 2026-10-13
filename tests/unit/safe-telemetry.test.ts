import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { recordSafeOperation } from "@/server/observability/safe-telemetry";

describe("safe operation telemetry", () => {
  afterEach(() => vi.restoreAllMocks());

  it("records only allow-listed failure categories", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const categories = [
      "timeout",
      "provider_network",
      "provider_usage_limit",
      "provider_configuration",
      "provider_rejected",
      "invalid_generation",
      "rate_limited",
      "sources_unavailable",
      "unexpected",
      "cancelled",
    ] as const;

    for (const failureCategory of categories) {
      recordSafeOperation({
        operation: "course_flashcards",
        provider: "gemini",
        outcome: "failure",
        durationMs: 12,
        failureCategory,
      });
    }

    expect(info).toHaveBeenCalledTimes(categories.length);
    expect(info.mock.calls.map(([, event]) => (event as { failureCategory: string }).failureCategory)).toEqual(categories);
  });

  it("normalizes unexpected categories without logging their supplied value", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    recordSafeOperation({
      operation: "course_flashcards",
      provider: "gemini",
      outcome: "failure",
      durationMs: 12,
      failureCategory: "sensitive raw detail" as never,
    });

    expect(info).toHaveBeenCalledWith("application_operation", expect.objectContaining({ failureCategory: "unexpected" }));
    expect(JSON.stringify(info.mock.calls)).not.toContain("sensitive raw detail");
  });
});
