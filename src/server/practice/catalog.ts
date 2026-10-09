import { practiceProblemSchema, practiceTopicSchema, type PracticeProblem, type PracticeTopic } from "@/contracts/practice";

// Topic IDs used by existing sessions are permanent; array order is the learning path.
export const PRACTICE_TOPICS: readonly { id: PracticeTopic; label: string; description: string }[] = [
  { id: "arrays-hashing", label: "Arrays & Hashing", description: "Build fluency with arrays, strings, and lookup structures." },
  { id: "two-pointers", label: "Two Pointers", description: "Use coordinated positions to reason across sequences." },
  { id: "sliding-window", label: "Sliding Window", description: "Track a changing range without restarting the scan." },
  { id: "stack", label: "Stack", description: "Track nested or most-recent state." },
  { id: "binary-search", label: "Binary Search", description: "Narrow sorted spaces and monotonic answers." },
  { id: "linked-lists", label: "Linked Lists", description: "Work with node references and list structure." },
  { id: "trees", label: "Trees & Binary Search Trees", description: "Explore recursive, breadth-first, and BST reasoning." },
  { id: "backtracking", label: "Backtracking", description: "Build choices, undo them, and explore search trees." },
  { id: "heaps-priority-queues", label: "Heaps & Priority Queues", description: "Keep the next most important item within reach." },
  { id: "graphs-grids", label: "Graphs (DFS & BFS)", description: "Traverse connected cells and graph-shaped data." },
  { id: "dynamic-programming", label: "Dynamic Programming", description: "Reuse subproblem results across states and sequences." },
  { id: "greedy", label: "Greedy Algorithms", description: "Choose locally useful moves and justify when they work." },
  { id: "intervals", label: "Intervals", description: "Sort, merge, and compare overlapping ranges." },
  { id: "tries", label: "Tries", description: "Organize words by shared prefixes." },
];

