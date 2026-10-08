import { z } from "zod";
import { practiceModeSchema } from "@/contracts/practice";

export const practiceCoachRequestSchema = z.object({
  sessionId: z.uuid(),
  message: z.string().trim().min(2).max(2_000),
  attempt: z.string().max(6_000).optional().default(""),
}).strict();

export const practiceRequestTypeSchema = z.enum([
  "stuck", "code_error", "failed_test", "explain_approach", "walkthrough", "dry_run", "full_answer", "other",
]);

export const practiceReferenceSchema = z.string().max(120).refine((value) =>
  /^identifier:[A-Za-z_$][\w$]*$/.test(value) || /^line:[1-9]\d*$/.test(value),
"Use an identifier:name or line:number reference.");

const segmentKinds = ["observation", "reflection_question", "idea", "diagnosis", "step", "complete_answer"] as const;
export const practiceCoachSegmentSchema = z.object({
  kind: z.enum(segmentKinds),
  content: z.string().trim().min(1).max(1_200),
  format: z.enum(["prose", "code"]).default("prose"),
  references: z.array(practiceReferenceSchema).max(12),
}).strict();

export const practiceCoachResponseSchema = z.object({
  segments: z.array(practiceCoachSegmentSchema).min(1).max(5),
}).strict();

export const practiceModeLimitSchema = z.object({
  status: z.literal("mode_limit"),
  message: z.string().min(1).max(400),
  offerTutorSwitch: z.boolean(),
});

export const practiceCoachResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("accepted"), userMessageId: z.uuid(), assistantMessageId: z.uuid(), response: practiceCoachResponseSchema }),
  z.object({ status: z.literal("mode_limit"), message: z.string().min(1).max(400), offerTutorSwitch: z.boolean() }),
  z.object({ status: z.literal("needs_attempt"), userMessageId: z.uuid(), assistantMessageId: z.uuid(), response: practiceCoachResponseSchema }),
]);

export type PracticeCoachRequest = z.infer<typeof practiceCoachRequestSchema>;
export type PracticeRequestType = z.infer<typeof practiceRequestTypeSchema>;
export type PracticeCoachSegment = z.infer<typeof practiceCoachSegmentSchema>;
export type PracticeCoachResponse = z.infer<typeof practiceCoachResponseSchema>;
export type PracticeCoachResult = z.infer<typeof practiceCoachResultSchema>;
export type PracticeMode = z.infer<typeof practiceModeSchema>;
