import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { Pool } from "pg";
import {
  DEFAULT_GEMINI_BACKGROUND_APP_DAILY_UNITS,
  DEFAULT_GEMINI_BACKGROUND_USER_DAILY_UNITS,
  DEFAULT_GEMINI_INTERACTIVE_APP_DAILY_UNITS,
  DEFAULT_GEMINI_INTERACTIVE_USER_DAILY_UNITS,
  DEFAULT_GEMINI_IN_FLIGHT_LIMIT,
  DEFAULT_GEMINI_TOTAL_APP_DAILY_UNITS,
  estimateGeminiEmbeddingUnits,
  estimateGeminiGenerationUnits,
} from "@/server/ai/gemini-usage-formula";
import { GeminiUsageProtectedGenerationProvider } from "@/server/ai/gemini-usage-protected-providers";
import { reserveGeminiUsage } from "@/server/ai/gemini-usage-reservations";
import type { GenerationProvider } from "@/server/ai/provider";
import { flashcardErrorMessage } from "@/components/grounded-concept-learning-modes";

const migration = readFileSync(new URL("../../drizzle/0012_gemini_usage_reservations.sql", import.meta.url), "utf8");
const drizzleSchema = readFileSync(new URL("../../src/server/persistence/schema.ts", import.meta.url), "utf8");
const userId = "3e239071-acfd-41c1-a41b-5cd0878e0322";

describe("Gemini usage estimation", () => {
  it("uses the documented deterministic generation and embedding formulas", () => {
    expect(estimateGeminiGenerationUnits({ messages: [{ role: "user", content: "x".repeat(1_200) }], responseSchema: {}, maxTokens: 900 })).toBe(2);
    expect(estimateGeminiGenerationUnits({ messages: [{ role: "user", content: "x".repeat(20_000) }], responseSchema: {}, maxTokens: 900 })).toBe(8);
    expect(estimateGeminiGenerationUnits({ messages: [{ role: "user", content: "x".repeat(28_000) }], responseSchema: {}, maxTokens: 2_400 })).toBe(12);
    expect(estimateGeminiEmbeddingUnits(["x".repeat(1_200)])).toBe(1);
    expect(estimateGeminiEmbeddingUnits([])).toBe(1);
  });

  it("uses the approved category-specific defaults and maps denial categories safely", async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [{ decision: "user_daily_limit", reservation_id: null }] }) } as unknown as Pool;
    const limits = {
      interactiveUserDailyUnits: DEFAULT_GEMINI_INTERACTIVE_USER_DAILY_UNITS,
      backgroundUserDailyUnits: DEFAULT_GEMINI_BACKGROUND_USER_DAILY_UNITS,
      interactiveAppDailyUnits: DEFAULT_GEMINI_INTERACTIVE_APP_DAILY_UNITS,
      backgroundAppDailyUnits: DEFAULT_GEMINI_BACKGROUND_APP_DAILY_UNITS,
      totalAppDailyUnits: DEFAULT_GEMINI_TOTAL_APP_DAILY_UNITS,
      maxInFlight: DEFAULT_GEMINI_IN_FLIGHT_LIMIT,
    };
    expect(limits).toEqual({
      interactiveUserDailyUnits: 120, backgroundUserDailyUnits: 600,
      interactiveAppDailyUnits: 5_000, backgroundAppDailyUnits: 20_000,
      totalAppDailyUnits: 25_000, maxInFlight: 4,
    });
    await expect(reserveGeminiUsage(userId, "interactive", 2, pool, limits)).resolves.toEqual({ status: "user_daily_limit" });
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [userId, "interactive", 2, 120, 5_000, 25_000, 4, 120]);
    (pool.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [{ decision: "app_daily_limit", reservation_id: null }] });
    await expect(reserveGeminiUsage(userId, "background", 2, pool, limits)).resolves.toEqual({ status: "app_daily_limit" });
    expect(pool.query).toHaveBeenLastCalledWith(expect.any(String), [userId, "background", 2, 600, 20_000, 25_000, 4, 120]);
    (pool.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [{ decision: "app_category_daily_limit", reservation_id: null }] });
    await expect(reserveGeminiUsage(userId, "background", 2, pool, limits)).resolves.toEqual({ status: "app_daily_limit" });
    (pool.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [{ decision: "in_flight_limit", reservation_id: null }] });
    await expect(reserveGeminiUsage(userId, "interactive", 2, pool, limits)).resolves.toEqual({ status: "in_flight_limit" });
  });

  it("fails closed when quota storage is unavailable", async () => {
    const pool = { query: vi.fn().mockRejectedValue(new Error("private database details")) } as unknown as Pool;
    await expect(reserveGeminiUsage(userId, "interactive", 1, pool, {
      interactiveUserDailyUnits: 120, backgroundUserDailyUnits: 600,
      interactiveAppDailyUnits: 5_000, backgroundAppDailyUnits: 20_000,
      totalAppDailyUnits: 25_000, maxInFlight: 4,
    })).resolves.toEqual({ status: "unavailable" });
  });

  it("fails closed for missing usage category before querying quota storage", async () => {
    const pool = { query: vi.fn() } as unknown as Pool;
    await expect(reserveGeminiUsage(userId, undefined as never, 1, pool)).resolves.toEqual({ status: "unavailable" });
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe("Gemini provider reservation boundary", () => {
  it("admits only the four concurrently reserved requests and charges each request before generation", async () => {
    let activeReservations = 0;
    const reserve = vi.fn(async () => {
      if (activeReservations >= 4) return { status: "in_flight_limit" as const };
      activeReservations += 1;
      return { status: "reserved" as const, reservationId: `lease-${activeReservations}` };
    });
    const pool = { query: vi.fn(async () => ({ rows: [] })) } as unknown as Pool;
    let releaseStarted: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => { releaseStarted = resolve; });
    const generate = vi.fn(async () => {
      await blocked;
      return "ok";
    });
    const wrapped = new GeminiUsageProtectedGenerationProvider({ generate } as unknown as GenerationProvider, reserve, pool);
    const requests = Array.from({ length: 5 }, () => wrapped.generate({
      messages: [{ role: "user", content: "question" }], responseSchema: {}, signal: new AbortController().signal,
      usageUserId: userId, usageCategory: "interactive",
    }));
    const outcomesPromise = Promise.allSettled(requests);
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(4));
    expect(reserve).toHaveBeenCalledTimes(5);
    expect(reserve).toHaveBeenCalledWith(userId, "interactive", expect.any(Number), pool);
    releaseStarted?.();
    const outcomes = await outcomesPromise;
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(4);
    expect(outcomes.filter((outcome) => outcome.status === "rejected").map((outcome) => outcome.status === "rejected" ? outcome.reason : null))
      .toEqual([expect.objectContaining({ name: "GeminiUsageProtectionError", reason: "in_flight_limit" })]);
    expect(pool.query).toHaveBeenCalledTimes(4);
  });

  it("does not call the provider if the reservation cannot be made and exposes no database detail", async () => {
    const generate = vi.fn();
    const wrapped = new GeminiUsageProtectedGenerationProvider({ generate } as unknown as GenerationProvider, async () => ({ status: "unavailable" }));
    await expect(wrapped.generate({
      messages: [{ role: "user", content: "private question" }], responseSchema: {}, signal: new AbortController().signal,
      usageUserId: userId, usageCategory: "interactive",
    })).rejects.toMatchObject({ name: "GeminiUsageProtectionError", reason: "unavailable" });
    expect(generate).not.toHaveBeenCalled();
  });

  it("passes the declared usage category to the shared reservation for each provider call", async () => {
    const reserve = vi.fn(async () => ({ status: "reserved" as const, reservationId: "lease-category" }));
    const pool = { query: vi.fn().mockResolvedValue({ rows: [{ active: true }] }) } as unknown as Pool;
    const generate = vi.fn(async () => "ok");
    const wrapped = new GeminiUsageProtectedGenerationProvider({ generate } as unknown as GenerationProvider, reserve, pool);
    await wrapped.generate({
      messages: [{ role: "user", content: "lecture extraction" }], responseSchema: {}, signal: new AbortController().signal,
      usageUserId: userId, usageCategory: "background",
    });
    expect(reserve).toHaveBeenCalledWith(userId, "background", expect.any(Number), pool);
  });

  it("uses a safe student message when the shared quota blocks flashcards", () => {
    expect(flashcardErrorMessage("usage_limit")).toContain("shared AI usage limit");
  });
});

