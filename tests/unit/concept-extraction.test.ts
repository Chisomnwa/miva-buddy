import { describe, expect, it } from "vitest";
import { FakeGenerationProvider } from "@/server/ai/providers/fake";
import { MalformedProviderOutputError } from "@/server/ai/provider";
import { extractCourseConcepts, selectConceptEvidence, type ConceptEvidenceChunk } from "@/server/ingestion/concept-extraction";

const chunkId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const chunks: ConceptEvidenceChunk[] = [{
  id: chunkId,
  ordinal: 0,
  pageStart: 2,
  pageEnd: 2,
  content: "Recursion solves a problem by calling the same procedure on a smaller input. A base case stops further recursive calls.",
}];

const response = JSON.stringify({ concepts: [{
  title: "Recursion",
  description: "A procedure solves a smaller instance of the same problem.",
  supportingChunkIds: [chunkId],
}] });

describe("source-backed concept extraction", () => {
  it("accepts structured concepts supported by supplied source IDs", async () => {
    const result = await extractCourseConcepts(new FakeGenerationProvider([response]), chunks, new AbortController().signal);
    expect(result.concepts[0].supportingChunkIds).toEqual([chunkId]);
  });

  it("retries once when a model cites an unknown chunk, then validates the corrected result", async () => {
    const unknown = JSON.stringify({ concepts: [{
      title: "Recursion",
      description: "Calls a smaller instance.",
      supportingChunkIds: ["b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
    }] });
    const result = await extractCourseConcepts(new FakeGenerationProvider([unknown, response]), chunks, new AbortController().signal);
    expect(result.concepts[0].supportingChunkIds).toEqual([chunkId]);
  });

  it("fails safely after two malformed or unsupported responses", async () => {
    await expect(extractCourseConcepts(
      new FakeGenerationProvider(["not json", "still not json"]),
      chunks,
      new AbortController().signal,
    )).rejects.toBeInstanceOf(MalformedProviderOutputError);
  });

  it("bounds evidence context and preserves original ordering and page references", () => {
    const large = Array.from({ length: 100 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      ordinal: index,
      pageStart: index + 1,
      pageEnd: index + 1,
      content: "A representative course passage. ".repeat(30),
    }));
    const selected = selectConceptEvidence(large);
    expect(selected.length).toBeLessThanOrEqual(20);
    expect(selected.reduce((sum, item) => sum + item.content.length, 0)).toBeLessThanOrEqual(16_000);
    expect(selected.map((item) => item.ordinal)).toEqual([...selected.map((item) => item.ordinal)].sort((a, b) => a - b));
  });
});
