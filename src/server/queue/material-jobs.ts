import { PgBoss } from "pg-boss";
import { getServerConfig } from "@/lib/config";
import type { ProcessMaterialJob } from "@/contracts/course-material";

export const MATERIAL_PROCESSING_QUEUE = "course-material-processing";
export const MATERIAL_JOB_RETRY_LIMIT = 3;

type BossGlobal = typeof globalThis & { mivaBuddyBoss?: Promise<PgBoss> };
const globalBoss = globalThis as BossGlobal;

export async function getMaterialJobQueue(): Promise<PgBoss> {
  if (!globalBoss.mivaBuddyBoss) {
    const databaseUrl = getServerConfig().DATABASE_URL;
    if (!databaseUrl) throw new Error("Database queue is not configured");
    globalBoss.mivaBuddyBoss = (async () => {
      const boss = new PgBoss({ connectionString: databaseUrl, application_name: "miva-buddy-web" });
      boss.on("error", (error) => {
        const code = typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "unknown";
        console.error("Material queue adapter error", { code });
      });
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
      return boss;
    })().catch((error) => {
      globalBoss.mivaBuddyBoss = undefined;
      throw error;
    });
  }
  return globalBoss.mivaBuddyBoss;
}

export async function enqueueMaterialProcessing(job: ProcessMaterialJob): Promise<string> {
  const boss = await getMaterialJobQueue();
  const id = await boss.send(MATERIAL_PROCESSING_QUEUE, job, {
    retryLimit: MATERIAL_JOB_RETRY_LIMIT,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 900,
    singletonKey: job.materialId,
    singletonSeconds: 86_400,
  });
  if (!id) throw new Error("Material processing job could not be queued");
  return id;
}
