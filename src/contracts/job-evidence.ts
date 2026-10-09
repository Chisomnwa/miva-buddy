import { z } from "zod";

const httpsUrl = z.string().url().refine((value) => new URL(value).protocol === "https:", "Evidence links must use HTTPS.");
const timestamp = z.string().datetime({ offset: true });

export const jobEvidenceItemSchema = z.object({
  providerId: z.string().min(1).max(80),
  postingId: z.string().min(1).max(160),
  title: z.string().min(1).max(240),
  company: z.string().min(1).max(200),
  location: z.string().max(240).nullable(),
  matchedTerm: z.string().min(1).max(100),
  excerpt: z.string().min(1).max(1_200),
  sourceName: z.string().min(1).max(100),
  sourceUrl: httpsUrl,
  attributionLabel: z.string().min(1).max(120),
  attributionUrl: httpsUrl,
  publishedAt: timestamp.nullable(),
  retrievedAt: timestamp,
});

/** A link-only reference is navigation, not evidence that a skill occurs in a posting. */
export const jobReferenceSchema = z.object({
  providerId: z.string().min(1).max(80),
  postingId: z.string().min(1).max(160),
  title: z.string().min(1).max(240),
  company: z.string().min(1).max(200),
  location: z.string().max(240).nullable(),
  /** Source-provided tags only; these do not imply description-level evidence. */
  tags: z.array(z.string().min(1).max(80)).max(20),
  /** Exact overlaps between a course term and source-provided tags, never prose claims. */
  matchedTags: z.array(z.string().min(1).max(80)).max(10),
  sourceName: z.string().min(1).max(100),
  sourceUrl: httpsUrl,
  attributionLabel: z.string().min(1).max(120),
  attributionUrl: httpsUrl,
  publishedAt: timestamp.nullable(),
  retrievedAt: timestamp,
  kind: z.literal("metadata_only"),
}).strict();

export const jobEvidenceResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("found"), items: z.array(jobEvidenceItemSchema).min(1).max(20) }),
  z.object({ status: z.literal("references_only"), items: z.array(jobReferenceSchema).min(1).max(20) }),
  z.object({ status: z.literal("no_evidence") }),
  z.object({ status: z.literal("source_not_approved") }),
  z.object({ status: z.literal("failed"), retryable: z.boolean() }),
  z.object({ status: z.literal("rate_limited"), retryAfterSeconds: z.number().int().positive().nullable() }),
  z.object({ status: z.literal("stale"), providerId: z.string().min(1), postingId: z.string().min(1), lastVerifiedAt: timestamp }),
  z.object({ status: z.literal("removed"), providerId: z.string().min(1), postingId: z.string().min(1) }),
]);

export type JobEvidenceItem = z.infer<typeof jobEvidenceItemSchema>;
export type JobReference = z.infer<typeof jobReferenceSchema>;
export type JobEvidenceResult = z.infer<typeof jobEvidenceResultSchema>;
