import type { JobEvidenceResult } from "@/contracts/job-evidence";
import type { CourseEvidenceResult } from "@/server/retrieval/course-retrieval";
import { skillsExplicitlyInCourse } from "@/server/job-evidence/skills";
import { himalayasMetadataGrant } from "@/server/job-evidence/himalayas-provider";
import { searchJobEvidence } from "@/server/job-evidence/search";
import type { JobEvidenceProvider } from "@/server/job-evidence/provider";

/** Search only when retrieval found supporting passages, using canonical terms from those passages alone. */
export async function searchCourseHimalayasReferences(
  evidence: CourseEvidenceResult,
  enabled: boolean,
  provider: JobEvidenceProvider,
  signal?: AbortSignal,
): Promise<JobEvidenceResult | null> {
  if (!enabled || evidence.status !== "supporting_evidence_found") return null;

  const terms = skillsExplicitlyInCourse(evidence.chunks);
  if (terms.length === 0) return null;

  return searchJobEvidence(provider, { terms }, himalayasMetadataGrant, "metadata", signal);
}
