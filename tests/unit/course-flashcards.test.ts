import { describe, expect, it } from "vitest";
import { classifyCourseFlashcardGenerationError, generateCourseFlashcards, type FlashcardEvidence } from "@/server/ai/course-flashcards";
import type { GenerationProvider } from "@/server/ai/provider";
import { MalformedProviderOutputError, ProviderUnavailableError } from "@/server/ai/provider";

const chunkId = "00000000-0000-4000-8000-000000000001";
const evidence: FlashcardEvidence[] = [{
  chunkId,
  pageStart: 4,
  pageEnd: 5,
  content: "A binary search tree stores keys in sorted order. Smaller keys are placed in the left subtree and larger keys in the right subtree.",
}];

function providerFor(responses: string[]): GenerationProvider & { calls: number; captured?: string } {
  return {
    calls: 0,
    captured: undefined,
    async generate(input) {
      this.captured = input.messages.map((message) => message.content).join("\n");
      return responses[this.calls++] ?? "{}";
    },
  };
}

const response = (cards: unknown[]) => JSON.stringify({ cards });

describe("concept-specific grounded flashcard generation", () => {
  it("generates concise cards only from the selected concept's cited source chunks", async () => {
    const provider = providerFor([response([{
      question: "Where are smaller keys stored in a binary search tree?",
      answer: "Smaller keys are placed in the left subtree.",
      highlightTerms: ["left subtree"],
      citationIds: [chunkId],
    }])]);
    const cards = await generateCourseFlashcards(provider, {
      conceptTitle: "Binary search tree",
      conceptDescription: "Ordering values in a tree.",
      evidence,
      signal: new AbortController().signal,
    });
    expect(cards[0].citationIds).toEqual([chunkId]);
    expect(provider.captured).toContain('"concept"');
    expect(provider.captured).toContain("binary search tree");
    expect(provider.captured).toContain("left subtree");
  });

  it("keeps citations structured while removing leaked identifiers from visible card text", async () => {
    const leakedId = "3e239071-acfd-41c1-a41b-5cd0878e322";
    const provider = providerFor([response([{
      question: `Where are smaller keys stored? [${leakedId}]`,
      answer: `Smaller keys are stored in the left subtree. [${leakedId}]`,
      highlightTerms: ["left subtree"],
      citationIds: [chunkId],
    }])]);
    const cards = await generateCourseFlashcards(provider, {
      conceptTitle: "Binary search tree", conceptDescription: "Ordering values in a tree.", evidence, signal: new AbortController().signal,
    });
    expect(cards[0]).toEqual({
      question: "Where are smaller keys stored?",
      answer: "Smaller keys are stored in the left subtree.",
      highlightTerms: ["left subtree"],
      citationIds: [chunkId],
    });
  });

  it("rejects unsupported citation IDs and retries once", async () => {
    const provider = providerFor([
      response([{ question: "What is the red-black invariant?", answer: "This guarantees balancing.", highlightTerms: ["balancing"], citationIds: ["00000000-0000-4000-8000-000000000099"] }]),
      response([{ question: "Where are smaller keys stored?", answer: "Smaller keys are placed in the left subtree.", highlightTerms: ["left subtree"], citationIds: [chunkId] }]),
    ]);
    const cards = await generateCourseFlashcards(provider, {
      conceptTitle: "Binary search tree", conceptDescription: "Ordering values.", evidence, signal: new AbortController().signal,
    });
    expect(provider.calls).toBe(2);
    expect(cards).toHaveLength(1);
  });

  it("rejects a cited answer with no lexical support instead of presenting it as grounded", async () => {
    const provider = providerFor([response([
      { question: "How does quantum tunneling work?", answer: "Quantum tunneling changes electron probability.", highlightTerms: ["Quantum"], citationIds: [chunkId] },
    ]), response([
      { question: "How does quantum tunneling work?", answer: "Quantum tunneling changes electron probability.", highlightTerms: ["Quantum"], citationIds: [chunkId] },
    ])]);
    await expect(generateCourseFlashcards(provider, {
      conceptTitle: "Binary search tree", conceptDescription: "Ordering values.", evidence, signal: new AbortController().signal,
    })).rejects.toThrow("Generation provider returned malformed output");
    expect(provider.calls).toBe(2);
  });

  it("returns no cards for insufficient source material and does not call the provider", async () => {
    const provider = providerFor([]);
    const cards = await generateCourseFlashcards(provider, {
      conceptTitle: "Binary search tree", conceptDescription: "Ordering values.",
      evidence: [{ ...evidence[0], content: "A short note." }], signal: new AbortController().signal,
    });
    expect(cards).toEqual([]);
    expect(provider.calls).toBe(0);
  });

  it("classifies safe failure categories without relying on provider response text", () => {
    expect(classifyCourseFlashcardGenerationError(new DOMException("deadline elapsed", "TimeoutError"))).toBe("generation_timeout");
    expect(classifyCourseFlashcardGenerationError(new ProviderUnavailableError(429))).toBe("provider_quota");
    expect(classifyCourseFlashcardGenerationError(new ProviderUnavailableError(403))).toBe("provider_configuration");
    expect(classifyCourseFlashcardGenerationError(new ProviderUnavailableError(400))).toBe("provider_rejected");
    expect(classifyCourseFlashcardGenerationError(new ProviderUnavailableError(503))).toBe("provider_unavailable");
    expect(classifyCourseFlashcardGenerationError(new MalformedProviderOutputError())).toBe("invalid_generation");
    expect(classifyCourseFlashcardGenerationError(new Error("sensitive provider detail"))).toBe("generation_unavailable");
  });
});
