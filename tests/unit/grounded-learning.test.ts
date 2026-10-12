import { describe, expect, it, vi } from "vitest";
import { generateGroundedLearningReply } from "@/server/ai/grounded-learning";
import type { GenerationProvider } from "@/server/ai/provider";
import type { RetrievedCourseChunk } from "@/contracts/grounded-learning";

const sourceId = "00000000-0000-4000-8000-000000000001";
const chunk: RetrievedCourseChunk = {
  chunk_id: sourceId,
  course_id: "00000000-0000-4000-8000-000000000002",
  material_id: "00000000-0000-4000-8000-000000000003",
  content: "A binary search tree stores smaller keys to the left and larger keys to the right.",
  page_start: 4,
  page_end: 4,
  rank_score: 0.04,
  semantic_similarity: 0.8,
  lexical_match: true,
  supports_current_concept: true,
};

function providerWith(responses: string[]): GenerationProvider & { calls: number } {
  return {
    calls: 0,
    async generate() {
      const response = responses[this.calls];
      this.calls += 1;
      return response ?? "{}";
    },
  };
}

const reply = (segments: unknown[]) => JSON.stringify({ segments, followUpQuestions: [] });

describe("grounded learning response contract", () => {
  it("prompts for a complete FIFO dry run and preserves source versus illustrative segments", async () => {
    const dryRun = [
      "Illustrative dry run (A, B, and C are example values, not a trace from the lecture):",
      "```text",
      "Enqueue A -> [A]",
      "Enqueue B -> [A, B]",
      "Enqueue C -> [A, B, C]",
      "Dequeue A -> [B, C]",
      "Dequeue B -> [C]",
      "Dequeue C -> []",
      "```",
    ].join("\n");
    let capturedMessages: { role: string; content: string }[] = [];
    const provider: GenerationProvider = {
      async generate(input) {
        capturedMessages = input.messages;
        return reply([
          { kind: "grounded", content: "A FIFO queue removes the item that was added first.", citationIds: [sourceId] },
          { kind: "additional", content: dryRun, citationIds: [] },
        ]);
      },
    };
    const fifoChunk = {
      ...chunk,
      content: "A FIFO queue removes the item that was added first.",
    };

    const result = await generateGroundedLearningReply(provider, {
      question: "Walk me through enqueueing A, B, and C, then dequeue each one. Show every queue state through empty.",
      excerpts: [fifoChunk], history: [], signal: new AbortController().signal,
    });

    expect(capturedMessages[0].content).toContain("show every relevant step in order");
    expect(capturedMessages[0].content).toContain("Complete the example through its final state");
    expect(capturedMessages[0].content).toContain("Format the sequence as numbered steps");
    expect(capturedMessages[0].content).toContain("fenced text-based state trace");
    expect(capturedMessages[0].content).toContain("Keep ordinary answers concise");
    expect(result.segments).toEqual([
      { kind: "grounded", content: "A FIFO queue removes the item that was added first.", citationIds: [sourceId] },
      { kind: "additional", content: dryRun, citationIds: [] },
    ]);
    for (const state of ["Enqueue A -> [A]", "Enqueue B -> [A, B]", "Enqueue C -> [A, B, C]", "Dequeue A -> [B, C]", "Dequeue B -> [C]", "Dequeue C -> []"]) {
      expect(result.segments[1].content).toContain(state);
    }
  });

  it("accepts grounded claims citing only retrieved source IDs and uncited additional explanation", async () => {
    const provider = providerWith([reply([
      { kind: "grounded", content: "Smaller keys are stored on the left.", citationIds: [sourceId] },
      { kind: "additional", content: "This makes ordered lookup efficient.", citationIds: [] },
    ])]);

    const result = await generateGroundedLearningReply(provider, {
      question: "Where do smaller keys go?", excerpts: [chunk], history: [], signal: new AbortController().signal,
    });

    expect(result.segments[0]).toMatchObject({ kind: "grounded", citationIds: [sourceId] });
    expect(result.segments[1]).toMatchObject({ kind: "additional", citationIds: [] });
    expect(provider.calls).toBe(1);
  });

  it("retries an unknown citation once, then rejects it if it remains invalid", async () => {
    const provider = providerWith([reply([
      { kind: "grounded", content: "Unsupported source.", citationIds: ["00000000-0000-4000-8000-000000000099"] },
    ])]);

    await expect(generateGroundedLearningReply(provider, {
      question: "What does the material say?", excerpts: [chunk], history: [], signal: new AbortController().signal,
    })).rejects.toThrow("Generation provider returned malformed output");
    expect(provider.calls).toBe(2);
  });

  it("never accepts a grounded segment when retrieval found no supporting evidence", async () => {
    const provider = providerWith([reply([
      { kind: "grounded", content: "A claimed course fact.", citationIds: [sourceId] },
    ])]);

    await expect(generateGroundedLearningReply(provider, {
      question: "What does the document say?", excerpts: [], history: [], signal: new AbortController().signal,
    })).rejects.toThrow("Generation provider returned malformed output");
  });

  it("deterministically replaces general claims when a material-specific question has no cited support", async () => {
    const provider = providerWith([reply([
      { kind: "additional", content: "Balanced trees use rotations to stay balanced.", citationIds: [] },
    ])]);

    const result = await generateGroundedLearningReply(provider, {
      question: "What does my handout specifically say about balancing?", excerpts: [chunk], history: [], signal: new AbortController().signal,
    });

    expect(result.segments).toEqual([{
      kind: "no_support",
      content: "I could not find enough information in the available course material to answer what it specifically says.",
      citationIds: [],
    }]);
  });

  it("downgrades a valid but lexically unsupported citation rather than attributing it to course material", async () => {
    const provider = providerWith([reply([
      { kind: "grounded", content: "Red-black trees use colors and rotations to preserve balance.", citationIds: [sourceId] },
    ])]);

    const result = await generateGroundedLearningReply(provider, {
      question: "Explain a related data structure.", excerpts: [chunk], history: [], signal: new AbortController().signal,
    });

    expect(result.segments).toEqual([{
      kind: "additional",
      content: "Red-black trees use colors and rotations to preserve balance.",
      citationIds: [],
    }]);
  });
});

