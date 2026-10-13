import "server-only";

const operations = ["learn", "grounded_learn", "course_flashcards", "practice_coaching", "material_processing"] as const;
const providers = ["fake", "ollama", "gemini", "groq", "none", "unknown"] as const;
const outcomes = ["success", "failure", "invalid_output", "cancelled"] as const;
const failureCategories = [
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

type Operation = (typeof operations)[number];
type Provider = (typeof providers)[number];
type Outcome = (typeof outcomes)[number];
export type SafeFailureCategory = (typeof failureCategories)[number];

/** Logs bounded operational dimensions only; never pass prompts, IDs, URLs, or raw errors. */
export function recordSafeOperation(input: {
  operation: Operation;
  provider: Provider;
  outcome: Outcome;
  durationMs: number;
  failureCategory?: SafeFailureCategory;
}) {
  const durationMs = Number.isFinite(input.durationMs)
    ? Math.max(0, Math.min(600_000, Math.round(input.durationMs)))
    : 0;
  const event = {
    operation: operations.includes(input.operation) ? input.operation : "learn",
    provider: providers.includes(input.provider) ? input.provider : "unknown",
    outcome: outcomes.includes(input.outcome) ? input.outcome : "failure",
    durationMs,
    ...(input.failureCategory === undefined ? {} : {
      failureCategory: failureCategories.includes(input.failureCategory) ? input.failureCategory : "unexpected",
    }),
  };
  console.info("application_operation", event);
}
