import { afterEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import type { GenerationProvider } from "@/server/ai/provider";
import type { EmbeddingProvider } from "@/server/embeddings/provider";
import { isTrustedCourseMaterialSignedUrl, markTerminalFailure, processCourseMaterial } from "@/server/ingestion/process-material";
import { PdfMaterialError } from "@/server/ingestion/pdf-extraction";
import type { ProcessMaterialJob } from "@/contracts/course-material";
import { handleMaterialJob } from "@/server/queue/handle-material-job";
import { classifyMaterialRetry, shouldRetryMaterialFailure } from "@/server/queue/handle-material-job";
import { GeminiProviderError } from "@/server/ai/gemini-provider-errors";
import { GeminiUsageProtectionError } from "@/server/ai/gemini-usage-errors";
import { ProviderUnavailableError } from "@/server/ai/provider";

const job: ProcessMaterialJob = {
  kind: "notes",
  userId: "a4fd652e-bc84-433c-8a71-55358f7cf68b",
  courseId: "abfa3410-7b2c-4f96-8d80-4d93b7b5dd4e",
  materialId: "21a6db15-81c0-4a87-96b4-f1f9c006df31",
};
const sourceText = "A binary search tree stores smaller keys on the left and larger keys on the right. Search compares each key and follows one branch to find a target efficiently.";

function fakePool(options: { failPageRead?: boolean } = {}) {
  const workerQueries: string[] = [];
  const transactionQueries: string[] = [];
  const transactionParameters: unknown[][] = [];
  const client = {
    query: async (query: string, parameters: unknown[] = []) => {
      transactionQueries.push(query);
      transactionParameters.push(parameters);
      return { rows: [], rowCount: 1 };
    },
    release: () => {},
  };
  const pool = {
    query: async (query: string) => {
      workerQueries.push(query);
      if (query.includes("select kind, status")) return { rows: [{ kind: "notes", status: "queued" }], rowCount: 1 };
      if (query.includes("select page_number, content")) {
        if (options.failPageRead) throw Object.assign(new Error("temporary database issue"), { code: "ECONNRESET" });
        return { rows: [{ page_number: 1, content: sourceText }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
    connect: async () => client,
    workerQueries,
    transactionQueries,
    transactionParameters,
  };
  return pool as unknown as Pool & { workerQueries: string[]; transactionQueries: string[]; transactionParameters: unknown[][] };
}

function fakeGeneration(): GenerationProvider {
  return {
    async generate({ messages }) {
      const evidence = JSON.parse(messages[1].content) as { excerpts: Array<{ id: string }> };
      return JSON.stringify({ concepts: [{
        title: "Binary search tree",
        description: "Smaller keys are on the left and larger keys are on the right.",
        supportingChunkIds: [evidence.excerpts[0].id],
      }] });
    },
  };
}

describe("course material worker pipeline", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("allows an HTTP signed URL only for the configured local loopback Supabase origin", () => {
    const pdfJob = { ...job, kind: "pdf" as const, signedUrl: "" };
    const localOrigin = "http://127.0.0.1:54321";
    const signedUrl = `${localOrigin}/storage/v1/object/sign/course-materials/${job.userId}/${job.courseId}/${job.materialId}/lecture.pdf?token=synthetic`;

    expect(isTrustedCourseMaterialSignedUrl(signedUrl, localOrigin, pdfJob)).toBe(true);
    expect(isTrustedCourseMaterialSignedUrl(
      signedUrl.replace("127.0.0.1", "storage.example.test"),
      "http://storage.example.test:54321",
      pdfJob,
    )).toBe(false);
  });

  it("keeps HTTPS and owner-scoped path checks for hosted Storage URLs", () => {
    const pdfJob = { ...job, kind: "pdf" as const, signedUrl: "" };
    const origin = "https://test-project.supabase.co";
    const path = `/storage/v1/object/sign/course-materials/${job.userId}/${job.courseId}/${job.materialId}/lecture.pdf?token=synthetic`;

    expect(isTrustedCourseMaterialSignedUrl(`${origin}${path}`, origin, pdfJob)).toBe(true);
    expect(isTrustedCourseMaterialSignedUrl(`${origin}${path}`.replace(job.userId, "another-user"), origin, pdfJob)).toBe(false);
    expect(isTrustedCourseMaterialSignedUrl(`${origin}${path}`.replace("https:", "http:"), origin, pdfJob)).toBe(false);
  });

  it("atomically replaces page, chunk, concept, and source rows while preserving ownership scope", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("EMBEDDING_PROVIDER", "fake");
    const pool = fakePool();
    const embed = vi.fn(async ({ texts }: { texts: string[] }) => texts.map(() => Array(768).fill(0.25)));
    const embeddings: EmbeddingProvider = { modelId: "fake-v1", embed };
    const dependencies = { pool, embeddings, generation: fakeGeneration(), signal: new AbortController().signal };

    await processCourseMaterial(job, dependencies);
    await processCourseMaterial(job, dependencies);

    expect(pool.transactionQueries.filter((query) => query === "begin")).toHaveLength(2);
    expect(embed).toHaveBeenCalledWith(expect.objectContaining({ task: "document" }));
    expect(pool.transactionQueries.filter((query) => query.includes("delete from public.material_chunks"))).toHaveLength(2);
    expect(pool.transactionQueries.some((query) => query.includes("insert into public.course_concept_sources"))).toBe(true);
    expect(pool.transactionParameters.some((parameters) => parameters[9] === "fake-v1")).toBe(true);
    expect(pool.transactionQueries.at(-1)).toBe("commit");
    expect(pool.transactionQueries.every((query) => !query.startsWith("delete from storage."))).toBe(true);
    expect(pool.workerQueries.every((query) => !query.includes("where id = $1\n"))).toBe(true);
  });

  it("leaves transient read failures for the worker retry classifier", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("EMBEDDING_PROVIDER", "fake");
    const pool = fakePool({ failPageRead: true });
    const embeddings: EmbeddingProvider = { modelId: "fake-v1", embed: async ({ texts }) => texts.map(() => Array(768).fill(0.25)) };
    const dependencies = { pool, embeddings, generation: fakeGeneration(), signal: new AbortController().signal };

    await expect(processCourseMaterial(job, dependencies)).rejects.toThrow("temporary database issue");
    expect(pool.transactionQueries).toHaveLength(0);
    expect(await markTerminalFailure(pool, job, new Error("temporary database issue"))).toBe(false);
  });

  it("turns known unreadable-file errors into owner-scoped terminal failures", async () => {
    const pool = fakePool();
    const terminal = await markTerminalFailure(pool, job, new PdfMaterialError("unreadable_pdf"));
    expect(terminal).toBe(true);
    expect(pool.workerQueries[0]).toContain("where id = $1 and user_id = $2 and course_id = $3");
  });

  it("rethrows transient failures for pg-boss retries and records failure after the retry limit", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("EMBEDDING_PROVIDER", "fake");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const pool = fakePool({ failPageRead: true });
    const embeddings: EmbeddingProvider = { modelId: "fake-v1", embed: async ({ texts }) => texts.map(() => Array(768).fill(0.25)) };
    const dependencies = { pool, embeddings, generation: fakeGeneration() };
    const signal = new AbortController().signal;

    await expect(handleMaterialJob({ data: job, retryCount: 0, signal }, dependencies))
      .rejects.toThrow("temporary database issue");
    await expect(handleMaterialJob({ data: job, retryCount: 3, signal }, dependencies))
      .resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("Material processing attempt failed", expect.objectContaining({ failureCategory: "database_temporary" }));
    expect(JSON.stringify(log.mock.calls)).not.toContain(job.materialId);
    expect(JSON.stringify(log.mock.calls)).not.toContain("temporary database issue");
    expect(pool.workerQueries.at(-1)).toContain("failure_code = 'processing_failed'");
    expect(pool.workerQueries.at(-1)).toContain("where id = $1 and user_id = $2 and course_id = $3");
  });

  it("retries only allow-listed transient failures and limits provider rate-limit retries", () => {
    expect(classifyMaterialRetry(new GeminiProviderError("timeout"))).toBe("provider_timeout");
    expect(classifyMaterialRetry(new GeminiProviderError("temporary_failure"))).toBe("provider_temporary");
    expect(classifyMaterialRetry(new GeminiProviderError("rate_limit"))).toBe("provider_rate_limit");
    expect(classifyMaterialRetry(new GeminiProviderError("configuration"))).toBeNull();
    expect(classifyMaterialRetry(new GeminiProviderError("request"))).toBeNull();
    expect(classifyMaterialRetry(new GeminiUsageProtectionError("app_daily_limit"))).toBeNull();
    expect(classifyMaterialRetry(new GeminiUsageProtectionError("unavailable"))).toBe("database_temporary");
    expect(classifyMaterialRetry(new ProviderUnavailableError(400))).toBeNull();
    expect(classifyMaterialRetry(new ProviderUnavailableError(503))).toBe("provider_temporary");
    expect(classifyMaterialRetry(new Error("unclassified permanent failure"))).toBeNull();
    expect(classifyMaterialRetry(new TypeError("unclassified programming failure"))).toBeNull();
    expect(shouldRetryMaterialFailure(new GeminiProviderError("rate_limit"), 0)).toBe(true);
    expect(shouldRetryMaterialFailure(new GeminiProviderError("rate_limit"), 1)).toBe(false);
    expect(shouldRetryMaterialFailure(new GeminiProviderError("temporary_failure"), 2)).toBe(true);
    expect(shouldRetryMaterialFailure(new GeminiProviderError("temporary_failure"), 3)).toBe(false);
    expect(shouldRetryMaterialFailure(new GeminiProviderError("configuration"), 0)).toBe(false);
  });
});
