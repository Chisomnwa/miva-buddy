# Practice catalog curation

Milestone 5 uses a small, reviewable metadata-only catalog. Each record contains only the LeetCode problem number, slug, title, difficulty, canonical URL, official topic tags, and Miva Buddy topic mapping. It deliberately excludes statements, examples, hints, solutions, test cases, company lists, and scraped page content. The source remains LeetCode's official problem page; links open the original problem.

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

The catalog is maintained in `src/server/practice/catalog.ts` and checked by `tests/unit/practice-catalog.test.ts`. The strict metadata schema rejects extra fields, and the URL check permits only canonical HTTPS `leetcode.com/problems/{slug}/` links. Re-verify title, difficulty, tags, and continued availability before adding or materially changing entries. This is a curated starter set, not a claim of comprehensive curriculum coverage.
