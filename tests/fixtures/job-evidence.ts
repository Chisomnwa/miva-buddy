import type { JobEvidenceResult } from "@/contracts/job-evidence";

const retrievedAt = "2026-10-08T12:00:00Z";

export const jobEvidenceFixtures: Record<string, JobEvidenceResult> = {
  found: {
    status: "found",
    items: [{
      providerId: "fixture",
      postingId: "synthetic-role-001",
      title: "Synthetic Software Engineer",
      company: "Example Test Company",
      location: "Lagos, Nigeria",
      matchedTerm: "TypeScript",
      excerpt: "Synthetic requirement: experience building services with TypeScript.",
      sourceName: "Fixture source — not live job evidence",
      sourceUrl: "https://example.invalid/jobs/synthetic-role-001",
      attributionLabel: "Synthetic fixture source",
      attributionUrl: "https://example.invalid/",
      publishedAt: "2026-10-01T09:00:00Z",
      retrievedAt,
    }],
  },
  referencesOnly: {
    status: "references_only",
    items: [{
      providerId: "fixture",
      postingId: "synthetic-reference-001",
      title: "Synthetic Software Engineer",
      company: "Example Test Company",
      location: null,
      tags: ["synthetic"],
      matchedTags: [],
      sourceName: "Fixture source — not live job evidence",
      sourceUrl: "https://example.invalid/jobs/synthetic-reference-001",
      attributionLabel: "Synthetic fixture source",
      attributionUrl: "https://example.invalid/",
      publishedAt: null,
      retrievedAt,
      kind: "metadata_only",
    }],
  },
  noEvidence: { status: "no_evidence" },
  sourceNotApproved: { status: "source_not_approved" },
  failed: { status: "failed", retryable: true },
  rateLimited: { status: "rate_limited", retryAfterSeconds: 60 },
  stale: { status: "stale", providerId: "fixture", postingId: "synthetic-role-old", lastVerifiedAt: "2026-09-01T09:00:00Z" },
  removed: { status: "removed", providerId: "fixture", postingId: "synthetic-role-closed" },
};