vi.mock("server-only", () => ({}));
vi.mock("@/server/embeddings/create-provider", () => ({
  createEmbeddingProvider: () => ({ modelId: "fake-v1", embed: async () => [Array.from({ length: 768 }, () => 0.1)] }),
}));

describe("course retrieval scope and outcomes", () => {
  it("starts with the selected material and broadens only within the active course", async () => {
    const { retrieveCourseEvidence } = await import("@/server/retrieval/course-retrieval");
    const calls: Record<string, unknown>[] = [];
    const rows = [1, 2, 3].map((number) => ({
      ...chunk,
      chunk_id: `00000000-0000-4000-8000-00000000000${number}`,
      page_start: number,
      page_end: number,
    }));
    const supabase = {
      rpc: vi.fn((_name: string, args: Record<string, unknown>) => {
        calls.push(args);
        return { abortSignal: async () => ({ data: rows, error: null }) };
      }),
    } as never;

    const result = await retrieveCourseEvidence(supabase, {
      courseId: chunk.course_id,
      materialId: chunk.material_id,
      conceptId: "00000000-0000-4000-8000-000000000004",
      question: "binary tree left", signal: new AbortController().signal,
    });

    expect(result.status).toBe("supporting_evidence_found");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ p_course_id: chunk.course_id, p_material_id: chunk.material_id });
  });

  it("returns an explicit no-support state when scoped retrieval has no matching passages", async () => {
    const { retrieveCourseEvidence } = await import("@/server/retrieval/course-retrieval");
    const calls: Record<string, unknown>[] = [];
    const supabase = {
      rpc: vi.fn((_name: string, args: Record<string, unknown>) => {
        calls.push(args);
        return { abortSignal: async () => ({ data: [], error: null }) };
      }),
    } as never;

    const result = await retrieveCourseEvidence(supabase, {
      courseId: chunk.course_id,
      materialId: chunk.material_id,
      conceptId: "00000000-0000-4000-8000-000000000004",
      question: "unrelated question", signal: new AbortController().signal,
    });

    expect(result).toEqual({ status: "no_sufficient_support", chunks: [] });
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.p_material_id)).toEqual([chunk.material_id, null]);
    expect(calls.every((call) => call.p_course_id === chunk.course_id)).toBe(true);
  });

  it("retains relevant evidence and ranks the concept's current material before broader course results", async () => {
    const { retrieveCourseEvidence } = await import("@/server/retrieval/course-retrieval");
    const currentMaterial = { ...chunk, rank_score: 0.03 };
    const otherMaterial = {
      ...chunk,
      chunk_id: "00000000-0000-4000-8000-000000000005",
      material_id: "00000000-0000-4000-8000-000000000006",
      rank_score: 0.039,
      supports_current_concept: false,
    };
    const supabase = {
      rpc: vi.fn((_name: string, args: Record<string, unknown>) => ({
        abortSignal: async () => ({ data: args.p_material_id ? [currentMaterial] : [otherMaterial, currentMaterial], error: null }),
      })),
    } as never;

    const result = await retrieveCourseEvidence(supabase, {
      courseId: chunk.course_id,
      materialId: chunk.material_id,
      conceptId: "00000000-0000-4000-8000-000000000004",
      question: "binary tree left", signal: new AbortController().signal,
    });

    expect(result.status).toBe("supporting_evidence_found");
    expect(result.chunks.map((item) => item.chunk_id)).toEqual([chunk.chunk_id, otherMaterial.chunk_id]);
    expect(result.chunks[0].material_id).toBe(chunk.material_id);
    expect(result.chunks.some((item) => item.content.includes("binary search tree"))).toBe(true);
  });

  it("rejects semantically weak and lexically unrelated passages as insufficient support", async () => {
    const { retrieveCourseEvidence } = await import("@/server/retrieval/course-retrieval");
    const unrelated = { ...chunk, semantic_similarity: 0.12, lexical_match: false };
    const supabase = {
      rpc: vi.fn(() => ({ abortSignal: async () => ({ data: [unrelated], error: null }) })),
    } as never;

    const result = await retrieveCourseEvidence(supabase, {
      courseId: chunk.course_id,
      materialId: chunk.material_id,
      conceptId: "00000000-0000-4000-8000-000000000004",
      question: "unrelated astronomy question", signal: new AbortController().signal,
    });

    expect(result).toEqual({ status: "no_sufficient_support", chunks: [] });
  });
});