describe("atomic migration safety", () => {
  it("aligns daily usage constraints and reservation timestamp defaults with Drizzle", () => {
    expect(migration).toContain("constraint gemini_usage_daily_scope_category_check check (");
    expect(migration).toContain("constraint gemini_usage_daily_units_check check (usage_units >= 0)");
    expect(drizzleSchema).toContain('check("gemini_usage_daily_scope_category_check"');
    expect(drizzleSchema).toContain('check("gemini_usage_daily_units_check"');
    expect(migration).toContain("created_at timestamptz not null default now()");
    expect(drizzleSchema).toMatch(/createdAt: timestamp\("created_at", \{ withTimezone: true \}\)\.notNull\(\)\.defaultNow\(\)/);
  });

  it("serializes reservations, checks both budgets, and reclaims expired slots", () => {
    expect(migration).toContain("pg_advisory_xact_lock(184731, 90210)");
    expect(migration).toContain("user_daily_limit");
    expect(migration).toContain("app_daily_limit");
    expect(migration).toContain("app_category_daily_limit");
    expect(migration).toContain("category = 'combined'");
    expect(migration).toContain("p_user_category_daily_limit");
    expect(migration).toContain("p_app_category_daily_limit");
    expect(migration).toContain("p_app_total_daily_limit");
    expect(migration).toContain("active_count >= p_in_flight_limit");
    expect(migration).toContain("delete from public.gemini_usage_reservations where expires_at <= pg_catalog.clock_timestamp()");
    expect(migration).toContain("where id = p_reservation_id and expires_at > pg_catalog.clock_timestamp()");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("revoke all on table public.gemini_usage_daily from public");
    expect(migration).toContain("revoke all on function public.reserve_gemini_usage");
  });

  it("keeps background and interactive buckets separate while charging both to combined app usage", () => {
    expect(migration).toContain("primary key (utc_date, category, scope, scope_id)");
    expect(migration).toContain("values (request_day, p_category, 'user', p_user_id::text, p_usage_units)");
    expect(migration).toContain("values (request_day, 'combined', 'app', 'all', p_usage_units)");
    expect(migration).toContain("category in ('interactive', 'background')");
  });
});
