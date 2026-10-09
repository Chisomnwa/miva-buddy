import { describe, expect, it, vi } from "vitest";
import { jobEvidenceItemSchema, jobEvidenceResultSchema } from "@/contracts/job-evidence";
import { buildEvidenceItem, directlyMentions } from "@/server/job-evidence/matching";
import { checkEvidenceFreshness } from "@/server/job-evidence/freshness";
import {
  normalizeAshbyRecord,
  normalizeGreenhouseRecord,
  normalizeLeverRecord,
  normalizeRemotiveRecord,
  toMetadataReference,
} from "@/server/job-evidence/normalizers";
import { mayCacheEvidence, requireEvidencePermission, EvidenceUseNotAuthorizedError, type EvidenceUseGrant } from "@/server/job-evidence/permissions";
import { jobEvidenceFixtures } from "../fixtures/job-evidence";
import { searchJobEvidence } from "@/server/job-evidence/search";
import type { JobEvidenceProvider } from "@/server/job-evidence/provider";

const permittedFixtureGrant: EvidenceUseGrant = {
  retrieve: "permitted",
  display_metadata: "permitted",
  display_excerpt: "permitted",
  cache: "permitted",
};

const unclearFixtureGrant: EvidenceUseGrant = {
  retrieve: "permitted",
  display_metadata: "conditional",
  display_excerpt: "unclear",
  cache: "unclear",
};

const retrievedAt = "2026-10-08T12:00:00.000Z";
const now = new Date("2026-10-08T12:30:00.000Z");
const maxAgeMs = 24 * 60 * 60 * 1_000;
const syntheticDescription = "Synthetic requirement: build services with TypeScript. We use NoSQL for an unrelated synthetic example.";

