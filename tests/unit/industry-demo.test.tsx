import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IndustryEvidenceCard } from "@/components/industry-evidence-card";
import { industryDemoSchema } from "@/contracts/industry-demo";
import { createIndustryDemonstration } from "@/server/job-evidence/demo";
import { skillsExplicitlyInCourse } from "@/server/job-evidence/skills";
import type { RetrievedCourseChunk } from "@/contracts/grounded-learning";

function chunk(content: string): RetrievedCourseChunk {
  return {
    chunk_id: "1c6de022-9194-4b23-9f21-92c370da2067",
    course_id: "4f9c1f4f-53e2-4a87-a5ea-a7a27bf0ef78",
    material_id: "a22fd7c1-7936-4eb3-b8aa-eed83c2b5678",
    content,
    page_start: 1,
    page_end: 1,
    rank_score: 1,
    semantic_similarity: 0.8,
    lexical_match: true,
    supports_current_concept: true,
  };
}

describe("M8 industry evidence demonstration", () => {
  it("detects only canonical skills and direct aliases in retrieved course chunks", () => {
    expect(skillsExplicitlyInCourse([chunk("Synthetic lecture: SQL and PostgreSQL are used in the example.")]))
      .toEqual(["SQL", "PostgreSQL"]);
    expect(skillsExplicitlyInCourse([chunk("Synthetic lecture: NoSQL and hash maps are discussed.")]))
      .toEqual([]);
    expect(skillsExplicitlyInCourse([chunk("Synthetic lecture: Amazon Web Services is abbreviated as AWS.")]))
      .toEqual(["AWS"]);
  });

  it("does not provide a synthetic posting payload in production", () => {
    expect(createIndustryDemonstration([chunk("Synthetic material mentions Python.")], "production")).toBeNull();
    expect(createIndustryDemonstration([chunk("No specific tool is named.")], "development")).toBeNull();
  });

  it("returns an explicitly labeled non-evidence demonstration only in development", () => {
    const demo = createIndustryDemonstration([chunk("Synthetic material explicitly mentions TypeScript.")], "development");
    expect(demo).not.toBeNull();
    expect(industryDemoSchema.safeParse(demo).success).toBe(true);
    expect(demo?.label).toContain("NOT A REAL JOB POSTING");
    expect(demo?.notice).toContain("not job evidence");

    const html = renderToStaticMarkup(<IndustryEvidenceCard demonstration={demo} />);
    expect(html).toContain("DEMONSTRATION ONLY — NOT A REAL JOB POSTING");
    expect(html).toContain("Synthetic software engineering role");
    expect(html).not.toContain("<a ");
    expect(html).toContain("no live source or application link");
  });

  it("rejects a demo object that tries to masquerade as a sourced posting", () => {
    const demo = createIndustryDemonstration([chunk("Synthetic material mentions Git.")], "development");
    expect(industryDemoSchema.safeParse({ ...demo, sourceUrl: "https://example.com/job" }).success).toBe(false);
    expect(industryDemoSchema.safeParse({ ...demo, label: "Seen in industry" }).success).toBe(false);
  });
});
