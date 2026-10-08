import { z } from "zod";

export const groundedLearnRequestSchema = z.object({
  conversationId: z.uuid().optional(),
  courseId: z.uuid(),
  materialId: z.uuid(),
  conceptId: z.uuid(),
  message: z.string().trim().min(2).max(2_000),
});

export const groundedResponseSegmentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("grounded"),
    content: z.string().trim().min(1).max(3_000),
    citationIds: z.array(z.uuid()).min(1).max(5),
  }),
  z.object({
    kind: z.literal("additional"),
    content: z.string().trim().min(1).max(3_000),
    citationIds: z.array(z.uuid()).length(0),
  }),
  z.object({
    kind: z.literal("no_support"),
    content: z.string().trim().min(1).max(3_000),
    citationIds: z.array(z.uuid()).length(0),
  }),
]);

export const groundedLearnResponseSchema = z.object({
  segments: z.array(groundedResponseSegmentSchema).min(1).max(8),
  followUpQuestions: z.array(z.string().trim().min(1).max(180)).max(3),
});

export const retrievedCourseChunkSchema = z.object({
  chunk_id: z.uuid(),
  course_id: z.uuid(),
  material_id: z.uuid(),
  content: z.string().min(1).max(12_000),
  page_start: z.number().int().positive(),
  page_end: z.number().int().positive(),
  rank_score: z.number().finite(),
  semantic_similarity: z.number().finite().nullable(),
  lexical_match: z.boolean(),
  supports_current_concept: z.boolean(),
});

export type GroundedLearnRequest = z.infer<typeof groundedLearnRequestSchema>;
export type GroundedLearnResponse = z.infer<typeof groundedLearnResponseSchema>;
export type GroundedResponseSegment = z.infer<typeof groundedResponseSegmentSchema>;
export type RetrievedCourseChunk = z.infer<typeof retrievedCourseChunkSchema>;
