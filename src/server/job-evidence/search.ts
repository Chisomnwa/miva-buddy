import { jobEvidenceResultSchema, type JobEvidenceResult } from "@/contracts/job-evidence";
import { EvidenceUseNotAuthorizedError, requireEvidencePermission, type EvidenceUseGrant } from "./permissions";
import type { JobEvidenceProvider, JobEvidenceQuery } from "./provider";

export type EvidencePresentation = "metadata" | "excerpt";

/** Enforce the requested use before any provider request and normalize safe failures. */
export async function searchJobEvidence(
  provider: JobEvidenceProvider,
  query: JobEvidenceQuery,
  grant: EvidenceUseGrant,
  presentation: EvidencePresentation,
  signal?: AbortSignal,
): Promise<JobEvidenceResult> {
  try {
    requireEvidencePermission(grant, "retrieve");
    requireEvidencePermission(grant, "display_metadata");
    if (presentation === "excerpt") requireEvidencePermission(grant, "display_excerpt");
  } catch (error) {
    if (error instanceof EvidenceUseNotAuthorizedError) return { status: "source_not_approved" };
    return { status: "failed", retryable: false };
  }

  try {
    const result: unknown = await provider.search(query, signal);
    const parsed = jobEvidenceResultSchema.safeParse(result);
    return parsed.success ? parsed.data : { status: "failed", retryable: false };
  } catch {
    return { status: "failed", retryable: true };
  }
}
