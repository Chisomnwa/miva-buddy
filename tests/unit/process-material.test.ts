import { afterEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import type { GenerationProvider } from "@/server/ai/provider";
import type { EmbeddingProvider } from "@/server/embeddings/provider";
import { markTerminalFailure, processCourseMaterial } from "@/server/ingestion/process-material";
import { PdfMaterialError } from "@/server/ingestion/pdf-extraction";
import type { ProcessMaterialJob } from "@/contracts/course-material";
import { handleMaterialJob } from "@/server/queue/handle-material-job";

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
  const client = {
    query: async (query: string) => {
      transactionQueries.push(query);
      return { rows: [], rowCount: 1 };
    },
    release: () => {},
  };
  const pool = {
    query: async (query: string) => {
      workerQueries.push(query);
      if (query.includes("select kind, status")) return { rows: [{ kind: "notes", status: "queued" }], rowCount: 1 };
      if (query.includes("select page_number, content")) {
        if (options.failPageRead) throw new Error("temporary database issue");
        return { rows: [{ page_number: 1, content: sourceText }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
    connect: async () => client,
    workerQueries,
    transactionQueries,
  };
  return pool as unknown as Pool & { workerQueries: string[]; transactionQueries: string[] };
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

  it("atomically replaces page, chunk, concept, and source rows while preserving ownership scope", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("EMBEDDING_PROVIDER", "fake");
    const pool = fakePool();
    const embeddings: EmbeddingProvider = { embed: async ({ texts }) => texts.map(() => Array(768).fill(0.25)) };
    const dependencies = { pool, embeddings, generation: fakeGeneration(), signal: new AbortController().signal };

    await processCourseMaterial(job, dependencies);
    await processCourseMaterial(job, dependencies);

    expect(pool.transactionQueries.filter((query) => query === "begin")).toHaveLength(2);
    expect(pool.transactionQueries.filter((query) => query.includes("delete from public.material_chunks"))).toHaveLength(2);
    expect(pool.transactionQueries.some((query) => query.includes("insert into public.course_concept_sources"))).toBe(true);
    expect(pool.transactionQueries.at(-1)).toBe("commit");
    expect(pool.transactionQueries.every((query) => !query.startsWith("delete from storage."))).toBe(true);
    expect(pool.workerQueries.every((query) => !query.includes("where id = $1\n"))).toBe(true);
  });

  it("propagates transient read failures so pg-boss can retry rather than marking terminal failure", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("EMBEDDING_PROVIDER", "fake");
    const pool = fakePool({ failPageRead: true });
    const embeddings: EmbeddingProvider = { embed: async ({ texts }) => texts.map(() => Array(768).fill(0.25)) };
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
    vi.spyOn(console, "error").mockImplementation(() => {});
    const pool = fakePool({ failPageRead: true });
    const embeddings: EmbeddingProvider = { embed: async ({ texts }) => texts.map(() => Array(768).fill(0.25)) };
    const dependencies = { pool, embeddings, generation: fakeGeneration() };
    const signal = new AbortController().signal;

    await expect(handleMaterialJob({ data: job, retryCount: 0, signal }, dependencies))
      .rejects.toThrow("temporary database issue");
    await expect(handleMaterialJob({ data: job, retryCount: 3, signal }, dependencies))
      .resolves.toBeUndefined();
    expect(pool.workerQueries.at(-1)).toContain("failure_code = 'processing_failed'");
    expect(pool.workerQueries.at(-1)).toContain("where id = $1 and user_id = $2 and course_id = $3");
  });
});
