# Practice catalog curation

Milestone 5 began with a small, reviewable metadata-only catalog. Phase 2 expands it into a 14-pattern learning library. Each record contains only the LeetCode problem number, slug, title, difficulty, canonical URL, a relevant subset of official topic tags, and Miva Buddy's instructional pattern mapping. It deliberately excludes statements, examples, hints, solutions, test cases, company lists, and scraped page content. Links open the original LeetCode problem.

## Initial reviewed set

Verified against the official LeetCode pages on 2026-10-07. The topic grouping is Miva Buddy's instructional organization; tags are the topic labels shown by LeetCode.

| # | Problem | Difficulty | Miva Buddy topic | Official page |
|---:|---|---|---|---|
| 1 | Two Sum | Easy | Arrays & hashing | https://leetcode.com/problems/two-sum/ |
| 217 | Contains Duplicate | Easy | Arrays & hashing | https://leetcode.com/problems/contains-duplicate/ |
| 242 | Valid Anagram | Easy | Arrays & hashing | https://leetcode.com/problems/valid-anagram/ |
| 125 | Valid Palindrome | Easy | Two pointers | https://leetcode.com/problems/valid-palindrome/ |
| 20 | Valid Parentheses | Easy | Stacks | https://leetcode.com/problems/valid-parentheses/ |
| 704 | Binary Search | Easy | Binary search | https://leetcode.com/problems/binary-search/ |
| 121 | Best Time to Buy and Sell Stock | Easy | Arrays & hashing | https://leetcode.com/problems/best-time-to-buy-and-sell-stock/ |
| 206 | Reverse Linked List | Easy | Linked lists | https://leetcode.com/problems/reverse-linked-list/ |
| 21 | Merge Two Sorted Lists | Easy | Linked lists | https://leetcode.com/problems/merge-two-sorted-lists/ |
| 104 | Maximum Depth of Binary Tree | Easy | Trees | https://leetcode.com/problems/maximum-depth-of-binary-tree/ |
| 226 | Invert Binary Tree | Easy | Trees | https://leetcode.com/problems/invert-binary-tree/ |
| 200 | Number of Islands | Medium | Graphs & grids | https://leetcode.com/problems/number-of-islands/ |

## Phase 2 pattern library

The current catalog contains **107 unique, free-to-open problems**. Each belongs to one primary teaching pattern, so no problem appears twice. The order below and each pattern's order in `src/server/practice/catalog.ts` are deliberate learning paths; displayed difficulty and tags help students choose a starting point. Existing problem IDs, slugs, canonical URLs, and persisted session topic IDs remain compatible.

| Pattern | Problems |
|---|---:|
| Arrays & Hashing | 15 |
| Two Pointers | 7 |
| Sliding Window | 7 |
| Stack | 7 |
| Binary Search | 7 |
| Linked Lists | 7 |
| Trees & Binary Search Trees | 9 |
| Backtracking | 6 |
| Heaps & Priority Queues | 6 |
| Graphs (DFS & BFS) | 9 |
| Dynamic Programming | 9 |
| Greedy Algorithms | 6 |
| Intervals | 6 |
| Tries | 6 |

Prefix Sum is treated as a technique used within array/hash problems, not a standalone pattern. Its six catalog entries remain intact in Arrays & Hashing and retain their verified official `Prefix Sum` tags. The former `prefix-sum` topic ID remains accepted only for historic session records and old links; it resolves to Arrays & Hashing and is not shown as a new pattern.

On 2026-10-08, all selected problem numbers, titles, slugs, difficulties, availability, and topic tags were checked against LeetCode's public metadata endpoints: `https://leetcode.com/api/problems/all/` and `https://leetcode.com/graphql/`. Canonical URLs are built from verified slugs; no problem body was imported. Tags in the UI are selected from the verified official tag set (up to four per problem), with the pattern-relevant tag prioritized. The Miva Buddy pattern grouping and sequence are editorial teaching decisions, not claims that LeetCode has these exact pattern labels. Re-verify metadata and continued availability before material catalog changes.

`src/contracts/practice.ts` validates strict metadata and supported topic IDs; `tests/unit/practice-catalog.test.ts` guards counts, uniqueness, canonical URLs, and legacy identities. The additive `drizzle/0008_expand_practice_topics.sql` constraint allows new session topic IDs without rewriting existing rows. The catalog remains metadata-only and does not establish LeetCode submission awareness.
