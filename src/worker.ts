import { PgBoss } from "pg-boss";
import { createRequire } from "node:module";
import { getServerConfig } from "@/lib/config";
import { GeminiGenerationProvider } from "@/server/ai/providers/gemini";
import { GroqGenerationProvider } from "@/server/ai/providers/groq";
import { OllamaGenerationProvider } from "@/server/ai/providers/ollama";
import { FakeGenerationProvider } from "@/server/ai/providers/fake";
import { OllamaEmbeddingProvider } from "@/server/embeddings/providers/ollama";
import { FakeEmbeddingProvider } from "@/server/embeddings/providers/fake";
import { getDatabasePool } from "@/server/persistence/pool";
import { MATERIAL_JOB_RETRY_LIMIT, MATERIAL_PROCESSING_QUEUE } from "@/server/queue/material-jobs";
import { handleMaterialJob } from "@/server/queue/handle-material-job";

createRequire(import.meta.url)("@next/env").loadEnvConfig(process.cwd());
const config = getServerConfig();
if (!config.DATABASE_URL) throw new Error("Database worker is not configured");
if (process.env.NODE_ENV === "production" && (config.AI_PROVIDER === "fake" || config.EMBEDDING_PROVIDER === "fake")) {
  throw new Error("Production worker requires configured AI and embedding providers");
}
if (config.AI_PROVIDER === "gemini" && !config.GEMINI_API_KEY) throw new Error("Hosted generation provider is not configured");
if (config.AI_PROVIDER === "groq" && !config.GROQ_API_KEY) throw new Error("Hosted generation provider is not configured");

const generation = config.AI_PROVIDER === "gemini"
  ? new GeminiGenerationProvider(config.GEMINI_API_KEY ?? "", config.GEMINI_MODEL)
  : config.AI_PROVIDER === "groq"
    ? new GroqGenerationProvider(config.GROQ_API_KEY ?? "", config.GROQ_MODEL)
    : config.AI_PROVIDER === "ollama"
      ? new OllamaGenerationProvider(config.OLLAMA_BASE_URL, config.OLLAMA_MODEL)
      : new FakeGenerationProvider();
const embeddings = config.EMBEDDING_PROVIDER === "ollama"
  ? new OllamaEmbeddingProvider(config.OLLAMA_BASE_URL, config.OLLAMA_EMBEDDING_MODEL)
  : new FakeEmbeddingProvider();
const pool = getDatabasePool();
const boss = new PgBoss({ connectionString: config.DATABASE_URL, application_name: "miva-buddy-worker" });
boss.on("error", (error) => {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
  console.error("Material queue adapter error", { code });
});

async function start() {
  await boss.start();
  await boss.createQueue(MATERIAL_PROCESSING_QUEUE, {
    retryLimit: MATERIAL_JOB_RETRY_LIMIT,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 900,
    retentionSeconds: 86_400,
    deleteAfterSeconds: 604_800,
    notify: true,
  });
  await boss.work(MATERIAL_PROCESSING_QUEUE, { localConcurrency: 1 }, async (jobs) => {
    for (const job of jobs) await handleMaterialJob(job, { pool, embeddings, generation });
  });
  console.info("Course material worker started");
}

let stopping = false;
async function stop(signal: string) {
  if (stopping) return;
  stopping = true;
  console.info("Course material worker stopping", { signal });
  await boss.stop({ graceful: true, timeout: 30_000 });
  await pool.end();
}

process.once("SIGINT", () => void stop("SIGINT"));
process.once("SIGTERM", () => void stop("SIGTERM"));
void start().catch(async (error: unknown) => {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "startup_failed";
  console.error("Course material worker could not start", { code });
  await stop("startup_error");
  process.exitCode = 1;
});
