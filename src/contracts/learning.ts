import { z } from "zod";

export const learnRequestSchema = z.object({
  conversationId: z.uuid().optional(),
  message: z.string().trim().min(2).max(2_000),
});

export const learnResponseSchema = z.object({
  answer: z.string().trim().min(1).max(8_000),
  followUpQuestions: z.array(z.string().trim().min(1).max(180)).max(3),
});

export const learnStoredMessageSchema = z.object({
  id: z.uuid(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  follow_up_questions: z.array(z.string()).default([]),
  response_segments: z.array(z.unknown()).default([]),
  created_at: z.string(),
});

export type LearnResponse = z.infer<typeof learnResponseSchema>;
export type LearnStoredMessage = z.infer<typeof learnStoredMessageSchema>;
