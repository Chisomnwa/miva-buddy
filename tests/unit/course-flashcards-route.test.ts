import { beforeEach, describe, expect, it, vi } from "vitest";
import { courseFlashcardSourceVersion } from "@/lib/course-flashcard-source-version";
import { ProviderUnavailableError } from "@/server/ai/provider";

const { AuthVerificationError, getPermanentUser, sameOrigin, providerGenerate, recordSafeOperation, queryLog, activeUser } = vi.hoisted(() => ({
  AuthVerificationError: class AuthVerificationError extends Error {},
  getPermanentUser: vi.fn(),
  sameOrigin: vi.fn(() => true),
  providerGenerate: vi.fn(),
  recordSafeOperation: vi.fn(),
  queryLog: [] as { table: string; filters: [string, unknown][]; inFilters: [string, unknown[]][] }[],
  activeUser: { id: "" as string },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/permanent-user", () => ({ AuthVerificationError, getPermanentUser }));
vi.mock("@/lib/same-origin", () => ({ isSameOriginRequest: sameOrigin }));
vi.mock("@/server/ai/create-provider", () => ({ createGenerationProvider: () => ({ generate: providerGenerate }) }));
vi.mock("@/lib/config", () => ({ getServerConfig: () => ({ AI_PROVIDER: "gemini" }) }));
vi.mock("@/server/observability/safe-telemetry", () => ({ recordSafeOperation }));

import { POST } from "@/app/api/learn/flashcards/route";

const ids = {
  course: "10000000-0000-4000-8000-000000000001",
  material: "20000000-0000-4000-8000-000000000002",
  concept: "30000000-0000-4000-8000-000000000003",
  chunk: "40000000-0000-4000-8000-000000000004",
};
const materialUpdatedAt = "2026-10-13T10:00:00.000Z";
const excerpt = "A binary search tree stores smaller keys in the left subtree and larger keys in the right subtree.";

function configureSupabase({ course = true, materialStatus = "ready", sources = true } = {}) {
  queryLog.splice(0);
  const responses = new Map<string, unknown>([
    ["courses", { data: course ? { id: ids.course } : null, error: null }],
    ["course_materials", { data: { id: ids.material, title: "Lecture notes", status: materialStatus, updated_at: materialUpdatedAt }, error: null }],
    ["course_concepts", { data: { id: ids.concept, title: "Binary search tree", description: "Ordered tree values.", extraction_version: "v1" }, error: null }],
    ["course_concept_sources", { data: sources ? [{ chunk_id: ids.chunk }] : [], error: null }],
    ["material_chunks", { data: [{ id: ids.chunk, ordinal: 1, page_start: 4, page_end: 5, content: excerpt }], error: null }],
  ]);
  const supabase = {
    from(table: string) {
      const entry = { table, filters: [] as [string, unknown][], inFilters: [] as [string, unknown[]][] };
      queryLog.push(entry);
      const response = responses.get(table) ?? { data: [], error: null };
      const query: Record<string, (...args: never[]) => unknown> = {};
      for (const method of ["select", "order"]) query[method] = (() => query) as (...args: never[]) => unknown;
      query.eq = ((column: string, value: unknown) => { entry.filters.push([column, value]); return query; }) as (...args: never[]) => unknown;
      query.in = ((column: string, values: unknown[]) => { entry.inFilters.push([column, values]); return query; }) as (...args: never[]) => unknown;
      query.maybeSingle = (() => Promise.resolve(response)) as (...args: never[]) => unknown;
      query.then = ((resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve)) as (...args: never[]) => unknown;
      return query;
    },
  };
  getPermanentUser.mockResolvedValue({ user: activeUser, supabase });
}

function request(sourceVersion: string, bodyOverrides: Record<string, unknown> = {}) {
  return new Request("http://localhost:3000/api/learn/flashcards", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000", host: "localhost:3000" },
    body: JSON.stringify({ courseId: ids.course, materialId: ids.material, conceptId: ids.concept, sourceVersion, ...bodyOverrides }),
  });
}

const validSourceVersion = courseFlashcardSourceVersion({
  materialUpdatedAt,
  extractionVersion: "v1",
  sourceChunkIds: [ids.chunk],
});

describe("course flashcard generation route", () => {
  beforeEach(() => {
    activeUser.id = crypto.randomUUID();
    sameOrigin.mockReturnValue(true);
    providerGenerate.mockReset().mockResolvedValue(JSON.stringify({ cards: [{
      question: "Where are smaller keys stored?",
      answer: "Smaller keys are stored in the left subtree. [40000000-0000-4000-8000-000000000004]",
      highlightTerms: ["left subtree"],
      citationIds: [ids.chunk],
    }] }));
    recordSafeOperation.mockReset();
    configureSupabase();
  });

  it("uses permanent-user-owned concept sources and returns only citation-free display text", async () => {
    const response = await POST(request(validSourceVersion));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cards: [{
      question: "Where are smaller keys stored?",
      answer: "Smaller keys are stored in the left subtree.",
      highlightTerms: ["left subtree"],
    }] });
    for (const table of ["courses", "course_materials", "course_concepts", "course_concept_sources", "material_chunks"]) {
      const query = queryLog.find((item) => item.table === table);
      expect(query?.filters).toContainEqual(["user_id", activeUser.id]);
    }
    expect(providerGenerate).toHaveBeenCalledTimes(1);
  });

  it("rejects anonymous users and foreign-owned courses before provider use", async () => {
    getPermanentUser.mockResolvedValueOnce({ user: null, supabase: {} });
    expect((await POST(request(validSourceVersion))).status).toBe(401);

    configureSupabase({ course: false });
    expect((await POST(request(validSourceVersion))).status).toBe(404);
    expect(providerGenerate).not.toHaveBeenCalled();
  });

  it("does not generate from non-ready materials, stale source revisions, or empty source links", async () => {
    configureSupabase({ materialStatus: "processing" });
    expect((await POST(request(validSourceVersion))).status).toBe(404);

    configureSupabase();
    expect((await POST(request("stale-version"))).status).toBe(409);

    configureSupabase({ sources: false });
    const sourceVersion = courseFlashcardSourceVersion({ materialUpdatedAt, extractionVersion: "v1", sourceChunkIds: [] });
    const empty = await POST(request(sourceVersion));
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ cards: [], emptyReason: "insufficient_sources" });
    expect(providerGenerate).not.toHaveBeenCalled();
  });

  it("returns a safe provider quota category without exposing provider details", async () => {
    providerGenerate.mockRejectedValueOnce(new ProviderUnavailableError(429));
    const response = await POST(request(validSourceVersion));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "provider_quota" });
  });

  it("returns a distinct timeout response and records only its safe category", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(
      AbortSignal.abort(new DOMException("deadline elapsed", "TimeoutError")),
    );
    try {
      providerGenerate.mockImplementationOnce((input: { signal: AbortSignal }) => Promise.reject(input.signal.reason));
      const response = await POST(request(validSourceVersion));
      expect(response.status).toBe(504);
      expect(await response.json()).toEqual({ error: "generation_timeout" });
      expect(recordSafeOperation).toHaveBeenCalledWith(expect.objectContaining({
        operation: "course_flashcards",
        provider: "gemini",
        outcome: "failure",
        failureCategory: "timeout",
        durationMs: expect.any(Number),
      }));
      expect(JSON.stringify(recordSafeOperation.mock.calls)).not.toMatch(/deadline elapsed|lecture|api.?key/i);
    } finally {
      timeoutSpy.mockRestore();
    }
  });

  it("sanitizes unexpected server failures instead of returning exception details", async () => {
    getPermanentUser.mockRejectedValueOnce(new Error("private provider response and stack detail"));
    const response = await POST(request(validSourceVersion));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "unexpected_error" });
  });

  it("returns a temporary authentication response when identity verification is unavailable", async () => {
    getPermanentUser.mockRejectedValueOnce(new AuthVerificationError("private provider detail"));
    const response = await POST(request(validSourceVersion));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "auth_verification_unavailable" });
  });

  it("keeps the existing per-user generation limit and identifies it separately", async () => {
    const responses = await Promise.all(Array.from({ length: 6 }, () => POST(request(validSourceVersion))));
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200, 200, 429]);
    expect(await responses[5].json()).toEqual({ error: "rate_limited" });
    expect(providerGenerate).toHaveBeenCalledTimes(5);
    expect(recordSafeOperation).toHaveBeenCalledWith(expect.objectContaining({ failureCategory: "rate_limited" }));
  });
});
