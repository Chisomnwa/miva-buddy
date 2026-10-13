import { z } from "zod";

export const courseFlashcardsRequestSchema = z.object({
  courseId: z.uuid(),
  materialId: z.uuid(),
  conceptId: z.uuid(),
  sourceVersion: z.string().min(1).max(2_000),
});

export const courseFlashcardSchema = z.object({
  question: z.string().trim().min(4).max(240),
  answer: z.string().trim().min(1).max(1_200),
  highlightTerms: z.array(z.string().trim().min(1).max(48)).max(4),
  citationIds: z.array(z.uuid()).min(1).max(3),
});

export const courseFlashcardsSchema = z.object({
  cards: z.array(courseFlashcardSchema).max(12),
});

export const courseFlashcardsResponseSchema = z.object({
  cards: z.array(z.object({
    question: z.string(),
    answer: z.string(),
    highlightTerms: z.array(z.string()),
  })),
  emptyReason: z.enum(["insufficient_sources", "no_supported_cards"]).optional(),
});

export const courseFlashcardsErrorSchema = z.enum([
  "invalid_origin",
  "invalid_request",
  "request_too_large",
  "not_authenticated",
  "course_not_found",
  "material_not_ready",
  "concept_not_found",
  "sources_unavailable",
  "source_changed",
  "rate_limited",
  "generation_timeout",
  "provider_quota",
  "provider_configuration",
  "provider_rejected",
  "provider_unavailable",
  "invalid_generation",
  "generation_unavailable",
  "unexpected_error",
]);

export type CourseFlashcard = z.infer<typeof courseFlashcardSchema>;
export type CourseFlashcardsResponse = z.infer<typeof courseFlashcardsResponseSchema>;
export type CourseFlashcardsError = z.infer<typeof courseFlashcardsErrorSchema>;
