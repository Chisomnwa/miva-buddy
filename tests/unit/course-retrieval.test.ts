import { describe, expect, it, vi } from "vitest";
import { retrieveCourseEvidence } from "@/server/retrieval/course-retrieval";

vi.mock("server-only", () => ({}));
vi.mock("@/server/embeddings/create-provider", () => ({
  createEmbeddingProvider: () => ({ embed: async ({ texts }: { texts: string[] }) => texts.map(() => Array(768).fill(0.01)) }),
}));

const courseId = "5368fc6f-e63f-43c1-b4aa-d4c9b3a0a89a";
const materialId = "b6b1c717-d39c-4706-9a41-8de5c9e2b105";
const conceptId = "4b563246-5814-4370-ac7a-4125ea6ec66f";
const chunkRows = Array.from({ length: 3 }, (_, index) => ({
  chunk_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  course_id: courseId,
  material_id: materialId,
  content: "Synthetic course passage on binary search trees.",
  page_start: 1,
  page_end: 1,
  rank_score: 0.1 - index / 100,
  semantic_similarity: 0.8,
  lexical_match: true,
  supports_current_concept: true,
}));

describe("course evidence retrieval cancellation", () => {
  it("passes the request deadline to the authenticated retrieval RPC", async () => {
    const abortSignal = vi.fn().mockResolvedValue({ data: chunkRows, error: null });
    const rpc = vi.fn(() => ({ abortSignal }));
    const supabase = { rpc } as unknown as Parameters<typeof retrieveCourseEvidence>[0];
    const signal = AbortSignal.timeout(5_000);

    const result = await retrieveCourseEvidence(supabase, {
      courseId,
      materialId,
      conceptId,
      question: "What does my course material say about binary search trees?",
      signal,
    });

    expect(result.status).toBe("supporting_evidence_found");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(abortSignal).toHaveBeenCalledWith(signal);
  });

  it("fails closed when the request deadline has been aborted", async () => {
    const abortSignal = vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"));
    const supabase = { rpc: vi.fn(() => ({ abortSignal })) } as unknown as Parameters<typeof retrieveCourseEvidence>[0];

    await expect(retrieveCourseEvidence(supabase, {
      courseId,
      materialId,
      conceptId,
      question: "What does my course material say?",
      signal: AbortSignal.timeout(5_000),
    })).rejects.toMatchObject({ name: "CourseRetrievalUnavailableError" });
  });
});
