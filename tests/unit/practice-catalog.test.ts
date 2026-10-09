import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, PRACTICE_TOPICS, getNextPracticeProblem, getPracticeProblem, getPracticeProblemsForTopic, getPracticeTopic } from "@/server/practice/catalog";

describe("curated Practice catalog", () => {
  it("has unique IDs and slugs and only canonical LeetCode URLs", () => {
    expect(PRACTICE_CATALOG).toHaveLength(107);
    expect(new Set(PRACTICE_CATALOG.map((problem) => problem.id)).size).toBe(PRACTICE_CATALOG.length);
    expect(new Set(PRACTICE_CATALOG.map((problem) => problem.slug)).size).toBe(PRACTICE_CATALOG.length);
    for (const problem of PRACTICE_CATALOG) {
      const url = new URL(problem.url);
      expect(url.hostname).toBe("leetcode.com");
      expect(url.search).toBe("");
      expect(url.hash).toBe("");
      expect(problem.url).toBe(`https://leetcode.com/problems/${problem.slug}/`);
      expect(problem.title).toBe(problem.title.trim());
      expect(problem.title.length).toBeGreaterThan(0);
      expect(["Easy", "Medium", "Hard"]).toContain(problem.difficulty);
      expect(new Set(problem.tags).size).toBe(problem.tags.length);
      expect(Object.keys(problem).sort()).toEqual(["difficulty", "id", "slug", "tags", "title", "topics", "url"]);
    }
  });

  it("maps every problem to a supported topic and every topic to at least one problem", () => {
    expect(PRACTICE_TOPICS).toHaveLength(14);
    const topicIds = new Set(PRACTICE_TOPICS.map((topic) => topic.id));
    expect(topicIds.has("prefix-sum")).toBe(false);
    for (const problem of PRACTICE_CATALOG) {
      expect(problem.topics.length).toBeGreaterThan(0);
      for (const topic of problem.topics) expect(topicIds.has(topic)).toBe(true);
    }
    const expectedCounts = [15, 7, 7, 7, 7, 7, 9, 6, 6, 9, 9, 6, 6, 6];
    for (const [index, topic] of PRACTICE_TOPICS.entries()) {
      const problems = getPracticeProblemsForTopic(topic.id);
      expect(problems).toHaveLength(expectedCounts[index]);
      expect(new Set(problems.map((problem) => problem.id)).size).toBe(problems.length);
    }
  });

  it("keeps legacy session identities and topic IDs accessible", () => {
    const legacy = [
      [1, "two-sum", "arrays-hashing"], [217, "contains-duplicate", "arrays-hashing"],
      [242, "valid-anagram", "arrays-hashing"], [121, "best-time-to-buy-and-sell-stock", "arrays-hashing"],
      [125, "valid-palindrome", "two-pointers"], [20, "valid-parentheses", "stack"],
      [704, "binary-search", "binary-search"], [206, "reverse-linked-list", "linked-lists"],
      [21, "merge-two-sorted-lists", "linked-lists"], [104, "maximum-depth-of-binary-tree", "trees"],
      [226, "invert-binary-tree", "trees"], [200, "number-of-islands", "graphs-grids"],
    ] as const;
    for (const [id, slug, topicId] of legacy) {
      expect(getPracticeProblem(slug)).toMatchObject({ id, slug, topics: [topicId], url: `https://leetcode.com/problems/${slug}/` });
      expect(getPracticeTopic(topicId)).not.toBeNull();
    }
  });

  it("returns only curated catalog entries and rejects unknown keys", () => {
    expect(getPracticeProblem("two-sum")?.id).toBe(1);
    expect(getPracticeProblem("made-up-problem")).toBeNull();
    expect(getPracticeTopic("arrays-hashing")?.label).toBe("Arrays & Hashing");
    expect(getPracticeTopic("prefix-sum")?.id).toBe("arrays-hashing");
    expect(getPracticeTopic("made-up-topic")).toBeNull();
  });

  it("keeps prefix-sum-tagged problems in Arrays & Hashing without reducing the catalog", () => {
    for (const id of [1480, 724, 303, 560, 525, 974]) {
      expect(PRACTICE_CATALOG.find((problem) => problem.id === id)?.topics).toEqual(["arrays-hashing"]);
    }
    expect(getPracticeProblemsForTopic("arrays-hashing")).toHaveLength(15);
    expect(PRACTICE_CATALOG).toHaveLength(107);
  });

  it("offers the next curated topic problem without wrapping or inventing entries", () => {
    expect(getNextPracticeProblem("arrays-hashing", 1)?.slug).toBe("contains-duplicate");
    expect(getNextPracticeProblem("graphs-grids", 200)?.slug).toBe("flood-fill");
    expect(getNextPracticeProblem("tries", 212)).toBeNull();
    expect(getNextPracticeProblem("trees", 999)).toBeNull();
  });
});
