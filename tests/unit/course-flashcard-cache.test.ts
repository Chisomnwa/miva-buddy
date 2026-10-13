import { describe, expect, it } from "vitest";
import { courseFlashcardCacheKey, readCourseFlashcardCache, writeCourseFlashcardCache } from "@/lib/course-flashcard-cache";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

const deck = { cards: [{ question: "What is a queue?", answer: "A FIFO structure.", highlightTerms: ["FIFO"] }] };

describe("course flashcard session cache", () => {
  it("namespaces cached decks by user, course, material, concept, and source revision", () => {
    const base = { userId: "user-a", courseId: "course", materialId: "material", conceptId: "concept", sourceVersion: "v1" };
    expect(courseFlashcardCacheKey(base)).not.toBe(courseFlashcardCacheKey({ ...base, userId: "user-b" }));
    expect(courseFlashcardCacheKey(base)).not.toBe(courseFlashcardCacheKey({ ...base, conceptId: "other-concept" }));
    expect(courseFlashcardCacheKey(base)).not.toBe(courseFlashcardCacheKey({ ...base, sourceVersion: "v2" }));
  });

  it("reuses a validated deck and ignores malformed cache content", () => {
    const storage = memoryStorage();
    writeCourseFlashcardCache(storage, "deck", deck);
    expect(readCourseFlashcardCache(storage, "deck")).toEqual(deck);
    storage.setItem("invalid", JSON.stringify({ cards: [{ question: "oops" }] }));
    expect(readCourseFlashcardCache(storage, "invalid")).toBeNull();
  });

  it("cleans source footers and leaked citation IDs from legacy cached cards without damaging bracketed code", () => {
    const storage = memoryStorage();
    const leakedId = "3e239071-acfd-41c1-a41b-5cd0878e322";
    storage.setItem("legacy", JSON.stringify({ cards: [{
      question: `What is this? [${leakedId}]`,
      answer: `A Python list: [1, 2]. Citation [${leakedId}] ${leakedId} citationIds: [${leakedId}]`,
      highlightTerms: ["Python", "list"],
      sources: [{ materialTitle: "Lecture 1", pageStart: 2, pageEnd: 2 }],
    }] }));

    expect(readCourseFlashcardCache(storage, "legacy")).toEqual({ cards: [{
      question: "What is this?",
      answer: "A Python list: [1, 2]. Citation",
      highlightTerms: ["Python", "list"],
    }] });
    const rewrittenCache = storage.getItem("legacy") ?? "";
    expect(rewrittenCache).not.toContain("sources");
    expect(rewrittenCache).not.toContain(leakedId);
  });
});