describe("source-independent job-evidence contract", () => {
  it.each(Object.entries(jobEvidenceFixtures))("accepts the %s fixture outcome", (_name, fixture) => {
    expect(jobEvidenceResultSchema.safeParse(fixture).success).toBe(true);
  });

  it("requires a direct excerpt and a traceable HTTPS source URL for found evidence", () => {
    const item = jobEvidenceFixtures.found.status === "found" ? jobEvidenceFixtures.found.items[0] : undefined;
    expect(item).toBeDefined();
    expect(jobEvidenceItemSchema.safeParse({ ...item, sourceUrl: "http://example.com/job" }).success).toBe(false);
    expect(jobEvidenceItemSchema.safeParse({ ...item, excerpt: "" }).success).toBe(false);
    expect(jobEvidenceResultSchema.safeParse({ status: "found", items: [] }).success).toBe(false);
    expect(jobEvidenceItemSchema.safeParse({ ...item, attributionUrl: "http://example.com/source" }).success).toBe(false);
  });

  it("does not collapse no-evidence, provider failure, rate-limit, stale, and removed states", () => {
    const statuses = Object.values(jobEvidenceFixtures).map((fixture) => fixture.status);
    expect(new Set(statuses).size).toBe(statuses.length);
  });

  it("returns SourceNotApproved without querying when retrieval or the requested reuse is not approved", async () => {
    const search = vi.fn<JobEvidenceProvider["search"]>().mockResolvedValue(jobEvidenceFixtures.noEvidence);
    const provider: JobEvidenceProvider = { search };
    const retrievalDenied = { ...permittedFixtureGrant, retrieve: "unclear" as const };
    const excerptDenied = { ...permittedFixtureGrant, display_excerpt: "unclear" as const };

    await expect(searchJobEvidence(provider, { terms: ["TypeScript"] }, retrievalDenied, "metadata"))
      .resolves.toEqual({ status: "source_not_approved" });
    await expect(searchJobEvidence(provider, { terms: ["TypeScript"] }, excerptDenied, "excerpt"))
      .resolves.toEqual({ status: "source_not_approved" });
    expect(search).not.toHaveBeenCalled();
  });

  it("keeps a completed empty search distinct from a retrieval failure", async () => {
    const provider: JobEvidenceProvider = {
      search: vi.fn<JobEvidenceProvider["search"]>().mockResolvedValue(jobEvidenceFixtures.noEvidence),
    };
    await expect(searchJobEvidence(provider, { terms: ["TypeScript"] }, permittedFixtureGrant, "excerpt"))
      .resolves.toEqual({ status: "no_evidence" });

    const throwingProvider: JobEvidenceProvider = { search: vi.fn().mockRejectedValue(new Error("private provider detail")) };
    await expect(searchJobEvidence(throwingProvider, { terms: ["TypeScript"] }, permittedFixtureGrant, "excerpt"))
      .resolves.toEqual({ status: "failed", retryable: true });

    const malformedProvider = {
      search: vi.fn().mockResolvedValue({ status: "found", items: [] }),
    } as unknown as JobEvidenceProvider;
    await expect(searchJobEvidence(malformedProvider, { terms: ["TypeScript"] }, permittedFixtureGrant, "excerpt"))
      .resolves.toEqual({ status: "failed", retryable: false });
  });

  it("normalizes synthetic records from each supported source shape without network access", () => {
    const remotive = normalizeRemotiveRecord({
      id: "r-synthetic", title: "Synthetic Engineer", company_name: "Example Test Company",
      candidate_required_location: "Worldwide", url: "https://example.invalid/remotive/r-synthetic",
      publication_date: "2026-10-07", description: syntheticDescription,
    }, retrievedAt);
    const greenhouse = normalizeGreenhouseRecord({
      id: 11, title: "Synthetic Engineer", company_name: "Example Test Company",
      location: { name: "Remote" }, absolute_url: "https://example.invalid/greenhouse/11",
      first_published: "2026-10-07T00:00:00Z", content: syntheticDescription,
    }, retrievedAt);
    const ashby = normalizeAshbyRecord({
      id: "a-synthetic", title: "Synthetic Engineer", companyName: "Example Test Company",
      location: "Remote", jobUrl: "https://example.invalid/ashby/a-synthetic",
      publishedAt: "2026-10-07T00:00:00Z", descriptionPlain: syntheticDescription, isListed: true,
    }, retrievedAt);
    const lever = normalizeLeverRecord({
      id: "l-synthetic", text: "Synthetic Engineer", companyName: "Example Test Company",
      categories: { location: "Remote" }, hostedUrl: "https://example.invalid/lever/l-synthetic",
      createdAt: "2026-10-07T00:00:00Z", descriptionPlain: syntheticDescription,
      lists: [{ content: "Synthetic preference: TypeScript." }], state: "published",
    }, retrievedAt);

    for (const listing of [remotive, greenhouse, ashby, lever]) {
      expect(listing?.postingId).toBeTruthy();
      expect(listing?.sourceUrl).toMatch(/^https:\/\//);
      expect(listing?.attributionLabel).toBeTruthy();
      expect(listing?.description).toContain("Synthetic");
    }
    expect(remotive?.attributionLabel).toBe("Source: Remotive");
    expect(normalizeAshbyRecord({ id: "hidden", title: "Hidden", companyName: "Example", jobUrl: "https://example.invalid/hidden", descriptionPlain: "Synthetic", isListed: false }, retrievedAt)).toBeNull();
    expect(normalizeLeverRecord({ id: "closed", text: "Closed", company: "Example", hostedUrl: "https://example.invalid/closed", descriptionPlain: "Synthetic", state: "closed" }, retrievedAt)).toBeNull();
  });

  it("only creates excerpt evidence when permission is explicit and the excerpt directly names the matched skill", () => {
    const listing = normalizeGreenhouseRecord({
      id: 12, title: "Synthetic Engineer", company_name: "Example Test Company",
      absolute_url: "https://example.invalid/greenhouse/12", content: syntheticDescription,
    }, retrievedAt);
    expect(listing).not.toBeNull();
    if (!listing) return;

    expect(buildEvidenceItem(listing, "TypeScript", [], permittedFixtureGrant, now, maxAgeMs)?.excerpt)
      .toBe("Synthetic requirement: build services with TypeScript.");
    expect(buildEvidenceItem(listing, "SQL", ["Structured Query Language"], permittedFixtureGrant, now, maxAgeMs)).toBeNull();
    expect(buildEvidenceItem(listing, "TypeScript", [], permittedFixtureGrant, now, 1_000)).toBeNull();
    expect(() => buildEvidenceItem(listing, "TypeScript", [], unclearFixtureGrant, now, maxAgeMs))
      .toThrow(EvidenceUseNotAuthorizedError);
    expect(directlyMentions("We use NoSQL in this synthetic test.", "SQL")).toBe(false);
    expect(directlyMentions("C++ is used in this synthetic test.", "C")).toBe(false);
    expect(directlyMentions("C is used in this synthetic test.", "C")).toBe(true);
    expect(directlyMentions("Node.js is used in this synthetic test.", "Node.js")).toBe(true);
  });

  it("keeps metadata-only references distinct and prevents them from carrying skill claims", () => {
    const listing = normalizeRemotiveRecord({
      id: "r-reference", title: "Synthetic Engineer", company_name: "Example Test Company",
      url: "https://example.invalid/remotive/r-reference", description: syntheticDescription,
    }, retrievedAt);
    expect(listing).not.toBeNull();
    if (!listing) return;

    const reference = toMetadataReference(listing, permittedFixtureGrant);
    expect(reference.kind).toBe("metadata_only");
    expect("excerpt" in reference).toBe(false);
    expect("matchedTerm" in reference).toBe(false);
    expect(jobEvidenceResultSchema.safeParse({ status: "references_only", items: [reference] }).success).toBe(true);
    expect(jobEvidenceResultSchema.safeParse({ status: "references_only", items: [{ ...reference, excerpt: "Synthetic" }] }).success).toBe(false);
    expect(() => toMetadataReference(listing, unclearFixtureGrant)).toThrow(EvidenceUseNotAuthorizedError);
  });

  it("fails closed for retrieval and cache permissions unless explicitly permitted", () => {
    expect(() => requireEvidencePermission(unclearFixtureGrant, "retrieve")).not.toThrow();
    expect(mayCacheEvidence(permittedFixtureGrant)).toBe(true);
    expect(mayCacheEvidence(unclearFixtureGrant)).toBe(false);
    expect(() => requireEvidencePermission({ ...permittedFixtureGrant, retrieve: "unclear" }, "retrieve"))
      .toThrow(EvidenceUseNotAuthorizedError);
  });

  it("marks stale, malformed, future, and fresh retrieval timestamps deterministically", () => {
    const now = new Date("2026-10-08T12:00:00.000Z");
    expect(checkEvidenceFreshness("2026-10-08T11:00:00.000Z", now, 2 * 60 * 60 * 1_000)).toBe("fresh");
    expect(checkEvidenceFreshness("2026-10-08T09:00:00.000Z", now, 2 * 60 * 60 * 1_000)).toBe("stale");
    expect(checkEvidenceFreshness("not-a-date", now, 2 * 60 * 60 * 1_000)).toBe("invalid");
    expect(checkEvidenceFreshness("2026-10-08T13:00:00.000Z", now, 2 * 60 * 60 * 1_000)).toBe("invalid");
  });
});
