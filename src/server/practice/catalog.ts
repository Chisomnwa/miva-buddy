import { practiceProblemSchema, practiceTopicSchema, type PracticeProblem, type PracticeTopic } from "@/contracts/practice";

export const PRACTICE_TOPICS: readonly { id: PracticeTopic; label: string; description: string }[] = [
  { id: "arrays-hashing", label: "Arrays & hashing", description: "Build fluency with arrays, strings, and lookup structures." },
  { id: "two-pointers", label: "Two pointers", description: "Use coordinated positions to reason across sequences." },
  { id: "stack", label: "Stacks", description: "Track nested or most-recent state." },
  { id: "binary-search", label: "Binary search", description: "Narrow a sorted search space efficiently." },
  { id: "linked-lists", label: "Linked lists", description: "Work with node references and list structure." },
  { id: "trees", label: "Trees", description: "Explore recursive and breadth-first tree patterns." },
  { id: "graphs-grids", label: "Graphs & grids", description: "Traverse connected cells and graph-shaped data." },
];

const catalog = [
  { id: 1, slug: "two-sum", title: "Two Sum", difficulty: "Easy", url: "https://leetcode.com/problems/two-sum/", tags: ["Array", "Hash Table"], topics: ["arrays-hashing"] },
  { id: 217, slug: "contains-duplicate", title: "Contains Duplicate", difficulty: "Easy", url: "https://leetcode.com/problems/contains-duplicate/", tags: ["Array", "Hash Table", "Sorting"], topics: ["arrays-hashing"] },
  { id: 242, slug: "valid-anagram", title: "Valid Anagram", difficulty: "Easy", url: "https://leetcode.com/problems/valid-anagram/", tags: ["Hash Table", "String", "Sorting"], topics: ["arrays-hashing"] },
  { id: 125, slug: "valid-palindrome", title: "Valid Palindrome", difficulty: "Easy", url: "https://leetcode.com/problems/valid-palindrome/", tags: ["Two Pointers", "String"], topics: ["two-pointers"] },
  { id: 20, slug: "valid-parentheses", title: "Valid Parentheses", difficulty: "Easy", url: "https://leetcode.com/problems/valid-parentheses/", tags: ["String", "Stack"], topics: ["stack"] },
  { id: 704, slug: "binary-search", title: "Binary Search", difficulty: "Easy", url: "https://leetcode.com/problems/binary-search/", tags: ["Array", "Binary Search"], topics: ["binary-search"] },
  { id: 121, slug: "best-time-to-buy-and-sell-stock", title: "Best Time to Buy and Sell Stock", difficulty: "Easy", url: "https://leetcode.com/problems/best-time-to-buy-and-sell-stock/", tags: ["Array", "Dynamic Programming"], topics: ["arrays-hashing"] },
  { id: 206, slug: "reverse-linked-list", title: "Reverse Linked List", difficulty: "Easy", url: "https://leetcode.com/problems/reverse-linked-list/", tags: ["Linked List", "Recursion"], topics: ["linked-lists"] },
  { id: 21, slug: "merge-two-sorted-lists", title: "Merge Two Sorted Lists", difficulty: "Easy", url: "https://leetcode.com/problems/merge-two-sorted-lists/", tags: ["Linked List", "Recursion"], topics: ["linked-lists"] },
  { id: 104, slug: "maximum-depth-of-binary-tree", title: "Maximum Depth of Binary Tree", difficulty: "Easy", url: "https://leetcode.com/problems/maximum-depth-of-binary-tree/", tags: ["Tree", "Depth-First Search", "Breadth-First Search", "Binary Tree"], topics: ["trees"] },
  { id: 226, slug: "invert-binary-tree", title: "Invert Binary Tree", difficulty: "Easy", url: "https://leetcode.com/problems/invert-binary-tree/", tags: ["Tree", "Depth-First Search", "Breadth-First Search", "Binary Tree"], topics: ["trees"] },
  { id: 200, slug: "number-of-islands", title: "Number of Islands", difficulty: "Medium", url: "https://leetcode.com/problems/number-of-islands/", tags: ["Array", "Depth-First Search", "Breadth-First Search", "Union Find", "Matrix"], topics: ["graphs-grids"] },
] as const satisfies readonly PracticeProblem[];

export const PRACTICE_CATALOG: readonly PracticeProblem[] = catalog.map((item) => practiceProblemSchema.parse(item));

export function getPracticeTopic(value: string) {
  const parsed = practiceTopicSchema.safeParse(value);
  return parsed.success ? PRACTICE_TOPICS.find((topic) => topic.id === parsed.data) ?? null : null;
}

export function getPracticeProblem(slug: string) {
  return PRACTICE_CATALOG.find((problem) => problem.slug === slug) ?? null;
}

export function getPracticeProblemsForTopic(topic: PracticeTopic) {
  return PRACTICE_CATALOG.filter((problem) => problem.topics.includes(topic));
}

export function getNextPracticeProblem(topic: PracticeTopic, currentProblemId: number) {
  const problems = getPracticeProblemsForTopic(topic);
  const index = problems.findIndex((problem) => problem.id === currentProblemId);
  return index >= 0 ? problems[index + 1] ?? null : null;
}
