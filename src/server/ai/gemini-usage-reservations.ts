import "server-only";
import type { Pool } from "pg";
import { getServerConfig } from "@/lib/config";
import { getDatabasePool } from "@/server/persistence/pool";
import { GeminiUsageProtectionError, type GeminiReservationDenial } from "./gemini-usage-errors";
export { GeminiUsageProtectionError } from "./gemini-usage-errors";
export type { GeminiReservationDenial } from "./gemini-usage-errors";
import {
  type GeminiUsageCategory,
  GEMINI_USAGE_LEASE_SECONDS,
} from "./gemini-usage-formula";

export type GeminiReservationResult = { status: "reserved"; reservationId: string } | { status: GeminiReservationDenial };

export type GeminiUsageReservation = {
  reservationId: string;
  heartbeat(): Promise<boolean>;
  release(): Promise<void>;
};

export type GeminiUsageLimits = {
  interactiveUserDailyUnits: number;
  backgroundUserDailyUnits: number;
  interactiveAppDailyUnits: number;
  backgroundAppDailyUnits: number;
  totalAppDailyUnits: number;
  maxInFlight: number;
};

function limitsFromConfig(): GeminiUsageLimits {
  const config = getServerConfig();
  return {
    interactiveUserDailyUnits: config.GEMINI_INTERACTIVE_USER_DAILY_USAGE_UNITS,
    backgroundUserDailyUnits: config.GEMINI_BACKGROUND_USER_DAILY_USAGE_UNITS,
    interactiveAppDailyUnits: config.GEMINI_INTERACTIVE_APP_DAILY_USAGE_UNITS,
    backgroundAppDailyUnits: config.GEMINI_BACKGROUND_APP_DAILY_USAGE_UNITS,
    totalAppDailyUnits: config.GEMINI_TOTAL_APP_DAILY_USAGE_UNITS,
    maxInFlight: config.GEMINI_MAX_IN_FLIGHT_REQUESTS,
  };
}
export async function reserveGeminiUsage(
  userId: string,
  category: GeminiUsageCategory,
  usageUnits: number,
  pool?: Pool,
  limits?: GeminiUsageLimits,
): Promise<GeminiReservationResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    || (category !== "interactive" && category !== "background")
    || !Number.isSafeInteger(usageUnits) || usageUnits < 1) return { status: "unavailable" };
  try {
    const configuredLimits = limits ?? limitsFromConfig();
    const result = await (pool ?? getDatabasePool()).query<{ decision: string; reservation_id: string | null }>(
      "select decision, reservation_id from public.reserve_gemini_usage($1::uuid, $2, $3, $4, $5, $6, $7, $8)",
      [
        userId,
        category,
        usageUnits,
        category === "interactive" ? configuredLimits.interactiveUserDailyUnits : configuredLimits.backgroundUserDailyUnits,
        category === "interactive" ? configuredLimits.interactiveAppDailyUnits : configuredLimits.backgroundAppDailyUnits,
        configuredLimits.totalAppDailyUnits,
        configuredLimits.maxInFlight,
        GEMINI_USAGE_LEASE_SECONDS,
      ],
    );
    const row = result.rows[0];
    if (row?.decision === "reserved" && typeof row.reservation_id === "string") {
      return { status: "reserved", reservationId: row.reservation_id };
    }
    if (row?.decision === "user_daily_limit" || row?.decision === "app_daily_limit" || row?.decision === "app_category_daily_limit" || row?.decision === "in_flight_limit") {
      if (row.decision === "app_category_daily_limit") return { status: "app_daily_limit" };
      return { status: row.decision };
    }
    return { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function beginGeminiUsageReservation(input: {
  userId?: string;
  category?: GeminiUsageCategory;
  usageUnits: number;
  pool?: Pool;
  reserve?: typeof reserveGeminiUsage;
}): Promise<GeminiUsageReservation> {
  if (!input.userId || !input.category) throw new GeminiUsageProtectionError("unavailable");
  const result = await (input.reserve ?? reserveGeminiUsage)(input.userId, input.category, input.usageUnits, input.pool);
  if (result.status !== "reserved") throw new GeminiUsageProtectionError(result.status);

  return {
    reservationId: result.reservationId,
    async heartbeat() {
      try {
        const heartbeat = await (input.pool ?? getDatabasePool()).query<{ active: boolean }>(
          "select public.heartbeat_gemini_usage_reservation($1::uuid, $2) as active",
          [result.reservationId, GEMINI_USAGE_LEASE_SECONDS],
        );
        return heartbeat.rows[0]?.active === true;
      } catch {
        return false;
      }
    },
    async release() {
      try {
        await (input.pool ?? getDatabasePool()).query(
          "select public.release_gemini_usage_reservation($1::uuid)",
          [result.reservationId],
        );
      } catch {
        // The reservation expires automatically if release cannot reach PostgreSQL.
      }
    },
  };
}

export async function withGeminiUsageReservation<T>(input: {
  userId?: string;
  category?: GeminiUsageCategory;
  usageUnits: number;
  signal: AbortSignal;
  run(signal: AbortSignal): Promise<T>;
  pool?: Pool;
  reserve?: typeof reserveGeminiUsage;
}): Promise<T> {
  const reservation = await beginGeminiUsageReservation(input);
  const controller = new AbortController();
  const signal = AbortSignal.any([input.signal, controller.signal]);
  const timer = setInterval(() => {
    void reservation.heartbeat().then((active) => {
      if (!active) controller.abort(new Error("Gemini usage lease could not be renewed"));
    });
  }, Math.floor((GEMINI_USAGE_LEASE_SECONDS * 1_000) / 3));
  timer.unref?.();
  try {
    return await input.run(signal);
  } finally {
    clearInterval(timer);
    await reservation.release();
  }
}
