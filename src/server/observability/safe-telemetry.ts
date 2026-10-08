import "server-only";

const operations = ["learn", "grounded_learn", "practice_coaching", "material_processing"] as const;
const providers = ["fake", "ollama", "gemini", "groq", "none", "unknown"] as const;
const outcomes = ["success", "failure", "invalid_output", "cancelled"] as const;

type Operation = (typeof operations)[number];
type Provider = (typeof providers)[number];
type Outcome = (typeof outcomes)[number];

/** Logs bounded operational dimensions only; never pass prompts, IDs, URLs, or raw errors. */
export function recordSafeOperation(input: {
  operation: Operation;
  provider: Provider;
  outcome: Outcome;
  durationMs: number;
}) {
  const durationMs = Number.isFinite(input.durationMs)
    ? Math.max(0, Math.min(600_000, Math.round(input.durationMs)))
    : 0;
  console.info("application_operation", {
    operation: operations.includes(input.operation) ? input.operation : "learn",
    provider: providers.includes(input.provider) ? input.provider : "unknown",
    outcome: outcomes.includes(input.outcome) ? input.outcome : "failure",
    durationMs,
  });
}
