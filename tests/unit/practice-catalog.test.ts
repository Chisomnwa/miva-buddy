import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, PRACTICE_TOPICS, getNextPracticeProblem, getPracticeProblem, getPracticeProblemsForTopic, getPracticeTopic } from "@/server/practice/catalog";

describe("curated Practice catalog", () => {
  it("has unique IDs and slugs and only canonical LeetCode URLs", () => {
    expect(new Set(PRACTICE_CATALOG.map((problem) => problem.id)).size).toBe(PRACTICE_CATALOG.length);
    expect(new Set(PRACTICE_CATALOG.map((problem) => problem.slug)).size).toBe(PRACTICE_CATALOG.length);
    for (const problem of PRACTICE_CATALOG) {
      const url = new URL(problem.url);
      expect(url.hostname).toBe("leetcode.com");
      expect(url.search).toBe("");
      expect(url.hash).toBe("");
      expect(Object.keys(problem).sort()).toEqual(["difficulty", "id", "slug", "tags", "title", "topics", "url"]);
    }
  });

  it("maps every problem to a supported topic and every topic to at least one problem", () => {
    const topicIds = new Set(PRACTICE_TOPICS.map((topic) => topic.id));
    for (const problem of PRACTICE_CATALOG) {
      expect(problem.topics.length).toBeGreaterThan(0);
      for (const topic of problem.topics) expect(topicIds.has(topic)).toBe(true);
    }
    for (const topic of PRACTICE_TOPICS) expect(getPracticeProblemsForTopic(topic.id).length).toBeGreaterThan(0);
  });

  it("returns only curated catalog entries and rejects unknown keys", () => {
    expect(getPracticeProblem("two-sum")?.id).toBe(1);
    expect(getPracticeProblem("made-up-problem")).toBeNull();
    expect(getPracticeTopic("arrays-hashing")?.label).toBe("Arrays & hashing");
    expect(getPracticeTopic("made-up-topic")).toBeNull();
  });

  it("offers the next curated topic problem without wrapping or inventing entries", () => {
    expect(getNextPracticeProblem("arrays-hashing", 1)?.slug).toBe("contains-duplicate");
    expect(getNextPracticeProblem("graphs-grids", 200)).toBeNull();
    expect(getNextPracticeProblem("trees", 999)).toBeNull();
  });
});
