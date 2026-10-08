import { describe, expect, it } from "vitest";
import { groundedLearnResponseSchema } from "@/contracts/grounded-learning";
import { conceptExtractionSchema } from "@/contracts/course-material";
import { FakeGenerationProvider } from "@/server/ai/providers/fake";
import { groundedLearnJsonSchema } from "@/server/ai/grounded-learning";
import { conceptExtractionJsonSchema } from "@/server/ingestion/concept-extraction";

describe("development fake generation provider contracts", () => {
  it("returns a concept tied to an ID in the supplied evidence", async () => {
    const id = "b8a891c2-933f-4f76-a69c-5d16a7fe4537";
    const content = "A binary search tree stores smaller keys in the left subtree.";
    const raw = await new FakeGenerationProvider().generate({
      messages: [{ role: "user", content: JSON.stringify({ excerpts: [{ id, content }] }) }],
      responseSchema: conceptExtractionJsonSchema,
      signal: AbortSignal.timeout(1_000),
    });

    expect(conceptExtractionSchema.parse(JSON.parse(raw)).concepts[0].supportingChunkIds).toEqual([id]);
  });

  it("returns a grounded response citing only supplied source IDs", async () => {
    const id = "b8a891c2-933f-4f76-a69c-5d16a7fe4537";
    const content = "A binary search tree stores smaller keys in the left subtree.";
    const raw = await new FakeGenerationProvider().generate({
      messages: [{ role: "user", content: JSON.stringify({ courseExcerpts: [{ chunk_id: id, content }] }) }],
      responseSchema: groundedLearnJsonSchema,
      signal: AbortSignal.timeout(1_000),
    });

    const result = groundedLearnResponseSchema.parse(JSON.parse(raw));
    expect(result.segments[0]).toMatchObject({ kind: "grounded", citationIds: [id] });
    expect(result.segments[0].content).toContain(content);
  });
});
