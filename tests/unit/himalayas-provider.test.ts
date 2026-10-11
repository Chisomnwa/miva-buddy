import { describe, expect, it, vi } from "vitest";
import { searchJobEvidence } from "@/server/job-evidence/search";
import {
  createHimalayasJobEvidenceProvider,
  createHimalayasRequestGate,
  himalayasMetadataGrant,
  isHimalayasMetadataEnabled,
  normalizeHimalayasReference,
} from "@/server/job-evidence/himalayas-provider";
import type { EvidenceUseGrant } from "@/server/job-evidence/permissions";

vi.mock("server-only", () => ({}));

const nowValue = new Date("2026-10-09T10:00:00.000Z");
const validRow = {
  guid: "job-synthetic-17",
  title: "Software Engineer",
  companyName: "Example Testing Co.",
  pubDate: Date.parse("2026-10-05T00:00:00.000Z"),
  expiryDate: Date.parse("2026-11-05T00:00:00.000Z"),
  applicationLink: "https://himalayas.app/jobs/example-testing-co/software-engineer",
};
const validPayload = (jobs: unknown[]) => ({ updatedAt: nowValue.getTime() - 60 * 60 * 1_000, jobs });

function fakeFetch(payload: unknown, status = 200, headers?: HeadersInit): ReturnType<typeof vi.fn<typeof fetch>> {
  return vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(payload), { status, headers }));
}

function makeProvider(fetchImpl: typeof fetch, requestGate: () => number | null = () => null) {
  return createHimalayasJobEvidenceProvider({
    fetchImpl,
    now: () => nowValue,
    requestGate,
  });
}

