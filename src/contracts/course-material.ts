import { z } from "zod";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 120;
export const MAX_NOTES_CHARACTERS = 100_000;
export const MAX_MATERIAL_TEXT_CHARACTERS = 500_000;
export const MAX_MATERIAL_TITLE = 180;
export const DEFAULT_COURSE_MATERIAL_DAILY_COUNT_LIMIT = 5;
export const DEFAULT_COURSE_MATERIAL_DAILY_BYTES_LIMIT = 50 * 1024 * 1024;
export const DEFAULT_COURSE_MATERIAL_MANUAL_RETRY_LIMIT = 2;

export function pdfFileMetadataError(file: { name: string; size: number; type?: string } | null): string | null {
  if (!file) return "Choose a PDF file.";
  if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) {
    return "Choose a PDF file. Other file types aren't supported.";
  }
  if (file.size < 8) return "This file is too small to be a valid PDF.";
  if (file.size > MAX_PDF_BYTES) return "This PDF is larger than the 10 MiB limit.";
  return null;
}

export const courseInputSchema = z.object({
  title: z.string().trim().min(2).max(120),
  courseCode: z.string().trim().max(40).optional().transform((value) => value || null),
});

export const materialNotesInputSchema = z.object({
  courseId: z.uuid(),
  title: z.string().trim().min(1).max(MAX_MATERIAL_TITLE),
  content: z.string().trim().min(1).max(MAX_NOTES_CHARACTERS),
});

export const materialConceptSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(1000),
  supportingChunkIds: z.array(z.uuid()).min(1).max(5),
});

export const conceptExtractionSchema = z.object({
  concepts: z.array(materialConceptSchema).min(1).max(6),
});

export const processMaterialJobSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("notes"),
    userId: z.uuid(),
    courseId: z.uuid(),
    materialId: z.uuid(),
  }),
  z.object({
    kind: z.literal("pdf"),
    userId: z.uuid(),
    courseId: z.uuid(),
    materialId: z.uuid(),
    signedUrl: z.url(),
  }),
]);

export type ConceptExtraction = z.infer<typeof conceptExtractionSchema>;
export type ProcessMaterialJob = z.infer<typeof processMaterialJobSchema>;
