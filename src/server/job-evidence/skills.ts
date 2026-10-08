import type { RetrievedCourseChunk } from "@/contracts/grounded-learning";
import { directlyMentions } from "./matching";

export const canonicalJobSkills = [
  { term: "SQL", aliases: ["Structured Query Language"] },
  { term: "Python", aliases: [] },
  { term: "TypeScript", aliases: [] },
  { term: "JavaScript", aliases: [] },
  { term: "Java", aliases: [] },
  { term: "Docker", aliases: [] },
  { term: "Git", aliases: [] },
  { term: "AWS", aliases: ["Amazon Web Services"] },
  { term: "PostgreSQL", aliases: ["Postgres"] },
  { term: "Kubernetes", aliases: ["K8s"] },
] as const;

/** Only source-backed course chunks count; questions and model responses are not inputs. */
export function skillsExplicitlyInCourse(chunks: readonly RetrievedCourseChunk[]): string[] {
  return canonicalJobSkills
    .filter(({ term, aliases }) => chunks.some((chunk) =>
      [term, ...aliases].some((candidate) => directlyMentions(chunk.content, candidate))))
    .map(({ term }) => term);
}
