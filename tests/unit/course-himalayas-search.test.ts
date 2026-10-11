import { describe, expect, it, vi } from "vitest";
import type { RetrievedCourseChunk } from "@/contracts/grounded-learning";
import type { CourseEvidenceResult } from "@/server/retrieval/course-retrieval";
import type { JobEvidenceProvider } from "@/server/job-evidence/provider";
import { searchCourseHimalayasReferences } from "@/server/job-evidence/course-himalayas";
import { isHimalayasMetadataEnabled } from "@/server/job-evidence/himalayas-provider";

vi.mock("server-only", () => ({}));

function chunk(content: string): RetrievedCourseChunk {
  return {
    chunk_id: "synthetic-chunk-1",
    course_id: "synthetic-course-1",
    material_id: "synthetic-material-1",
    content,
    page_start: 1,
    page_end: 1,
    rank_score: 1,
    semantic_similarity: 0.9,
    lexical_match: true,
    supports_current_concept: true,
  };
}

describe("course-grounded Himalayas search", () => {
  it("sends only canonical skills explicitly present in retrieved course passages", async () => {
    const search = vi.fn().mockResolvedValue({ status: "failed", retryable: true });
    const provider = { search } as unknown as JobEvidenceProvider;
    const evidence: CourseEvidenceResult = {
      status: "supporting_evidence_found",
      chunks: [chunk("Synthetic course passage: SQL queries retrieve relational data.")],
    };

    const result = await searchCourseHimalayasReferences(evidence, true, provider);

    expect(result).toEqual({ status: "failed", retryable: true });
    expect(search).toHaveBeenCalledOnce();
    expect(search).toHaveBeenCalledWith({ terms: ["SQL"] }, undefined);
  });

  it("does not query when the feature is disabled, retrieval lacks support, or no supported skill is present", async () => {
    const search = vi.fn();
    const provider = { search } as unknown as JobEvidenceProvider;

    await expect(searchCourseHimalayasReferences({ status: "no_sufficient_support", chunks: [] }, true, provider))
      .resolves.toBeNull();
    await expect(searchCourseHimalayasReferences({
      status: "supporting_evidence_found", chunks: [chunk("Synthetic lecture discusses binary search trees.")],
    }, false, provider)).resolves.toBeNull();
    await expect(searchCourseHimalayasReferences({
      status: "supporting_evidence_found", chunks: [chunk("Synthetic lecture discusses binary search trees.")],
    }, true, provider)).resolves.toBeNull();

    expect(search).not.toHaveBeenCalled();
  });

  it.each(["production", "test"])("the grounded Learn gate does not query in %s even when the flag is true", async (nodeEnvironment) => {
    const search = vi.fn();
    const provider = { search } as unknown as JobEvidenceProvider;
    const evidence: CourseEvidenceResult = {
      status: "supporting_evidence_found",
      chunks: [chunk("Synthetic course passage: SQL queries retrieve relational data.")],
    };
    const enabled = isHimalayasMetadataEnabled(nodeEnvironment, "true");

    await expect(searchCourseHimalayasReferences(evidence, enabled, provider)).resolves.toBeNull();
    expect(search).not.toHaveBeenCalled();
  });
});
