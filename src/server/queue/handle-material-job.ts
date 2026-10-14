import type { Job } from "pg-boss";
import { processMaterialJobSchema } from "@/contracts/course-material";
import type { EmbeddingProvider } from "@/server/embeddings/provider";
import type { GenerationProvider } from "@/server/ai/provider";
import { ProviderUnavailableError } from "@/server/ai/provider";
import { EmbeddingProviderUnavailableError } from "@/server/embeddings/provider";
import { GeminiProviderError } from "@/server/ai/gemini-provider-errors";
import { GeminiUsageProtectionError } from "@/server/ai/gemini-usage-errors";
import { getDatabasePool } from "@/server/persistence/pool";
import { markTerminalFailure, processCourseMaterial, TemporaryMaterialProcessingError } from "@/server/ingestion/process-material";
import { MATERIAL_JOB_RETRY_LIMIT } from "./material-jobs";

export type MaterialRetryCategory = "provider_timeout" | "provider_temporary" | "provider_rate_limit" | "storage_temporary" | "database_temporary";

const transientDatabaseCodes = new Set([
  "40001", "40P01", "53300", "57P01", "08000", "08003", "08006", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN",
]);

export function classifyMaterialRetry(error: unknown): MaterialRetryCategory | null {
  if (error instanceof GeminiProviderError) {
    if (error.category === "timeout") return "provider_timeout";
    if (error.category === "temporary_failure") return "provider_temporary";
    if (error.category === "rate_limit") return "provider_rate_limit";
    return null;
  }
  if (error instanceof ProviderUnavailableError || error instanceof EmbeddingProviderUnavailableError) {
    if (error.statusCode === 408) return "provider_timeout";
    if (error.statusCode === 429) return "provider_rate_limit";
    if (error.statusCode === undefined || error.statusCode >= 500) return "provider_temporary";
    return null;
  }
  if (error instanceof GeminiUsageProtectionError) return error.reason === "unavailable" ? "database_temporary" : null;
  if (error instanceof TemporaryMaterialProcessingError) return "storage_temporary";
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    && transientDatabaseCodes.has(error.code)) return "database_temporary";
  return null;
}

export function shouldRetryMaterialFailure(error: unknown, retryCount: number): boolean {
  const category = classifyMaterialRetry(error);
  return Boolean(category)
    && retryCount < MATERIAL_JOB_RETRY_LIMIT
    && !(category === "provider_rate_limit" && retryCount >= 1);
}

export async function handleMaterialJob(
  job: Pick<Job<unknown>, "data" | "retryCount" | "signal">,
  dependencies: { pool?: ReturnType<typeof getDatabasePool>; embeddings: EmbeddingProvider; generation: GenerationProvider },
) {
  const parsed = processMaterialJobSchema.safeParse(job.data);
  if (!parsed.success) return;
  const pool = dependencies.pool ?? getDatabasePool();
  try {
    await processCourseMaterial(parsed.data, {
      pool,
      embeddings: dependencies.embeddings,
      generation: dependencies.generation,
      signal: job.signal,
    });
  } catch (error) {
    if (job.signal.aborted) throw error;
    if (await markTerminalFailure(pool, parsed.data, error)) return;
    const failureCategory = classifyMaterialRetry(error);
    if (!shouldRetryMaterialFailure(error, job.retryCount)) {
      await pool.query(
        `update public.course_materials set status = 'failed', failure_code = 'processing_failed', updated_at = now()
         where id = $1 and user_id = $2 and course_id = $3`,
        [parsed.data.materialId, parsed.data.userId, parsed.data.courseId],
      );
      console.error("Material processing stopped", { failureCategory: failureCategory ?? "permanent_failure", attempts: job.retryCount + 1 });
      return;
    }
    console.error("Material processing attempt failed", { failureCategory, attempt: job.retryCount + 1 });
    throw error;
  }
}
