export type Freshness = "fresh" | "stale" | "invalid";

/** Future timestamps and malformed values fail closed rather than appearing fresh. */
export function checkEvidenceFreshness(
  retrievedAt: string,
  now: Date,
  maxAgeMs: number,
): Freshness {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0) return "invalid";
  const retrieved = Date.parse(retrievedAt);
  const current = now.getTime();
  if (!Number.isFinite(retrieved) || retrieved > current) return "invalid";
  return current - retrieved <= maxAgeMs ? "fresh" : "stale";
}
