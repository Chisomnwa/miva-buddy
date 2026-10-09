import type { PracticeTopic } from "@/contracts/practice";

const mappings: readonly [RegExp, PracticeTopic][] = [
  [/\bsliding window\b/i, "sliding-window"],
  [/\b(array|arrays|hashing|hash tables?|hash maps?)\b/i, "arrays-hashing"],
  [/\b(two pointers?|two-pointer)\b/i, "two-pointers"],
  [/\bbacktracking\b/i, "backtracking"],
  [/\b(heaps?|priority queues?)\b/i, "heaps-priority-queues"],
  [/\bstack(s)?\b/i, "stack"],
  [/\blinked lists?\b/i, "linked-lists"],
  [/\btries\b|\btrie\b|\bprefix tree\b/i, "tries"],
  [/\b(binary search trees?|binary trees?|tree traversal|trees?)\b/i, "trees"],
  [/\bbinary search\b/i, "binary-search"],
  [/\b(graphs?|grids?|islands?)\b/i, "graphs-grids"],
  [/\b(dynamic programming|memoization)\b/i, "dynamic-programming"],
  [/\bgreedy algorithms?\b/i, "greedy"],
  [/\bintervals?\b/i, "intervals"],
  [/\bprefix sums?\b/i, "arrays-hashing"],
];

export function mapConceptToPracticeTopic(title: string): PracticeTopic | null {
  return mappings.find(([pattern]) => pattern.test(title))?.[1] ?? null;
}
