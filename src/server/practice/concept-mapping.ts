import type { PracticeTopic } from "@/contracts/practice";

const mappings: readonly [RegExp, PracticeTopic][] = [
  [/\b(array|arrays|hashing|hash tables?|hash maps?)\b/i, "arrays-hashing"],
  [/\b(two pointers?|two-pointer)\b/i, "two-pointers"],
  [/\bstack(s)?\b/i, "stack"],
  [/\blinked lists?\b/i, "linked-lists"],
  [/\b(binary search trees?|binary trees?|tree traversal|trees?)\b/i, "trees"],
  [/\bbinary search\b/i, "binary-search"],
  [/\b(graphs?|grids?|islands?)\b/i, "graphs-grids"],
];

export function mapConceptToPracticeTopic(title: string): PracticeTopic | null {
  return mappings.find(([pattern]) => pattern.test(title))?.[1] ?? null;
}
