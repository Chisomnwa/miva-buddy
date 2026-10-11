import { beforeEach, describe, expect, it, vi } from "vitest";
import { jobEvidenceResultSchema } from "@/contracts/job-evidence";
import {
  createRemoteOkJobEvidenceProvider,
  createRemoteOkRequestGate,
  isRemoteOkMetadataPilotEnabled,
  normalizeRemoteOkReference,
  remoteOkMetadataGrant,
} from "@/server/job-evidence/remoteok-provider";
import { EvidenceUseNotAuthorizedError, type EvidenceUseGrant } from "@/server/job-evidence/permissions";

vi.mock("server-only", () => ({}));

const retrievedAt = "2026-10-08T10:00:00.000Z";
const row = {
  id: 12345,
  slug: "synthetic-software-engineer-python",
  position: "Software Engineer, Python",
  company: "Example Corp",
  location: "Remote",
  tags: ["dev", "python", "remote"],
  date: "2026-10-07T08:00:00Z",
  url: "https://remoteok.com/remote-jobs/12345-synthetic-software-engineer-python",
  description: "Synthetic private marker: never display or return this description.",
};

function response(payload: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json", ...headers } });
}

describe("Remote OK metadata-only adapter", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("keeps the pilot opt-in and development-only", () => {
    expect(isRemoteOkMetadataPilotEnabled("development", "true")).toBe(true);
    expect(isRemoteOkMetadataPilotEnabled("production", "true")).toBe(false);
    expect(isRemoteOkMetadataPilotEnabled("development", "false")).toBe(false);
    expect(isRemoteOkMetadataPilotEnabled(undefined, "true")).toBe(false);
  });

  it("returns a few directly supported metadata references and never exposes descriptions", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response([
      { legal: "Synthetic attribution notice; not a listing." },
      row,
      { ...row, id: 12346, url: "https://remoteok.com/remote-jobs/12346-synthetic-frontend", position: "Frontend Developer", tags: ["dev", "python"] },
      { ...row, id: 12347, position: "Account Executive", tags: ["dev", "python"] },
      { ...row, id: 12348, position: "Software Engineer", tags: ["dev", "javascript"] },
    ]));
    const provider = createRemoteOkJobEvidenceProvider({
      fetchImpl,
      now: () => new Date(retrievedAt),
      requestGate: () => null,
    });

    const result = await provider.search({ terms: ["Python"] });
    expect(jobEvidenceResultSchema.safeParse(result).success).toBe(true);
    expect(result.status).toBe("references_only");
    if (result.status !== "references_only") return;
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      providerId: "remoteok",
      title: "Software Engineer, Python",
      company: "Example Corp",
      sourceName: "Remote OK",
      attributionLabel: "Source: Remote OK",
      tags: ["dev", "python", "remote"],
      matchedTags: ["python"],
      kind: "metadata_only",
    });
    expect(result.items[0].sourceUrl).toBe(row.url);
    expect(result.items[0].attributionUrl).toBe("https://remoteok.com/");
    expect(JSON.stringify(result)).not.toContain("description");
    expect(JSON.stringify(result)).not.toContain("private marker");
    expect("excerpt" in result.items[0]).toBe(false);
    expect("matchedTerm" in result.items[0]).toBe(false);

    const [requestUrl, options] = fetchImpl.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe("https://remoteok.com/api?tags=dev%2Cpython");
    expect(options).toMatchObject({ cache: "no-store", redirect: "error", method: "GET" });
  });

  it("fails closed when permission for retrieval or metadata display is missing", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const denied: EvidenceUseGrant = { ...remoteOkMetadataGrant, display_metadata: "conditional" };
    const provider = createRemoteOkJobEvidenceProvider({ grant: denied, fetchImpl, requestGate: () => null });
    await expect(provider.search({ terms: ["Python"] })).rejects.toBeInstanceOf(EvidenceUseNotAuthorizedError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not search when no canonical course skill was supplied", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const provider = createRemoteOkJobEvidenceProvider({ fetchImpl, requestGate: () => null });
    await expect(provider.search({ terms: ["hash maps", "untrusted query"] })).resolves.toEqual({ status: "no_evidence" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("keeps the development pilot independent of the shared production budget", async () => {
    const reserveSharedRequest = vi.fn().mockResolvedValue("unavailable");
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response([]));
    const provider = createRemoteOkJobEvidenceProvider({
      nodeEnvironment: "development",
      reserveSharedRequest,
      fetchImpl,
      requestGate: () => null,
    });

    await expect(provider.search({ terms: ["Python"] })).resolves.toEqual({ status: "no_evidence" });
    expect(reserveSharedRequest).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("reserves production budget immediately before the upstream request", async () => {
    const order: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      order.push("fetch");
      return response([]);
    });
    const reserveSharedRequest = vi.fn(async () => {
      order.push("reserve");
      return "reserved" as const;
    });
    const provider = createRemoteOkJobEvidenceProvider({
      nodeEnvironment: "production",
      reserveSharedRequest,
      fetchImpl,
      requestGate: () => null,
    });

    await expect(provider.search({ terms: ["Python"] })).resolves.toEqual({ status: "no_evidence" });
    expect(order).toEqual(["reserve", "fetch"]);
  });

  it.each([
    ["exhausted", { status: "rate_limited", retryAfterSeconds: null }],
    ["unavailable", { status: "failed", retryable: true }],
  ] as const)("fails closed on a production shared-budget result of %s", async (reservation, expected) => {
    const fetchImpl = vi.fn<typeof fetch>();
    const provider = createRemoteOkJobEvidenceProvider({
      nodeEnvironment: "production",
      reserveSharedRequest: vi.fn().mockResolvedValue(reservation),
      fetchImpl,
      requestGate: () => null,
    });

    await expect(provider.search({ terms: ["Python"] })).resolves.toEqual(expected);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed if the production budget reservation throws", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const provider = createRemoteOkJobEvidenceProvider({
      nodeEnvironment: "production",
      reserveSharedRequest: vi.fn().mockRejectedValue(new Error("synthetic database failure")),
      fetchImpl,
      requestGate: () => null,
    });

    await expect(provider.search({ terms: ["Python"] })).resolves.toEqual({ status: "failed", retryable: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("combines request cancellation with the adapter timeout", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response([]));
    const provider = createRemoteOkJobEvidenceProvider({ fetchImpl, requestGate: () => null });
    await provider.search({ terms: ["Python"] }, controller.signal);

    const options = fetchImpl.mock.calls[0]?.[1];
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.signal).not.toBe(controller.signal);
    controller.abort();
    expect(options?.signal?.aborted).toBe(true);
  });

  it("rejects non-Remote-OK destinations and records without an exact source tag", () => {
    expect(normalizeRemoteOkReference({ ...row, url: "https://example.org/job" }, retrievedAt, "Python")).toBeNull();
    expect(normalizeRemoteOkReference({ ...row, tags: ["dev", "pythonic"] }, retrievedAt, "Python")).toBeNull();
    expect(normalizeRemoteOkReference({ ...row, position: "Account Executive" }, retrievedAt, "Python")).toBeNull();
    expect(normalizeRemoteOkReference({ ...row, description: "Python", tags: ["dev"] }, retrievedAt, "Python")).toBeNull();
  });

  it("does not surface listings older than the 30-day freshness window or without a listing date", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response([
      { ...row, id: 12345, date: "2026-09-07T10:00:00Z" },
      { ...row, id: 12346, date: undefined },
    ]));
    const provider = createRemoteOkJobEvidenceProvider({
      fetchImpl,
      now: () => new Date(retrievedAt),
      requestGate: () => null,
    });
    await expect(provider.search({ terms: ["Python"] })).resolves.toEqual({ status: "no_evidence" });
  });

  it("rejects an oversized Content-Length before reading the response body", async () => {
    let bodyCancelled = false;
    const body = new ReadableStream<Uint8Array>({
      cancel() {
        bodyCancelled = true;
      },
    });
    const oversized = new Response(body, {
      status: 200,
      headers: { "content-type": "application/json", "content-length": "2000001" },
    });
    const provider = createRemoteOkJobEvidenceProvider({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(oversized),
      requestGate: () => null,
    });

    await expect(provider.search({ terms: ["Python"] })).resolves.toEqual({ status: "failed", retryable: false });
    expect(bodyCancelled).toBe(true);
  });

  it("cancels a chunked response as soon as the streaming byte limit is exceeded", async () => {
    let bodyCancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(1_500_000));
        controller.enqueue(new Uint8Array(500_001));
      },
      cancel() {
        bodyCancelled = true;
      },
    });
    const provider = createRemoteOkJobEvidenceProvider({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status: 200 })),
      requestGate: () => null,
    });

    await expect(provider.search({ terms: ["Python"] })).resolves.toEqual({ status: "failed", retryable: false });
    expect(bodyCancelled).toBe(true);
  });

  it("fails safely when a response read is aborted or errors", async () => {
    const controller = new AbortController();
    const abortingFetch = vi.fn<typeof fetch>(async (_input, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(streamController) {
          init?.signal?.addEventListener("abort", () => {
            streamController.error(new DOMException("Aborted", "AbortError"));
          }, { once: true });
        },
      });
      return new Response(body, { status: 200 });
    });
    const provider = createRemoteOkJobEvidenceProvider({ fetchImpl: abortingFetch, requestGate: () => null });
    const result = provider.search({ terms: ["Python"] }, controller.signal);
    controller.abort();
    await expect(result).resolves.toEqual({ status: "failed", retryable: false });

    const failedRead = new ReadableStream<Uint8Array>({
      start(streamController) {
        streamController.error(new Error("synthetic read failure"));
      },
    });
    const failedReadProvider = createRemoteOkJobEvidenceProvider({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response(failedRead, { status: 200 })),
      requestGate: () => null,
    });
    await expect(failedReadProvider.search({ terms: ["Python"] })).resolves.toEqual({ status: "failed", retryable: false });
  });

  it("keeps empty, malformed, unavailable, and rate-limited source states distinct", async () => {
    const providerFor = (fetchImpl: typeof fetch) => createRemoteOkJobEvidenceProvider({ fetchImpl, requestGate: () => null });
    const empty = providerFor(vi.fn<typeof fetch>().mockResolvedValue(response([{ legal: "notice" }])));
    await expect(empty.search({ terms: ["Python"] })).resolves.toEqual({ status: "no_evidence" });

    const malformed = providerFor(vi.fn<typeof fetch>().mockResolvedValue(new Response("not-json", { status: 200 })));
    await expect(malformed.search({ terms: ["Python"] })).resolves.toEqual({ status: "failed", retryable: false });

    const unavailable = providerFor(vi.fn<typeof fetch>().mockResolvedValue(response({}, 503)));
    await expect(unavailable.search({ terms: ["Python"] })).resolves.toEqual({ status: "failed", retryable: true });

    const limited = providerFor(vi.fn<typeof fetch>().mockResolvedValue(response({}, 429, { "retry-after": "90" })));
    await expect(limited.search({ terms: ["Python"] })).resolves.toEqual({ status: "rate_limited", retryAfterSeconds: 90 });
  });

  it("uses the conservative process-local request gate", () => {
    const gate = createRemoteOkRequestGate();
    expect(gate(new Date("2026-10-08T00:00:00.000Z"))).toBeNull();
    expect(gate(new Date("2026-10-08T00:00:30.000Z"))).toBe(30);
    expect(gate(new Date("2026-10-08T00:01:00.000Z"))).toBeNull();
    expect(gate(new Date("2026-10-08T00:04:00.000Z"))).toBeNull();
    expect(gate(new Date("2026-10-08T00:05:00.000Z"))).toBeNull();
    expect(gate(new Date("2026-10-08T00:06:00.000Z"))).not.toBeNull();
    expect(gate(new Date("2026-10-09T00:00:00.000Z"))).toBeNull();
  });

  it.skipIf(process.env.RUN_REMOTEOK_LIVE_TESTS !== "1")(
    "performs one bounded live metadata-only evaluation when explicitly enabled",
    async () => {
      const provider = createRemoteOkJobEvidenceProvider();
      const result = await provider.search({ terms: ["Python"] });
      expect(["references_only", "no_evidence", "failed", "rate_limited"]).toContain(result.status);
      if (result.status === "references_only") {
        expect(result.items.length).toBeLessThanOrEqual(3);
        expect(result.items.every((item) => item.kind === "metadata_only")).toBe(true);
        console.info("Remote OK live pilot metadata:", JSON.stringify(result.items.map((item) => ({
          title: item.title,
          company: item.company,
          location: item.location,
          tags: item.tags,
          publishedAt: item.publishedAt,
          sourceUrl: item.sourceUrl,
        }))));
      } else {
        console.info("Remote OK live pilot status:", result.status);
      }
    },
    10_000,
  );
});
