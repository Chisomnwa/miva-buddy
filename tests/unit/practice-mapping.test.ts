import { describe, expect, it } from "vitest";
import { mapConceptToPracticeTopic } from "@/server/practice/concept-mapping";

describe("deterministic Learn-to-Practice mapping", () => {
  it.each([
    ["Binary Search Tree Structure", "trees"],
    ["Binary Search", "binary-search"],
    ["Hash tables", "arrays-hashing"],
    ["Two-pointer traversal", "two-pointers"],
    ["Stack operations", "stack"],
    ["Linked lists", "linked-lists"],
    ["Binary trees", "trees"],
    ["Graph traversal", "graphs-grids"],
  ] as const)("maps %s to %s", (title, topic) => {
    expect(mapConceptToPracticeTopic(title)).toBe(topic);
  });

  it("does not force a Practice path for an unmapped concept", () => {
    expect(mapConceptToPracticeTopic("Ethical implications of computing")).toBeNull();
  });
});
