import "server-only";
import type { Pool, PoolClient } from "pg";

export type FailedMaterialRemovalResult = "removed" | "not_found" | "storage_failed" | "failed" | "partial_failure";

type RemovalPool = Pick<Pool, "connect">;
type StorageRemover = (path: string) => Promise<boolean>;

/**
 * Lock and re-check the owner's failed material before removing its private object.
 * If storage removal fails, the transaction rolls back and preserves the material row.
 */
export async function removeFailedMaterial(
  pool: RemovalPool,
  input: { materialId: string; courseId: string; userId: string },
  removeStorageObject: StorageRemover,
): Promise<FailedMaterialRemovalResult> {
  let client: PoolClient | undefined;
  let storageRemoved = false;
  let transactionStarted = false;
  try {
    client = await pool.connect();
    await client.query("begin");
    transactionStarted = true;
    const selected = await client.query<{ kind: string; storage_path: string | null }>(
      `select kind, storage_path from public.course_materials
       where id = $1 and course_id = $2 and user_id = $3 and status = 'failed'
       for update`,
      [input.materialId, input.courseId, input.userId],
    );
    const material = selected.rows[0];
    if (!material) {
      await client.query("rollback");
      transactionStarted = false;
      return "not_found";
    }
    if (material.kind === "pdf") {
      if (!material.storage_path) {
        await client.query("rollback");
        transactionStarted = false;
        return "failed";
      }
      if (!await removeStorageObject(material.storage_path)) {
        await client.query("rollback");
        transactionStarted = false;
        return "storage_failed";
      }
      storageRemoved = true;
    }

    const deleted = await client.query(
      `delete from public.course_materials
       where id = $1 and course_id = $2 and user_id = $3 and status = 'failed'
       returning id`,
      [input.materialId, input.courseId, input.userId],
    );
    if (deleted.rowCount !== 1) {
      await client.query("rollback");
      transactionStarted = false;
      return storageRemoved ? "partial_failure" : "not_found";
    }
    await client.query("commit");
    transactionStarted = false;
    return "removed";
  } catch {
    if (transactionStarted && client) await client.query("rollback").catch(() => {});
    return storageRemoved ? "partial_failure" : "failed";
  } finally {
    client?.release();
  }
}
