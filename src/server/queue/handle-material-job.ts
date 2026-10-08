import type { Job } from "pg-boss";
import { processMaterialJobSchema } from "@/contracts/course-material";
import type { EmbeddingProvider } from "@/server/embeddings/provider";
import type { GenerationProvider } from "@/server/ai/provider";
import { getDatabasePool } from "@/server/persistence/pool";
import { markTerminalFailure, processCourseMaterial } from "@/server/ingestion/process-material";
import { MATERIAL_JOB_RETRY_LIMIT } from "./material-jobs";

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
    if (await markTerminalFailure(pool, parsed.data, error)) return;
    if (job.retryCount >= MATERIAL_JOB_RETRY_LIMIT) {
      await pool.query(
        `update public.course_materials set status = 'failed', failure_code = 'processing_failed', updated_at = now()
         where id = $1 and user_id = $2 and course_id = $3`,
        [parsed.data.materialId, parsed.data.userId, parsed.data.courseId],
      );
      console.error("Material processing exhausted retries", { materialId: parsed.data.materialId });
      return;
    }
    const code = typeof error === "object" && error !== null && "statusCode" in error
      ? `provider_${String(error.statusCode)}` : error instanceof Error ? error.name : "unknown";
    console.error("Material processing attempt failed", { code, attempt: job.retryCount + 1 });
    throw error;
  }
}
