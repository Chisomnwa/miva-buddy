import { z } from "zod";

/** Development-only presentation; it is deliberately not a JobEvidenceItem. */
export const industryDemoSchema = z.object({
  kind: z.literal("demonstration"),
  label: z.literal("DEMONSTRATION ONLY — NOT A REAL JOB POSTING"),
  matchedTerm: z.string().min(1).max(100),
  title: z.literal("Synthetic software engineering role"),
  company: z.literal("Example organization (synthetic)"),
  excerpt: z.string().min(1).max(300),
  notice: z.literal("This sample is illustrative only. It is not job evidence and has no live source or application link."),
}).strict();

export type IndustryDemo = z.infer<typeof industryDemoSchema>;