// Metadata only, verified against LeetCode's public question metadata on 2026-10-08.
// Within each topic, entries progress from foundational to more demanding patterns.
const catalog = [
  { id: 1, slug: "two-sum", title: "Two Sum", difficulty: "Easy", url: "https://leetcode.com/problems/two-sum/", tags: ["Array","Hash Table"], topics: ["arrays-hashing"] },
  { id: 217, slug: "contains-duplicate", title: "Contains Duplicate", difficulty: "Easy", url: "https://leetcode.com/problems/contains-duplicate/", tags: ["Array","Hash Table","Sorting"], topics: ["arrays-hashing"] },
  { id: 242, slug: "valid-anagram", title: "Valid Anagram", difficulty: "Easy", url: "https://leetcode.com/problems/valid-anagram/", tags: ["Hash Table","String","Sorting"], topics: ["arrays-hashing"] },
  { id: 121, slug: "best-time-to-buy-and-sell-stock", title: "Best Time to Buy and Sell Stock", difficulty: "Easy", url: "https://leetcode.com/problems/best-time-to-buy-and-sell-stock/", tags: ["Array","Dynamic Programming"], topics: ["arrays-hashing"] },
  { id: 49, slug: "group-anagrams", title: "Group Anagrams", difficulty: "Medium", url: "https://leetcode.com/problems/group-anagrams/", tags: ["Array","Hash Table","String","Sorting"], topics: ["arrays-hashing"] },
  { id: 347, slug: "top-k-frequent-elements", title: "Top K Frequent Elements", difficulty: "Medium", url: "https://leetcode.com/problems/top-k-frequent-elements/", tags: ["Array","Hash Table","Divide and Conquer","Sorting"], topics: ["arrays-hashing"] },
  { id: 238, slug: "product-of-array-except-self", title: "Product of Array Except Self", difficulty: "Medium", url: "https://leetcode.com/problems/product-of-array-except-self/", tags: ["Array","Prefix Sum"], topics: ["arrays-hashing"] },
  { id: 36, slug: "valid-sudoku", title: "Valid Sudoku", difficulty: "Medium", url: "https://leetcode.com/problems/valid-sudoku/", tags: ["Array","Hash Table","Matrix"], topics: ["arrays-hashing"] },
  { id: 128, slug: "longest-consecutive-sequence", title: "Longest Consecutive Sequence", difficulty: "Medium", url: "https://leetcode.com/problems/longest-consecutive-sequence/", tags: ["Array","Hash Table","Union-Find"], topics: ["arrays-hashing"] },
  { id: 125, slug: "valid-palindrome", title: "Valid Palindrome", difficulty: "Easy", url: "https://leetcode.com/problems/valid-palindrome/", tags: ["Two Pointers","String"], topics: ["two-pointers"] },
  { id: 344, slug: "reverse-string", title: "Reverse String", difficulty: "Easy", url: "https://leetcode.com/problems/reverse-string/", tags: ["Two Pointers","String"], topics: ["two-pointers"] },
  { id: 283, slug: "move-zeroes", title: "Move Zeroes", difficulty: "Easy", url: "https://leetcode.com/problems/move-zeroes/", tags: ["Two Pointers","Array"], topics: ["two-pointers"] },
  { id: 167, slug: "two-sum-ii-input-array-is-sorted", title: "Two Sum II - Input Array Is Sorted", difficulty: "Medium", url: "https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/", tags: ["Two Pointers","Array","Binary Search"], topics: ["two-pointers"] },
  { id: 11, slug: "container-with-most-water", title: "Container With Most Water", difficulty: "Medium", url: "https://leetcode.com/problems/container-with-most-water/", tags: ["Two Pointers","Array","Greedy"], topics: ["two-pointers"] },
  { id: 15, slug: "3sum", title: "3Sum", difficulty: "Medium", url: "https://leetcode.com/problems/3sum/", tags: ["Two Pointers","Array","Sorting"], topics: ["two-pointers"] },
  { id: 42, slug: "trapping-rain-water", title: "Trapping Rain Water", difficulty: "Hard", url: "https://leetcode.com/problems/trapping-rain-water/", tags: ["Two Pointers","Array","Dynamic Programming","Stack"], topics: ["two-pointers"] },
  { id: 643, slug: "maximum-average-subarray-i", title: "Maximum Average Subarray I", difficulty: "Easy", url: "https://leetcode.com/problems/maximum-average-subarray-i/", tags: ["Sliding Window","Array"], topics: ["sliding-window"] },
  { id: 3, slug: "longest-substring-without-repeating-characters", title: "Longest Substring Without Repeating Characters", difficulty: "Medium", url: "https://leetcode.com/problems/longest-substring-without-repeating-characters/", tags: ["Sliding Window","Hash Table","String"], topics: ["sliding-window"] },
  { id: 424, slug: "longest-repeating-character-replacement", title: "Longest Repeating Character Replacement", difficulty: "Medium", url: "https://leetcode.com/problems/longest-repeating-character-replacement/", tags: ["Sliding Window","Hash Table","String"], topics: ["sliding-window"] },
  { id: 567, slug: "permutation-in-string", title: "Permutation in String", difficulty: "Medium", url: "https://leetcode.com/problems/permutation-in-string/", tags: ["Sliding Window","Hash Table","Two Pointers","String"], topics: ["sliding-window"] },
  { id: 438, slug: "find-all-anagrams-in-a-string", title: "Find All Anagrams in a String", difficulty: "Medium", url: "https://leetcode.com/problems/find-all-anagrams-in-a-string/", tags: ["Sliding Window","Hash Table","String"], topics: ["sliding-window"] },
  { id: 209, slug: "minimum-size-subarray-sum", title: "Minimum Size Subarray Sum", difficulty: "Medium", url: "https://leetcode.com/problems/minimum-size-subarray-sum/", tags: ["Sliding Window","Array","Binary Search","Prefix Sum"], topics: ["sliding-window"] },
  { id: 76, slug: "minimum-window-substring", title: "Minimum Window Substring", difficulty: "Hard", url: "https://leetcode.com/problems/minimum-window-substring/", tags: ["Sliding Window","Hash Table","String"], topics: ["sliding-window"] },
  { id: 20, slug: "valid-parentheses", title: "Valid Parentheses", difficulty: "Easy", url: "https://leetcode.com/problems/valid-parentheses/", tags: ["Stack","String","Bracket Sequences"], topics: ["stack"] },
  { id: 232, slug: "implement-queue-using-stacks", title: "Implement Queue using Stacks", difficulty: "Easy", url: "https://leetcode.com/problems/implement-queue-using-stacks/", tags: ["Stack","Design","Queue"], topics: ["stack"] },
  { id: 155, slug: "min-stack", title: "Min Stack", difficulty: "Medium", url: "https://leetcode.com/problems/min-stack/", tags: ["Stack","Design"], topics: ["stack"] },
  { id: 150, slug: "evaluate-reverse-polish-notation", title: "Evaluate Reverse Polish Notation", difficulty: "Medium", url: "https://leetcode.com/problems/evaluate-reverse-polish-notation/", tags: ["Stack","Array","Math"], topics: ["stack"] },
  { id: 739, slug: "daily-temperatures", title: "Daily Temperatures", difficulty: "Medium", url: "https://leetcode.com/problems/daily-temperatures/", tags: ["Stack","Array","Monotonic Stack"], topics: ["stack"] },
  { id: 853, slug: "car-fleet", title: "Car Fleet", difficulty: "Medium", url: "https://leetcode.com/problems/car-fleet/", tags: ["Stack","Array","Sorting","Monotonic Stack"], topics: ["stack"] },
  { id: 84, slug: "largest-rectangle-in-histogram", title: "Largest Rectangle in Histogram", difficulty: "Hard", url: "https://leetcode.com/problems/largest-rectangle-in-histogram/", tags: ["Stack","Array","Monotonic Stack","Range Minimum/Maximum Query"], topics: ["stack"] },
  { id: 704, slug: "binary-search", title: "Binary Search", difficulty: "Easy", url: "https://leetcode.com/problems/binary-search/", tags: ["Binary Search","Array"], topics: ["binary-search"] },
  { id: 35, slug: "search-insert-position", title: "Search Insert Position", difficulty: "Easy", url: "https://leetcode.com/problems/search-insert-position/", tags: ["Binary Search","Array"], topics: ["binary-search"] },
  { id: 74, slug: "search-a-2d-matrix", title: "Search a 2D Matrix", difficulty: "Medium", url: "https://leetcode.com/problems/search-a-2d-matrix/", tags: ["Binary Search","Array","Matrix"], topics: ["binary-search"] },
  { id: 34, slug: "find-first-and-last-position-of-element-in-sorted-array", title: "Find First and Last Position of Element in Sorted Array", difficulty: "Medium", url: "https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/", tags: ["Binary Search","Array"], topics: ["binary-search"] },
  { id: 33, slug: "search-in-rotated-sorted-array", title: "Search in Rotated Sorted Array", difficulty: "Medium", url: "https://leetcode.com/problems/search-in-rotated-sorted-array/", tags: ["Binary Search","Array"], topics: ["binary-search"] },
  { id: 153, slug: "find-minimum-in-rotated-sorted-array", title: "Find Minimum in Rotated Sorted Array", difficulty: "Medium", url: "https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/", tags: ["Binary Search","Array"], topics: ["binary-search"] },
  { id: 875, slug: "koko-eating-bananas", title: "Koko Eating Bananas", difficulty: "Medium", url: "https://leetcode.com/problems/koko-eating-bananas/", tags: ["Binary Search","Array"], topics: ["binary-search"] },
  { id: 206, slug: "reverse-linked-list", title: "Reverse Linked List", difficulty: "Easy", url: "https://leetcode.com/problems/reverse-linked-list/", tags: ["Linked List","Recursion"], topics: ["linked-lists"] },
  { id: 21, slug: "merge-two-sorted-lists", title: "Merge Two Sorted Lists", difficulty: "Easy", url: "https://leetcode.com/problems/merge-two-sorted-lists/", tags: ["Linked List","Recursion"], topics: ["linked-lists"] },
  { id: 141, slug: "linked-list-cycle", title: "Linked List Cycle", difficulty: "Easy", url: "https://leetcode.com/problems/linked-list-cycle/", tags: ["Linked List","Hash Table","Two Pointers","Floyd's Cycle Finding Algorithm"], topics: ["linked-lists"] },
  { id: 876, slug: "middle-of-the-linked-list", title: "Middle of the Linked List", difficulty: "Easy", url: "https://leetcode.com/problems/middle-of-the-linked-list/", tags: ["Linked List","Two Pointers"], topics: ["linked-lists"] },
  { id: 19, slug: "remove-nth-node-from-end-of-list", title: "Remove Nth Node From End of List", difficulty: "Medium", url: "https://leetcode.com/problems/remove-nth-node-from-end-of-list/", tags: ["Linked List","Two Pointers"], topics: ["linked-lists"] },
  { id: 143, slug: "reorder-list", title: "Reorder List", difficulty: "Medium", url: "https://leetcode.com/problems/reorder-list/", tags: ["Linked List","Two Pointers","Stack","Recursion"], topics: ["linked-lists"] },
  { id: 2, slug: "add-two-numbers", title: "Add Two Numbers", difficulty: "Medium", url: "https://leetcode.com/problems/add-two-numbers/", tags: ["Linked List","Math","Recursion"], topics: ["linked-lists"] },
  { id: 104, slug: "maximum-depth-of-binary-tree", title: "Maximum Depth of Binary Tree", difficulty: "Easy", url: "https://leetcode.com/problems/maximum-depth-of-binary-tree/", tags: ["Tree","Depth-First Search","Breadth-First Search","Binary Tree"], topics: ["trees"] },
  { id: 226, slug: "invert-binary-tree", title: "Invert Binary Tree", difficulty: "Easy", url: "https://leetcode.com/problems/invert-binary-tree/", tags: ["Tree","Depth-First Search","Breadth-First Search","Binary Tree"], topics: ["trees"] },
  { id: 100, slug: "same-tree", title: "Same Tree", difficulty: "Easy", url: "https://leetcode.com/problems/same-tree/", tags: ["Tree","Depth-First Search","Breadth-First Search","Binary Tree"], topics: ["trees"] },
  { id: 543, slug: "diameter-of-binary-tree", title: "Diameter of Binary Tree", difficulty: "Easy", url: "https://leetcode.com/problems/diameter-of-binary-tree/", tags: ["Tree","Depth-First Search","Binary Tree","DP on Trees"], topics: ["trees"] },
  { id: 102, slug: "binary-tree-level-order-traversal", title: "Binary Tree Level Order Traversal", difficulty: "Medium", url: "https://leetcode.com/problems/binary-tree-level-order-traversal/", tags: ["Tree","Breadth-First Search","Binary Tree"], topics: ["trees"] },
  { id: 235, slug: "lowest-common-ancestor-of-a-binary-search-tree", title: "Lowest Common Ancestor of a Binary Search Tree", difficulty: "Medium", url: "https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/", tags: ["Tree","Binary Search Tree","Depth-First Search","Binary Tree"], topics: ["trees"] },
  { id: 98, slug: "validate-binary-search-tree", title: "Validate Binary Search Tree", difficulty: "Medium", url: "https://leetcode.com/problems/validate-binary-search-tree/", tags: ["Tree","Binary Search Tree","Depth-First Search","Binary Tree"], topics: ["trees"] },
  { id: 230, slug: "kth-smallest-element-in-a-bst", title: "Kth Smallest Element in a BST", difficulty: "Medium", url: "https://leetcode.com/problems/kth-smallest-element-in-a-bst/", tags: ["Tree","Binary Search Tree","Depth-First Search","Binary Tree"], topics: ["trees"] },
  { id: 124, slug: "binary-tree-maximum-path-sum", title: "Binary Tree Maximum Path Sum", difficulty: "Hard", url: "https://leetcode.com/problems/binary-tree-maximum-path-sum/", tags: ["Tree","Dynamic Programming","Depth-First Search","Binary Tree"], topics: ["trees"] },
  { id: 78, slug: "subsets", title: "Subsets", difficulty: "Medium", url: "https://leetcode.com/problems/subsets/", tags: ["Backtracking","Array","Bit Manipulation"], topics: ["backtracking"] },
  { id: 46, slug: "permutations", title: "Permutations", difficulty: "Medium", url: "https://leetcode.com/problems/permutations/", tags: ["Backtracking","Array"], topics: ["backtracking"] },
  { id: 39, slug: "combination-sum", title: "Combination Sum", difficulty: "Medium", url: "https://leetcode.com/problems/combination-sum/", tags: ["Backtracking","Array"], topics: ["backtracking"] },
  { id: 90, slug: "subsets-ii", title: "Subsets II", difficulty: "Medium", url: "https://leetcode.com/problems/subsets-ii/", tags: ["Backtracking","Array","Bit Manipulation"], topics: ["backtracking"] },
  { id: 79, slug: "word-search", title: "Word Search", difficulty: "Medium", url: "https://leetcode.com/problems/word-search/", tags: ["Backtracking","Array","String","Depth-First Search"], topics: ["backtracking"] },
  { id: 51, slug: "n-queens", title: "N-Queens", difficulty: "Hard", url: "https://leetcode.com/problems/n-queens/", tags: ["Backtracking","Array","Algorithm X"], topics: ["backtracking"] },
  { id: 703, slug: "kth-largest-element-in-a-stream", title: "Kth Largest Element in a Stream", difficulty: "Easy", url: "https://leetcode.com/problems/kth-largest-element-in-a-stream/", tags: ["Heap (Priority Queue)","Tree","Design","Binary Search Tree"], topics: ["heaps-priority-queues"] },
  { id: 1046, slug: "last-stone-weight", title: "Last Stone Weight", difficulty: "Easy", url: "https://leetcode.com/problems/last-stone-weight/", tags: ["Heap (Priority Queue)","Array"], topics: ["heaps-priority-queues"] },
  { id: 215, slug: "kth-largest-element-in-an-array", title: "Kth Largest Element in an Array", difficulty: "Medium", url: "https://leetcode.com/problems/kth-largest-element-in-an-array/", tags: ["Heap (Priority Queue)","Array","Divide and Conquer","Sorting"], topics: ["heaps-priority-queues"] },
  { id: 973, slug: "k-closest-points-to-origin", title: "K Closest Points to Origin", difficulty: "Medium", url: "https://leetcode.com/problems/k-closest-points-to-origin/", tags: ["Heap (Priority Queue)","Array","Math","Divide and Conquer"], topics: ["heaps-priority-queues"] },
  { id: 621, slug: "task-scheduler", title: "Task Scheduler", difficulty: "Medium", url: "https://leetcode.com/problems/task-scheduler/", tags: ["Heap (Priority Queue)","Array","Hash Table","Greedy"], topics: ["heaps-priority-queues"] },
  { id: 295, slug: "find-median-from-data-stream", title: "Find Median from Data Stream", difficulty: "Hard", url: "https://leetcode.com/problems/find-median-from-data-stream/", tags: ["Heap (Priority Queue)","Two Pointers","Design","Sorting"], topics: ["heaps-priority-queues"] },
  { id: 200, slug: "number-of-islands", title: "Number of Islands", difficulty: "Medium", url: "https://leetcode.com/problems/number-of-islands/", tags: ["Depth-First Search","Breadth-First Search","Array","Union-Find"], topics: ["graphs-grids"] },
  { id: 733, slug: "flood-fill", title: "Flood Fill", difficulty: "Easy", url: "https://leetcode.com/problems/flood-fill/", tags: ["Depth-First Search","Breadth-First Search","Array","Matrix"], topics: ["graphs-grids"] },
  { id: 695, slug: "max-area-of-island", title: "Max Area of Island", difficulty: "Medium", url: "https://leetcode.com/problems/max-area-of-island/", tags: ["Depth-First Search","Breadth-First Search","Array","Union-Find"], topics: ["graphs-grids"] },
  { id: 133, slug: "clone-graph", title: "Clone Graph", difficulty: "Medium", url: "https://leetcode.com/problems/clone-graph/", tags: ["Depth-First Search","Breadth-First Search","Graph Theory","Hash Table"], topics: ["graphs-grids"] },
  { id: 994, slug: "rotting-oranges", title: "Rotting Oranges", difficulty: "Medium", url: "https://leetcode.com/problems/rotting-oranges/", tags: ["Breadth-First Search","Array","Matrix"], topics: ["graphs-grids"] },
  { id: 417, slug: "pacific-atlantic-water-flow", title: "Pacific Atlantic Water Flow", difficulty: "Medium", url: "https://leetcode.com/problems/pacific-atlantic-water-flow/", tags: ["Depth-First Search","Breadth-First Search","Array","Matrix"], topics: ["graphs-grids"] },
  { id: 207, slug: "course-schedule", title: "Course Schedule", difficulty: "Medium", url: "https://leetcode.com/problems/course-schedule/", tags: ["Depth-First Search","Breadth-First Search","Graph Theory","Topological Sort"], topics: ["graphs-grids"] },
  { id: 210, slug: "course-schedule-ii", title: "Course Schedule II", difficulty: "Medium", url: "https://leetcode.com/problems/course-schedule-ii/", tags: ["Depth-First Search","Breadth-First Search","Graph Theory","Topological Sort"], topics: ["graphs-grids"] },
  { id: 127, slug: "word-ladder", title: "Word Ladder", difficulty: "Hard", url: "https://leetcode.com/problems/word-ladder/", tags: ["Breadth-First Search","Hash Table","String","Bidirectional Search"], topics: ["graphs-grids"] },
  { id: 70, slug: "climbing-stairs", title: "Climbing Stairs", difficulty: "Easy", url: "https://leetcode.com/problems/climbing-stairs/", tags: ["Dynamic Programming","Math","Memoization"], topics: ["dynamic-programming"] },
  { id: 746, slug: "min-cost-climbing-stairs", title: "Min Cost Climbing Stairs", difficulty: "Easy", url: "https://leetcode.com/problems/min-cost-climbing-stairs/", tags: ["Dynamic Programming","Array"], topics: ["dynamic-programming"] },
  { id: 198, slug: "house-robber", title: "House Robber", difficulty: "Medium", url: "https://leetcode.com/problems/house-robber/", tags: ["Dynamic Programming","Array"], topics: ["dynamic-programming"] },
  { id: 213, slug: "house-robber-ii", title: "House Robber II", difficulty: "Medium", url: "https://leetcode.com/problems/house-robber-ii/", tags: ["Dynamic Programming","Array"], topics: ["dynamic-programming"] },
  { id: 300, slug: "longest-increasing-subsequence", title: "Longest Increasing Subsequence", difficulty: "Medium", url: "https://leetcode.com/problems/longest-increasing-subsequence/", tags: ["Dynamic Programming","Array","Binary Search","Longest Increasing Subsequence"], topics: ["dynamic-programming"] },
  { id: 322, slug: "coin-change", title: "Coin Change", difficulty: "Medium", url: "https://leetcode.com/problems/coin-change/", tags: ["Dynamic Programming","Array","Breadth-First Search","Knapsack Problem"], topics: ["dynamic-programming"] },
  { id: 139, slug: "word-break", title: "Word Break", difficulty: "Medium", url: "https://leetcode.com/problems/word-break/", tags: ["Dynamic Programming","Array","Hash Table","String"], topics: ["dynamic-programming"] },
  { id: 1143, slug: "longest-common-subsequence", title: "Longest Common Subsequence", difficulty: "Medium", url: "https://leetcode.com/problems/longest-common-subsequence/", tags: ["Dynamic Programming","String","Longest Common Subsequence"], topics: ["dynamic-programming"] },
  { id: 72, slug: "edit-distance", title: "Edit Distance", difficulty: "Medium", url: "https://leetcode.com/problems/edit-distance/", tags: ["Dynamic Programming","String"], topics: ["dynamic-programming"] },
  { id: 455, slug: "assign-cookies", title: "Assign Cookies", difficulty: "Easy", url: "https://leetcode.com/problems/assign-cookies/", tags: ["Greedy","Array","Two Pointers","Sorting"], topics: ["greedy"] },
  { id: 860, slug: "lemonade-change", title: "Lemonade Change", difficulty: "Easy", url: "https://leetcode.com/problems/lemonade-change/", tags: ["Greedy","Array"], topics: ["greedy"] },
  { id: 55, slug: "jump-game", title: "Jump Game", difficulty: "Medium", url: "https://leetcode.com/problems/jump-game/", tags: ["Greedy","Array","Dynamic Programming"], topics: ["greedy"] },
  { id: 45, slug: "jump-game-ii", title: "Jump Game II", difficulty: "Medium", url: "https://leetcode.com/problems/jump-game-ii/", tags: ["Greedy","Array","Dynamic Programming"], topics: ["greedy"] },
  { id: 134, slug: "gas-station", title: "Gas Station", difficulty: "Medium", url: "https://leetcode.com/problems/gas-station/", tags: ["Greedy","Array"], topics: ["greedy"] },
  { id: 763, slug: "partition-labels", title: "Partition Labels", difficulty: "Medium", url: "https://leetcode.com/problems/partition-labels/", tags: ["Greedy","Hash Table","Two Pointers","String"], topics: ["greedy"] },
  { id: 56, slug: "merge-intervals", title: "Merge Intervals", difficulty: "Medium", url: "https://leetcode.com/problems/merge-intervals/", tags: ["Sorting","Array","Quicksort"], topics: ["intervals"] },
  { id: 57, slug: "insert-interval", title: "Insert Interval", difficulty: "Medium", url: "https://leetcode.com/problems/insert-interval/", tags: ["Array"], topics: ["intervals"] },
  { id: 435, slug: "non-overlapping-intervals", title: "Non-overlapping Intervals", difficulty: "Medium", url: "https://leetcode.com/problems/non-overlapping-intervals/", tags: ["Sorting","Greedy","Array","Dynamic Programming"], topics: ["intervals"] },
  { id: 452, slug: "minimum-number-of-arrows-to-burst-balloons", title: "Minimum Number of Arrows to Burst Balloons", difficulty: "Medium", url: "https://leetcode.com/problems/minimum-number-of-arrows-to-burst-balloons/", tags: ["Sorting","Greedy","Array"], topics: ["intervals"] },
  { id: 1288, slug: "remove-covered-intervals", title: "Remove Covered Intervals", difficulty: "Medium", url: "https://leetcode.com/problems/remove-covered-intervals/", tags: ["Sorting","Array"], topics: ["intervals"] },
  { id: 986, slug: "interval-list-intersections", title: "Interval List Intersections", difficulty: "Medium", url: "https://leetcode.com/problems/interval-list-intersections/", tags: ["Sweep Line","Array","Two Pointers"], topics: ["intervals"] },
  { id: 1480, slug: "running-sum-of-1d-array", title: "Running Sum of 1d Array", difficulty: "Easy", url: "https://leetcode.com/problems/running-sum-of-1d-array/", tags: ["Prefix Sum","Array"], topics: ["arrays-hashing"] },
  { id: 724, slug: "find-pivot-index", title: "Find Pivot Index", difficulty: "Easy", url: "https://leetcode.com/problems/find-pivot-index/", tags: ["Prefix Sum","Array"], topics: ["arrays-hashing"] },
  { id: 303, slug: "range-sum-query-immutable", title: "Range Sum Query - Immutable", difficulty: "Easy", url: "https://leetcode.com/problems/range-sum-query-immutable/", tags: ["Prefix Sum","Array","Design"], topics: ["arrays-hashing"] },
  { id: 560, slug: "subarray-sum-equals-k", title: "Subarray Sum Equals K", difficulty: "Medium", url: "https://leetcode.com/problems/subarray-sum-equals-k/", tags: ["Prefix Sum","Array","Hash Table"], topics: ["arrays-hashing"] },
  { id: 525, slug: "contiguous-array", title: "Contiguous Array", difficulty: "Medium", url: "https://leetcode.com/problems/contiguous-array/", tags: ["Prefix Sum","Array","Hash Table"], topics: ["arrays-hashing"] },
  { id: 974, slug: "subarray-sums-divisible-by-k", title: "Subarray Sums Divisible by K", difficulty: "Medium", url: "https://leetcode.com/problems/subarray-sums-divisible-by-k/", tags: ["Prefix Sum","Array","Hash Table"], topics: ["arrays-hashing"] },
  { id: 720, slug: "longest-word-in-dictionary", title: "Longest Word in Dictionary", difficulty: "Medium", url: "https://leetcode.com/problems/longest-word-in-dictionary/", tags: ["Trie","Array","Hash Table","String"], topics: ["tries"] },
  { id: 208, slug: "implement-trie-prefix-tree", title: "Implement Trie (Prefix Tree)", difficulty: "Medium", url: "https://leetcode.com/problems/implement-trie-prefix-tree/", tags: ["Trie","Hash Table","String","Design"], topics: ["tries"] },
  { id: 211, slug: "design-add-and-search-words-data-structure", title: "Design Add and Search Words Data Structure", difficulty: "Medium", url: "https://leetcode.com/problems/design-add-and-search-words-data-structure/", tags: ["Trie","String","Depth-First Search","Design"], topics: ["tries"] },
  { id: 648, slug: "replace-words", title: "Replace Words", difficulty: "Medium", url: "https://leetcode.com/problems/replace-words/", tags: ["Trie","Array","Hash Table","String"], topics: ["tries"] },
  { id: 677, slug: "map-sum-pairs", title: "Map Sum Pairs", difficulty: "Medium", url: "https://leetcode.com/problems/map-sum-pairs/", tags: ["Trie","Hash Table","String","Design"], topics: ["tries"] },
  { id: 212, slug: "word-search-ii", title: "Word Search II", difficulty: "Hard", url: "https://leetcode.com/problems/word-search-ii/", tags: ["Trie","Array","String","Backtracking"], topics: ["tries"] },
] as const satisfies readonly PracticeProblem[];

export const PRACTICE_CATALOG: readonly PracticeProblem[] = catalog.map((item) => practiceProblemSchema.parse(item));

export function getPracticeTopic(value: string) {
  const parsed = practiceTopicSchema.safeParse(value);
  if (!parsed.success) return null;
  // Historic session URLs remain usable; Prefix Sum is no longer a displayed pattern.
  const topicId = parsed.data === "prefix-sum" ? "arrays-hashing" : parsed.data;
  return PRACTICE_TOPICS.find((topic) => topic.id === topicId) ?? null;
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
