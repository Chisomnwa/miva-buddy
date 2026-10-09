import { z } from "zod";

export const practiceDifficultySchema = z.enum(["Easy", "Medium", "Hard"]);

export const practiceTopicSchema = z.enum([
  "arrays-hashing",
  "two-pointers",
  "sliding-window",
  "stack",
  "binary-search",
  "linked-lists",
  "trees",
  "backtracking",
  "heaps-priority-queues",
  "graphs-grids",
  "dynamic-programming",
  "greedy",
  "intervals",
  "prefix-sum",
  "tries",
]);

export const practiceProblemSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(120),
  difficulty: practiceDifficultySchema,
  url: z.string().url().refine((value) => {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname === "leetcode.com"
      && /^\/problems\/[a-z0-9-]+\/$/.test(parsed.pathname)
      && !parsed.search && !parsed.hash;
  }, "Use a canonical HTTPS LeetCode problem URL."),
  tags: z.array(z.string().min(1).max(40)).min(1).max(8),
  topics: z.array(practiceTopicSchema).min(1).max(4),
}).strict();

export const practiceModeSchema = z.enum(["hands_off", "coach", "tutor"]);
export const practiceSessionStatusSchema = z.enum(["in_progress", "completed"]);

export type PracticeProblem = z.infer<typeof practiceProblemSchema>;
export type PracticeDifficulty = z.infer<typeof practiceDifficultySchema>;
export type PracticeTopic = z.infer<typeof practiceTopicSchema>;
export type PracticeMode = z.infer<typeof practiceModeSchema>;
export type PracticeSessionStatus = z.infer<typeof practiceSessionStatusSchema>;
