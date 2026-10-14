import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/config", () => ({
  getServerConfig: () => ({
    COURSE_MATERIAL_DAILY_COUNT_LIMIT: 5,
    COURSE_MATERIAL_DAILY_BYTES_LIMIT: 50 * 1024 * 1024,
    COURSE_MATERIAL_MANUAL_RETRY_LIMIT: 2,
  }),
}));

import type { Pool } from "pg";
import {
  finalizeCourseMaterialAdmission,
  materialAdmissionMessage,
  queueManualMaterialRetry,
  releaseCourseMaterialAdmission,
  reserveCourseMaterialAdmission,
  undoUnqueuedManualRetry,
} from "@/server/courses/material-admission";
import { DEFAULT_COURSE_MATERIAL_DAILY_BYTES_LIMIT, DEFAULT_COURSE_MATERIAL_DAILY_COUNT_LIMIT, DEFAULT_COURSE_MATERIAL_MANUAL_RETRY_LIMIT } from "@/contracts/course-material";

const migration = readFileSync(new URL("../../drizzle/0013_course_material_admission_limits.sql", import.meta.url), "utf8");
const drizzleSchema = readFileSync(new URL("../../src/server/persistence/course-schema.ts", import.meta.url), "utf8");
const admissionSchema = readFileSync(new URL("../../src/server/persistence/schema.ts", import.meta.url), "utf8");

function fakePool(rows: unknown[] = []) {
  return { query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }) } as unknown as Pool;
}

describe("course material admission defaults and service boundary", () => {
  it("documents conservative launch defaults", () => {
    expect(DEFAULT_COURSE_MATERIAL_DAILY_COUNT_LIMIT).toBe(5);
    expect(DEFAULT_COURSE_MATERIAL_DAILY_BYTES_LIMIT).toBe(50 * 1024 * 1024);
    expect(DEFAULT_COURSE_MATERIAL_MANUAL_RETRY_LIMIT).toBe(2);
  });

  it("uses configured limits and maps daily count and byte denials safely", async () => {
    const pool = fakePool([{ decision: "reserved", reservation_id: "lease-id" }]);
    await expect(reserveCourseMaterialAdmission({ userId: "owner-id", uploadBytes: 120, pool }))
      .resolves.toEqual({ status: "reserved", reservationId: "lease-id" });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("reserve_course_material_admission"), [
      "owner-id", 120, 5, 50 * 1024 * 1024,
    ]);

    const countDenied = fakePool([{ decision: "daily_count_limit", reservation_id: null }]);
    await expect(reserveCourseMaterialAdmission({ userId: "owner-id", uploadBytes: 120, pool: countDenied }))
      .resolves.toEqual({ status: "daily_count_limit" });
    expect(materialAdmissionMessage("daily_count_limit")).toContain("today's course-material limit");

    const bytesDenied = fakePool([{ decision: "daily_bytes_limit", reservation_id: null }]);
    await expect(reserveCourseMaterialAdmission({ userId: "owner-id", uploadBytes: 120, pool: bytesDenied }))
      .resolves.toEqual({ status: "daily_bytes_limit" });
    expect(materialAdmissionMessage("daily_bytes_limit")).toContain("upload-size limit");
  });

  it("fails closed without exposing database details and does not reserve invalid sizes", async () => {
    const pool = { query: vi.fn().mockRejectedValue(new Error("private connection detail")) } as unknown as Pool;
    await expect(reserveCourseMaterialAdmission({ userId: "owner-id", uploadBytes: 20, pool }))
      .resolves.toEqual({ status: "unavailable" });
    await expect(reserveCourseMaterialAdmission({ userId: "owner-id", uploadBytes: -1, pool }))
      .resolves.toEqual({ status: "unavailable" });
    expect(pool.query).toHaveBeenCalledOnce();
    expect(materialAdmissionMessage("unavailable")).not.toContain("private connection detail");
  });

  it("finalizes and releases only through owner-scoped database calls", async () => {
    const pool = fakePool([{ finalized: true }]);
    await expect(finalizeCourseMaterialAdmission({ reservationId: "lease-id", userId: "owner-id", pool })).resolves.toBe(true);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("finalize_course_material_admission"), ["lease-id", "owner-id"]);
    await releaseCourseMaterialAdmission({ reservationId: "lease-id", userId: "owner-id", pool });
    expect(pool.query).toHaveBeenLastCalledWith(expect.stringContaining("release_course_material_admission"), ["lease-id", "owner-id"]);
  });

  it("atomically increments manual retries only below the configured limit and rolls back failed queueing", async () => {
    const pool = fakePool([]);
    (pool.query as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rows: [], rowCount: 1 });
    await expect(queueManualMaterialRetry({ materialId: "m", courseId: "c", userId: "u", retryLimit: 2, pool })).resolves.toBe(true);
    const [query, params] = (pool.query as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, unknown[]];
    expect(query).toContain("manual_retry_count = manual_retry_count + 1");
    expect(query).toContain("manual_retry_count < $4");
    expect(params).toEqual(["m", "c", "u", 2]);

    await undoUnqueuedManualRetry({ materialId: "m", courseId: "c", userId: "u", pool });
    const rollbackQuery = (pool.query as unknown as ReturnType<typeof vi.fn>).mock.calls[1]?.[0] as string;
    expect(rollbackQuery).toContain("greatest(manual_retry_count - 1, 0)");
    expect(rollbackQuery).toContain("status = 'queued'");

    const limitHit = fakePool([]);
    await expect(queueManualMaterialRetry({ materialId: "m", courseId: "c", userId: "u", retryLimit: 2, pool: limitHit })).resolves.toBe(false);
  });
});