describe("Himalayas metadata-only API adapter", () => {
  it("projects attributed title/company/date/link metadata and never reads descriptions", async () => {
    const row = { ...validRow };
    Object.defineProperty(row, "description", { get() { throw new Error("description must not be accessed"); } });
    expect(() => normalizeHimalayasReference(row, nowValue.toISOString())).not.toThrow();
    const fetchImpl = fakeFetch(validPayload([{ ...validRow, description: "Synthetic private description; must not reach UI." }]));
    const provider = makeProvider(fetchImpl);
    const result = await provider.search({ terms: ["TypeScript", "student transcript content"] });

    expect(result.status).toBe("references_only");
    if (result.status !== "references_only") return;
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      providerId: "himalayas",
      title: "Software Engineer",
      company: "Example Testing Co.",
      sourceName: "Himalayas",
      sourceUrl: validRow.applicationLink,
      attributionLabel: "Source: Himalayas",
      attributionUrl: "https://himalayas.app/",
      publishedAt: "2026-10-05T00:00:00.000Z",
      kind: "metadata_only",
      tags: [],
      matchedTags: [],
    });
    expect("excerpt" in result.items[0]).toBe(false);
    expect("matchedTerm" in result.items[0]).toBe(false);
    expect(JSON.stringify(result)).not.toContain("Synthetic private description");

    const [request, init] = fetchImpl.mock.calls[0];
    const url = new URL(String(request));
    expect(url.origin + url.pathname).toBe("https://himalayas.app/jobs/api/search");
    expect(url.searchParams.get("q")).toBe("TypeScript");
    expect(url.searchParams.get("page")).toBe("1");
    expect(url.searchParams.get("sort")).toBe("recent");
    expect(init).toMatchObject({ cache: "no-store", redirect: "error" });
  });

  it("rejects non-canonical/untrusted search terms and never sends lecture or transcript text", async () => {
    const fetchImpl = fakeFetch(validPayload([validRow]));
    const provider = makeProvider(fetchImpl);
    const result = await provider.search({ terms: ["a student asked about TypeScript in a lecture"] });
    expect(result).toEqual({ status: "no_evidence" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["missing ID", { ...validRow, guid: "" }],
    ["invalid link scheme", { ...validRow, applicationLink: "http://himalayas.app/jobs/example" }],
    ["untrusted link host", { ...validRow, applicationLink: "https://example.com/jobs/example" }],
    ["credential-bearing URL", { ...validRow, applicationLink: "https://user@himalayas.app/jobs/example" }],
    ["invalid date", { ...validRow, pubDate: "not-a-date" }],
    ["expired listing", { ...validRow, expiryDate: Date.parse("2026-10-08T00:00:00Z") }],
    ["stale listing", { ...validRow, pubDate: Date.parse("2026-09-01T00:00:00Z") }],
    ["future listing", { ...validRow, pubDate: Date.parse("2026-10-10T00:00:00Z") }],
  ])("drops malformed or non-current records (%s)", (_name, row) => {
    expect(normalizeHimalayasReference(row, nowValue.toISOString())).toBeNull();
  });

  it("returns no_evidence for a completed search with no qualifying current records", async () => {
    const provider = makeProvider(fakeFetch(validPayload([{ ...validRow, expiryDate: 0 }])));
    await expect(provider.search({ terms: ["Python"] })).resolves.toEqual({ status: "no_evidence" });
  });

  it("keeps malformed payloads, timeouts, and 429 responses distinct", async () => {
    await expect(makeProvider(fakeFetch({ results: [] })).search({ terms: ["Python"] }))
      .resolves.toEqual({ status: "failed", retryable: false });
    await expect(makeProvider(vi.fn().mockRejectedValue(new Error("private detail"))).search({ terms: ["Python"] }))
      .resolves.toEqual({ status: "failed", retryable: true });
    await expect(makeProvider(fakeFetch({}, 429, { "retry-after": "90" })).search({ terms: ["Python"] }))
      .resolves.toEqual({ status: "rate_limited", retryAfterSeconds: 90 });
  });

  it("fails safely when API freshness is absent, stale, or future-dated", async () => {
    for (const updatedAt of [undefined, nowValue.getTime() - 72 * 60 * 60 * 1_000, nowValue.getTime() + 60_000]) {
      const result = await makeProvider(fakeFetch({ updatedAt, jobs: [validRow] }))
        .search({ terms: ["Python"] });
      expect(result).toEqual({ status: "failed", retryable: true });
    }
  });

  it("rejects an oversized API response before normalizing job records", async () => {
    const payload = JSON.stringify(validPayload([validRow])).slice(0, -1) + `,"padding":"${"x".repeat(2_000_001)}"}`;
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(payload));
    const result = await makeProvider(fetchImpl).search({ terms: ["Python"] });
    expect(result).toEqual({ status: "failed", retryable: false });
  });

  it("returns a rate-limited outcome without making a request when the app cap is reached", async () => {
    const fetchImpl = fakeFetch(validPayload([validRow]));
    const result = await makeProvider(fetchImpl, () => 3_600).search({ terms: ["Python"] });
    expect(result).toEqual({ status: "rate_limited", retryAfterSeconds: 3_600 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("bounds request frequency and result count", async () => {
    const gate = createHimalayasRequestGate();
    expect(gate(new Date("2026-10-09T10:00:00.000Z"))).toBeNull();
    expect(gate(new Date("2026-10-09T10:00:30.000Z"))).toBe(30);

    const fetchImpl = fakeFetch(validPayload(Array.from({ length: 8 }, (_, index) => ({
      ...validRow,
      guid: `job-synthetic-${index}`,
    }))));
    const result = await makeProvider(fetchImpl).search({ terms: ["Python"] });
    expect(result.status).toBe("references_only");
    if (result.status === "references_only") expect(result.items).toHaveLength(3);
  });

  it("blocks provider calls when metadata display is not approved", async () => {
    const fetchImpl = fakeFetch(validPayload([validRow]));
    const deniedGrant: EvidenceUseGrant = { ...himalayasMetadataGrant, display_metadata: "unclear" };
    const result = await searchJobEvidence(createHimalayasJobEvidenceProvider({ fetchImpl, grant: deniedGrant }),
      { terms: ["Python"] }, deniedGrant, "metadata");
    expect(result).toEqual({ status: "source_not_approved" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["development", "true", true],
    ["development", "false", false],
    ["development", undefined, false],
    ["production", "true", false],
    ["production", "false", false],
    ["test", "true", false],
    ["test", "false", false],
    [undefined, "true", false],
    [undefined, undefined, false],
  ] as const)("enables the metadata pilot only for development with an explicit flag (%s, %s)",
    (nodeEnvironment, flag, expected) => {
      expect(isHimalayasMetadataEnabled(nodeEnvironment, flag)).toBe(expected);
    });
});
