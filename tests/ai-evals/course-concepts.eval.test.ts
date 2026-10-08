import { beforeAll, describe, expect, it } from "vitest";
import { loadEnvConfig } from "@next/env";
import { conceptExtractionSchema } from "@/contracts/course-material";
import { GeminiGenerationProvider } from "@/server/ai/providers/gemini";
import { extractCourseConcepts } from "@/server/ingestion/concept-extraction";

loadEnvConfig(process.cwd());

const chunkId = "a4fd652e-bc84-433c-8a71-55358f7cf68b";
const model = process.env.GEMINI_MODEL || "models/gemini-3.5-flash-lite";

describe("Gemini Miva Buddy concept extraction evaluation (synthetic course excerpts only)", () => {
  beforeAll(() => {
    if (!process.env.GEMINI_API_KEY) throw new Error("Set GEMINI_API_KEY in ignored .env.local before live AI evaluations.");
  });

  it("returns distinct source-backed concepts using valid source IDs", async () => {
    const provider = new GeminiGenerationProvider(process.env.GEMINI_API_KEY!, model);
    const result = await extractCourseConcepts(provider, [{
      id: chunkId,
      ordinal: 0,
      pageStart: 3,
      pageEnd: 3,
      content: "A binary search tree is a binary tree in which every key in a node's left subtree is smaller than the node's key, while every key in its right subtree is larger. Search follows one branch at each comparison. In a balanced tree, search takes logarithmic time; in a highly skewed tree, search can take linear time.",
    }], AbortSignal.timeout(55_000));
    const parsed = conceptExtractionSchema.parse(result);
    expect(parsed.concepts.length).toBeGreaterThan(0);
    expect(parsed.concepts.length).toBeLessThanOrEqual(6);
    expect(new Set(parsed.concepts.map((concept) => concept.title.toLocaleLowerCase("en-US"))).size).toBe(parsed.concepts.length);
    expect(parsed.concepts.every((concept) => concept.supportingChunkIds.length > 0
      && concept.supportingChunkIds.every((sourceId) => sourceId === chunkId))).toBe(true);
    expect(parsed.concepts.some((concept) => /binary search tree|bst/i.test(concept.title))).toBe(true);
  }, 60_000);
});
