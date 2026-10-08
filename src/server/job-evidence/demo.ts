import type { IndustryDemo } from "@/contracts/industry-demo";
import { industryDemoSchema } from "@/contracts/industry-demo";
import type { RetrievedCourseChunk } from "@/contracts/grounded-learning";
import { skillsExplicitlyInCourse } from "./skills";

/** Never returns a demo payload in production. It is not source evidence. */
export function createIndustryDemonstration(
  chunks: readonly RetrievedCourseChunk[],
  environment: string,
): IndustryDemo | null {
  if (environment === "production") return null;
  const matchedTerm = skillsExplicitlyInCourse(chunks)[0];
  if (!matchedTerm) return null;
  return industryDemoSchema.parse({
    kind: "demonstration",
    label: "DEMONSTRATION ONLY — NOT A REAL JOB POSTING",
    matchedTerm,
    title: "Synthetic software engineering role",
    company: "Example organization (synthetic)",
    excerpt: `Illustrative sample only: a real posting would need to directly mention ${matchedTerm}.`,
    notice: "This sample is illustrative only. It is not job evidence and has no live source or application link.",
  });
}
