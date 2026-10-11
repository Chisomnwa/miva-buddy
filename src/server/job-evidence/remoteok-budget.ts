import "server-only";
import type { Pool } from "pg";
import { getDatabasePool } from "@/server/persistence/pool";

export const REMOTE_OK_DAILY_REQUEST_LIMIT = 4;

export type RemoteOkBudgetReservation = "reserved" | "exhausted" | "unavailable";

/** Reserve before contacting the provider; failures are deliberately not refunded. */
export async function reserveRemoteOkDailyRequest(
  pool?: Pool,
  requestedAt?: Date,
): Promise<RemoteOkBudgetReservation> {
  try {
    const database = pool ?? getDatabasePool();
    const result = requestedAt
      ? await database.query<{ reserved: boolean }>(
        "select public.reserve_remoteok_request_budget($1, $2) as reserved",
        [REMOTE_OK_DAILY_REQUEST_LIMIT, requestedAt],
      )
      : await database.query<{ reserved: boolean }>(
        "select public.reserve_remoteok_request_budget($1) as reserved",
        [REMOTE_OK_DAILY_REQUEST_LIMIT],
      );
    const reserved = result.rows[0]?.reserved;
    if (reserved === true) return "reserved";
    if (reserved === false) return "exhausted";
    return "unavailable";
  } catch {
    // Do not log connection details or expose database errors to the lesson or browser.
    return "unavailable";
  }
}
