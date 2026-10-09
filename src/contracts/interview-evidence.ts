import { z } from "zod";

const interviewEvidenceRecordSchema = z.object({
  id: z.string().trim().min(1).max(120),
  source: z.string().trim().min(1).max(80),
  sourceItemId: z.string().trim().min(1).max(160),
  company: z.string().trim().min(1).max(120),
  role: z.string().trim().max(120).nullable(),
  attribution: z.string().trim().min(1).max(160),
  url: z.url().refine((value) => new URL(value).protocol === "https:"),
  interviewEventAt: z.iso.datetime().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  retrievedAt: z.iso.datetime(),
  summary: z.string().trim().min(1).max(600),
});

export const interviewEvidenceResultSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("found"), records: z.array(interviewEvidenceRecordSchema).min(1).max(5) }),
  z.object({ state: z.literal("no_evidence") }),
  z.object({ state: z.literal("failed"), reason: z.enum(["timeout", "unavailable", "invalid_response"]) }),
  z.object({ state: z.literal("source_not_approved"), source: z.string().trim().min(1).max(80) }),
]);

export const interviewPreparationSegmentSchema = z.object({
  kind: z.literal("interview_preparation"),
  requestState: z.enum(["ready", "clarification_required"]),
  company: z.string().trim().min(1).max(120).nullable(),
  roleTitle: z.string().trim().min(1).max(120).nullable(),
  interviewStage: z.string().trim().min(1).max(80).nullable(),
  evidence: interviewEvidenceResultSchema.nullable(),
  title: z.string().trim().min(1).max(120),
  introduction: z.string().trim().min(1).max(500),
  technicalTopics: z.array(z.string().trim().min(1).max(160)).max(8),
  practiceSuggestions: z.array(z.string().trim().min(1).max(240)).max(6),
  behavioralPrompts: z.array(z.string().trim().min(1).max(240)).max(5),
  studyPlan: z.array(z.object({
    step: z.string().trim().min(1).max(100),
    task: z.string().trim().min(1).max(240),
  })).max(5),
  followUpQuestions: z.array(z.string().trim().min(1).max(180)).max(3),
});

export type InterviewEvidenceResult = z.infer<typeof interviewEvidenceResultSchema>;
export type InterviewPreparationSegment = z.infer<typeof interviewPreparationSegmentSchema>;
