import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IndustryEvidenceCard } from "@/components/industry-evidence-card";
import { RemoteOkEvidence } from "@/components/remoteok-evidence";
import { HimalayasEvidence } from "@/components/himalayas-evidence";
import { industryDemoSchema } from "@/contracts/industry-demo";
import type { JobEvidenceResult } from "@/contracts/job-evidence";
import { createIndustryDemonstration } from "@/server/job-evidence/demo";
import { skillsExplicitlyInCourse } from "@/server/job-evidence/skills";
import type { RetrievedCourseChunk } from "@/contracts/grounded-learning";
import { jobEvidenceFixtures } from "../fixtures/job-evidence";

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

  it("renders Remote OK references as metadata-only cards with direct attribution and no description", () => {
    const result = {
      status: "references_only" as const,
      items: [{
        providerId: "remoteok",
        postingId: "synthetic-remoteok-1",
        title: "Software Engineer — synthetic test",
        company: "Synthetic Test Company",
        location: "Remote",
        tags: ["dev", "python"],
        matchedTags: ["python"],
        sourceName: "Remote OK",
        sourceUrl: "https://remoteok.com/remote-jobs/synthetic-test",
        attributionLabel: "Source: Remote OK",
        attributionUrl: "https://remoteok.com/",
        publishedAt: "2026-10-07T08:00:00.000Z",
        retrievedAt: "2026-10-08T10:00:00.000Z",
        kind: "metadata_only" as const,
      }],
    };
    const html = renderToStaticMarkup(<RemoteOkEvidence result={result} />);
    expect(html).toContain("REMOTE OK · METADATA ONLY");
    expect(html).toContain("Job descriptions were not checked");
    expect(html).toContain("Source: Remote OK");
    expect(html).toContain("https://remoteok.com/remote-jobs/synthetic-test");
    expect(html).toContain("Remote OK tag match: python");
    expect(html).not.toContain("excerpt");
    expect(html).not.toContain("Synthetic private marker");
    expect(html).not.toContain("Apply");
  });

  it("renders Himalayas results as related discovery, never verified requirements", () => {
    const result: JobEvidenceResult = {
      status: "references_only",
      items: [{
        providerId: "himalayas",
        postingId: "synthetic-himalayas-1",
        title: "Synthetic Software Engineer",
        company: "Synthetic Company",
        location: null,
        tags: [],
        matchedTags: [],
        sourceName: "Himalayas",
        sourceUrl: "https://himalayas.app/jobs/synthetic-company/software-engineer",
        attributionLabel: "Source: Himalayas",
        attributionUrl: "https://himalayas.app/",
        publishedAt: "2026-10-05T00:00:00.000Z",
        retrievedAt: "2026-10-09T10:00:00.000Z",
        kind: "metadata_only",
      }],
    };
    const html = renderToStaticMarkup(<HimalayasEvidence result={result} />);
    expect(html).toContain("HIMALAYAS · RELATED LISTINGS");
    expect(html).toContain("Synthetic Software Engineer");
    expect(html).toContain("Synthetic Company");
    expect(html).toContain("matched a keyword grounded in your course material");
    expect(html).toContain("Descriptions were not checked");
    expect(html).toContain("Source: Himalayas");
    expect(html).toContain("Published 2026-10-05");
    expect(html).toContain("Retrieved 2026-10-09");
    expect(html).toContain("View listing on Himalayas");
    expect(html).toContain("https://himalayas.app/jobs/synthetic-company/software-engineer");
    expect(html).not.toContain("Relevant job requirements");
    expect(html).not.toContain("Course concept match");
    expect(html).not.toContain("<blockquote");
  });

  it.each([
    ["no_evidence", "The Himalayas search completed but found no current related listings"],
    ["source_not_approved", "Himalayas job discovery wasn’t searched because its source-use gate is not approved"],
    ["failed", "Himalayas listings are temporarily unavailable or could not be verified as current"],
  ] as const)("communicates Himalayas %s independently of the lesson", (status, message) => {
    const result: JobEvidenceResult = status === "no_evidence" ? { status }
      : status === "source_not_approved" ? { status }
        : { status, retryable: true };
    const html = renderToStaticMarkup(<HimalayasEvidence result={result} />);
    expect(html).toContain(message);
    expect(html).toContain("Your lesson is unaffected.");
  });

  it.each([
    ["no_evidence", "The approved job-evidence search completed but found no qualifying matches."],
    ["source_not_approved", "Job evidence wasn’t searched because the source isn’t approved for this use."],
    ["failed", "The job-evidence search couldn’t be completed reliably."],
  ] as const)("communicates %s without implying the lesson failed", (status, message) => {
    const result = jobEvidenceFixturesForUi(status);
    const html = renderToStaticMarkup(<RemoteOkEvidence result={result} />);
    expect(html).toContain(message);
    expect(html).toContain("Your lesson is unaffected.");
  });

  it("renders found evidence with its excerpt, attribution, and original listing link", () => {
    const result = jobEvidenceFixturesForUi("found");
    const html = renderToStaticMarkup(<RemoteOkEvidence result={result} />);
    expect(html).toContain("Relevant job requirements");
    expect(html).toContain("Synthetic requirement: experience building services with TypeScript.");
    expect(html).toContain("Synthetic fixture source");
    expect(html).toContain("https://example.invalid/jobs/synthetic-role-001");
  });

  it.each([
    ["rateLimited", "The Remote OK lookup is paused to respect its request limit."],
    ["stale", "The available job evidence is too old to show."],
    ["removed", "A previously found listing is no longer available."],
  ] as const)("keeps the %s outcome distinct", (fixture, message) => {
    const html = renderToStaticMarkup(<RemoteOkEvidence result={jobEvidenceFixtures[fixture]} />);
    expect(html).toContain(message);
    expect(html).toContain("Your lesson is unaffected.");
  });
});

function jobEvidenceFixturesForUi(status: "found" | "no_evidence" | "source_not_approved" | "failed"): JobEvidenceResult {
  if (status === "found") return jobEvidenceFixtures.found;
  if (status === "no_evidence") return jobEvidenceFixtures.noEvidence;
  if (status === "source_not_approved") return jobEvidenceFixtures.sourceNotApproved;
  return jobEvidenceFixtures.failed;
}
