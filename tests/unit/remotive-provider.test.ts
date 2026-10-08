import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRemotiveJobEvidenceProvider, createRemotiveRequestGate } from "@/server/job-evidence/remotive-provider";
import { EvidenceUseNotAuthorizedError, type EvidenceUseGrant } from "@/server/job-evidence/permissions";

vi.mock("server-only", () => ({}));

const allowedMetadata: EvidenceUseGrant = {
  retrieve: "permitted",
  display_metadata: "permitted",
  display_excerpt: "unclear",
  cache: "unclear",
};

const row = {
  id: 42,
  title: "Junior SQL Developer",
  company_name: "Example Co",
  candidate_required_location: "Remote",
  url: "https://remotive.com/remote-jobs/software-dev/junior-sql-developer-42",
  publication_date: "2026-10-08T00:00:00Z",
  description: "<p>Use SQL to analyze customer data.</p><script>secret()</script>",
};

function response(jobs: unknown[] = [row], status = 200): Response {
  return new Response(JSON.stringify({ jobs }), { status, headers: { "content-type": "application/json" } });
}

describe("Remotive provider permission and network boundary", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("does not make a request unless retrieval and metadata display are explicitly permitted", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const provider = createRemotiveJobEvidenceProvider({ grant: { ...allowedMetadata, retrieve: "conditional" }, fetchImpl });
    await expect(provider.search({ terms: ["SQL"] })).rejects.toBeInstanceOf(EvidenceUseNotAuthorizedError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns metadata-only references when excerpt display is not permitted, without exposing description text", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response());
    const provider = createRemotiveJobEvidenceProvider({
      grant: allowedMetadata,
      fetchImpl,
      now: () => new Date("2026-10-08T12:00:00Z"),
      requestGate: () => null,
    });
    const result = await provider.search({ terms: ["SQL"] });
    expect(result.status).toBe("references_only");
    if (result.status !== "references_only") throw new Error("Expected metadata-only reference result");
    expect(result.items[0]).toMatchObject({ kind: "metadata_only", sourceName: "Remotive", attributionLabel: "Source: Remotive" });
    expect(result.items[0].sourceUrl).toBe(row.url);
    expect(JSON.stringify(result)).not.toContain("customer data");
    expect(fetchImpl.mock.calls[0][0]).toBeInstanceOf(URL);
    const requestUrl = fetchImpl.mock.calls[0][0] as URL;
    expect(requestUrl.origin + requestUrl.pathname).toBe("https://remotive.com/api/remote-jobs");
    expect(requestUrl.searchParams.get("search")).toBe("SQL");
    expect(requestUrl.searchParams.get("limit")).toBe("10");
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ cache: "no-store", redirect: "error" });
  });

  it("returns a matched excerpt only with a separate explicit excerpt grant and exact skill support", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response());
    const provider = createRemotiveJobEvidenceProvider({
      grant: { ...allowedMetadata, display_excerpt: "permitted" },
      fetchImpl,
      now: () => new Date("2026-10-08T12:00:00Z"),
      requestGate: () => null,
    });
    const result = await provider.search({ terms: ["SQL"] });
    expect(result.status).toBe("found");
    if (result.status !== "found") throw new Error("Expected excerpt evidence result");
    expect(result.items[0]).toMatchObject({ matchedTerm: "SQL", sourceName: "Remotive", sourceUrl: row.url });
    expect(result.items[0].excerpt).toContain("SQL");
    expect(result.items[0].excerpt).not.toContain("secret()");
  });

  it("does not turn generic or false-positive text into skill evidence", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response([{ ...row, description: "Use PostgreSQL. NoSQL is unrelated." }]));
    const provider = createRemotiveJobEvidenceProvider({
      grant: { ...allowedMetadata, display_excerpt: "permitted" }, fetchImpl,
      now: () => new Date("2026-10-08T12:00:00Z"), requestGate: () => null,
    });
    expect(await provider.search({ terms: ["SQL"] })).toEqual({ status: "no_evidence" });
  });

  it("rejects non-Remotive listing links rather than returning third-party destinations as Remotive evidence", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response([{ ...row, url: "https://example.org/job" }]));
    const provider = createRemotiveJobEvidenceProvider({ grant: allowedMetadata, fetchImpl, requestGate: () => null });
    expect(await provider.search({ terms: ["SQL"] })).toEqual({ status: "no_evidence" });
  });

  it("applies a process-local maximum of four requests per UTC day and a 30-second minimum interval", () => {
    const gate = createRemotiveRequestGate();
    const start = new Date("2026-10-08T12:00:00Z");
    expect(gate(start)).toBeNull();
    expect(gate(new Date(start.getTime() + 29_000))).toBe(1);
    expect(gate(new Date(start.getTime() + 30_000))).toBeNull();
    expect(gate(new Date(start.getTime() + 60_000))).toBeNull();
    expect(gate(new Date(start.getTime() + 90_000))).toBeNull();
    expect(gate(new Date(start.getTime() + 120_000))).toBeGreaterThan(0);
    expect(gate(new Date("2026-10-09T00:00:00Z"))).toBeNull();
  });
});