describe("atomic migration behavior and schema alignment", () => {
  it("serializes concurrent admission and counts pending plus admitted usage for the UTC day", () => {
    const lock = migration.indexOf("pg_advisory_xact_lock(184731, 90211)");
    const count = migration.indexOf("select count(*)::integer, coalesce(sum(upload_bytes), 0)::bigint");
    const insert = migration.indexOf("insert into public.course_material_admissions");
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(count);
    expect(count).toBeLessThan(insert);
    expect(migration).toContain("request_day date := (pg_catalog.clock_timestamp() at time zone 'UTC')::date");
    expect(migration).toContain("where user_id = p_user_id and utc_date = request_day");
    expect(migration).toContain("admitted_count + 1 > p_daily_count_limit");
    expect(migration).toContain("admitted_bytes + p_upload_bytes > p_daily_bytes_limit");
  });

  it("does not persist denied admissions, expires abandoned reservations, and resets on the next UTC date", () => {
    const countDenial = migration.indexOf("if admitted_count + 1 > p_daily_count_limit then");
    const denialReturn = migration.indexOf("return query select 'daily_count_limit'", countDenial);
    const laterInsert = migration.indexOf("insert into public.course_material_admissions", denialReturn);
    expect(countDenial).toBeGreaterThan(-1);
    expect(denialReturn).toBeLessThan(laterInsert);
    expect(migration).toContain("state = 'pending' and expires_at <= pg_catalog.clock_timestamp()");
    expect(migration).toContain("utc_date < request_day - 90");
    expect(migration).toContain("where user_id = p_user_id and utc_date = request_day");
  });

  it("keeps admission storage inaccessible to browser roles and aligns new Drizzle columns", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on public.course_material_admissions from public");
    expect(migration).toContain("revoke all on function public.reserve_course_material_admission");
    expect(migration).toContain("array['anon', 'authenticated', 'service_role']");
    expect(migration).toContain("manual_retry_count integer not null default 0");
    expect(migration).toContain("constraint course_material_admissions_bytes_check");
    expect(migration).toContain("constraint course_material_admissions_state_check");
    expect(migration).toContain("constraint course_material_admissions_lease_check");
    expect(drizzleSchema).toContain('manualRetryCount: integer("manual_retry_count").notNull().default(0)');
    expect(drizzleSchema).toContain('course_materials_manual_retry_count_check');
    expect(admissionSchema).toContain('courseMaterialAdmissions = pgTable("course_material_admissions"');
    expect(admissionSchema).toContain('course_material_admissions_user_day_idx');
  });
});
