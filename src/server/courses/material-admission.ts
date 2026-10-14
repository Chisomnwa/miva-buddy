import "server-only";
import type { Pool } from "pg";
import { getServerConfig } from "@/lib/config";
import { getDatabasePool } from "@/server/persistence/pool";

export type MaterialAdmissionStatus = "reserved" | "daily_count_limit" | "daily_bytes_limit" | "unavailable";

export async function reserveCourseMaterialAdmission(input: {
  userId: string;
  uploadBytes: number;
  pool?: Pool;
}): Promise<{ status: MaterialAdmissionStatus; reservationId?: string }> {
  try {
    if (!input.userId || !Number.isSafeInteger(input.uploadBytes) || input.uploadBytes < 0) {
      return { status: "unavailable" };
    }
    const config = getServerConfig();
    const result = await (input.pool ?? getDatabasePool()).query<{
      decision: MaterialAdmissionStatus;
      reservation_id: string | null;
    }>(
      `select decision, reservation_id from public.reserve_course_material_admission($1::uuid, $2::bigint, $3::integer, $4::bigint, 1800)`,
      [input.userId, input.uploadBytes, config.COURSE_MATERIAL_DAILY_COUNT_LIMIT, config.COURSE_MATERIAL_DAILY_BYTES_LIMIT],
    );
    const row = result.rows[0];
    if (row?.decision === "reserved" && row.reservation_id) {
      return { status: "reserved", reservationId: row.reservation_id };
    }
    if (row?.decision === "daily_count_limit" || row?.decision === "daily_bytes_limit") {
      return { status: row.decision };
    }
    return { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function finalizeCourseMaterialAdmission(input: {
  reservationId: string;
  userId: string;
  pool?: Pool;
}): Promise<boolean> {
  try {
    const result = await (input.pool ?? getDatabasePool()).query<{ finalized: boolean }>(
      "select public.finalize_course_material_admission($1::uuid, $2::uuid) as finalized",
      [input.reservationId, input.userId],
    );
    return result.rows[0]?.finalized === true;
  } catch {
    return false;
  }
}

export async function releaseCourseMaterialAdmission(input: {
  reservationId: string;
  userId: string;
  pool?: Pool;
}): Promise<void> {
  try {
    await (input.pool ?? getDatabasePool()).query(
      "select public.release_course_material_admission($1::uuid, $2::uuid)",
      [input.reservationId, input.userId],
    );
  } catch {
    // Unfinalized admission reservations expire automatically.
  }
}

export async function queueManualMaterialRetry(input: {
  materialId: string;
  courseId: string;
  userId: string;
  retryLimit: number;
  pool?: Pool;
}): Promise<boolean> {
  try {
    const result = await (input.pool ?? getDatabasePool()).query(
      `update public.course_materials set status = 'queued', failure_code = null,
         manual_retry_count = manual_retry_count + 1, updated_at = now()
       where id = $1 and course_id = $2 and user_id = $3 and status = 'failed'
         and manual_retry_count < $4`,
      [input.materialId, input.courseId, input.userId, input.retryLimit],
    );
    return result.rowCount === 1;
  } catch {
    return false;
  }
}

export async function undoUnqueuedManualRetry(input: {
  materialId: string;
  courseId: string;
  userId: string;
  pool?: Pool;
}): Promise<void> {
  try {
    await (input.pool ?? getDatabasePool()).query(
      `update public.course_materials set status = 'failed', failure_code = 'queue_unavailable',
         updated_at = now(), manual_retry_count = greatest(manual_retry_count - 1, 0)
       where id = $1 and course_id = $2 and user_id = $3 and status = 'queued'`,
      [input.materialId, input.courseId, input.userId],
    );
  } catch {
    // A failed enqueue must not turn into a new client-visible database error.
  }
}

export function materialAdmissionMessage(status: Exclude<MaterialAdmissionStatus, "reserved">): string {
  if (status === "daily_count_limit") return "You've reached today's course-material limit. Please try again tomorrow.";
  if (status === "daily_bytes_limit") return "You've reached today's upload-size limit. Try again tomorrow or use a smaller material.";
  return "Course materials are temporarily unavailable. Please try again.";
}
