import { readFile } from "node:fs/promises";
import { Pool, type PoolConfig } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { REMOTE_OK_DAILY_REQUEST_LIMIT, reserveRemoteOkDailyRequest } from "@/server/job-evidence/remoteok-budget";
import { parseRemoteOkBudgetTestDatabaseUrl } from "./remoteok-budget-test-database";
import {
  createSupabaseRemoteOkBudgetTestTls,
  loadSupabaseRemoteOkBudgetTestCaCertificate,
  parseSupabaseRemoteOkBudgetTestConfig,
  verifySupabaseRemoteOkBudgetTestDatabase,
} from "./remoteok-budget-supabase-test-database";

vi.mock("server-only", () => ({}));

const runLocalDatabaseTests = process.env.RUN_REMOTEOK_BUDGET_DB_TESTS === "1";
const runSupabaseDatabaseTests = process.env.RUN_REMOTEOK_BUDGET_SUPABASE_TESTS === "1";
if (runLocalDatabaseTests && runSupabaseDatabaseTests) {
  throw new Error("Choose exactly one Remote OK budget integration-test mode.");
}

const localDatabaseConfig = parseRemoteOkBudgetTestDatabaseUrl(process.env.REMOTEOK_BUDGET_TEST_DATABASE_URL);
const supabaseDatabaseConfig = parseSupabaseRemoteOkBudgetTestConfig({
  optIn: process.env.RUN_REMOTEOK_BUDGET_SUPABASE_TESTS,
  databaseUrl: process.env.REMOTEOK_BUDGET_SUPABASE_TEST_DATABASE_URL,
  allowedProjectRef: process.env.REMOTEOK_BUDGET_SUPABASE_TEST_PROJECT_REF,
  allowedEndpoint: process.env.REMOTEOK_BUDGET_SUPABASE_TEST_ENDPOINT,
  marker: process.env.REMOTEOK_BUDGET_SUPABASE_TEST_MARKER,
  postgresMajorVersion: process.env.REMOTEOK_BUDGET_SUPABASE_TEST_POSTGRES_MAJOR_VERSION,
  applicationSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
});

if (runLocalDatabaseTests && !localDatabaseConfig) {
  throw new Error("Remote OK budget integration tests require the dedicated local test database configuration.");
}
if (runSupabaseDatabaseTests && !supabaseDatabaseConfig) {
  throw new Error("Remote OK budget integration tests require a valid, separately allowlisted Supabase test configuration.");
}

const runDatabaseTests = runLocalDatabaseTests || runSupabaseDatabaseTests;

const testDates = [
  new Date("2031-01-01T12:00:00.000Z"),
  new Date("2031-01-01T23:59:59.999Z"),
  new Date("2031-01-02T00:00:00.000Z"),
];
const currentUtcDate = new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00.000Z`);

describe.skipIf(!runDatabaseTests)("Remote OK shared budget (isolated local PostgreSQL)", () => {
  let firstPool: Pool;
  let secondPool: Pool;
  let migrationApplied = false;

  beforeAll(async () => {
    let connection: PoolConfig;
    if (supabaseDatabaseConfig) {
      const ca = await loadSupabaseRemoteOkBudgetTestCaCertificate();
      connection = {
        ...supabaseDatabaseConfig.connection,
        ssl: createSupabaseRemoteOkBudgetTestTls(ca),
      };
    } else if (localDatabaseConfig) {
      connection = localDatabaseConfig;
    } else {
      throw new Error("Remote OK budget integration tests require an explicitly opted-in, validated test database configuration.");
    }
    firstPool = new Pool({ ...connection, max: 1, application_name: "miva-budget-integration-a" });
    if (supabaseDatabaseConfig) {
      await verifySupabaseRemoteOkBudgetTestDatabase(firstPool, supabaseDatabaseConfig);
    }
    secondPool = new Pool({ ...connection, max: 1, application_name: "miva-budget-integration-b" });
    const migration = await readFile(new URL("../../drizzle/0009_remoteok_request_budget.sql", import.meta.url), "utf8");
    await firstPool.query(migration);
    migrationApplied = true;
  });

  beforeEach(async () => {
    const dates = [...testDates, currentUtcDate];
    await firstPool.query(
      "delete from public.remoteok_request_budgets where provider = 'remoteok' and utc_date = any($1::date[])",
      [dates.map((date) => date.toISOString().slice(0, 10))],
    );
  });

  afterAll(async () => {
    try {
      if (migrationApplied && firstPool) {
        await firstPool.query(
          "delete from public.remoteok_request_budgets where provider = 'remoteok' and utc_date = any($1::date[])",
          [[...testDates, currentUtcDate].map((date) => date.toISOString().slice(0, 10))],
        );
      }
    } finally {
      await Promise.all([firstPool?.end(), secondPool?.end()].filter((pool): pool is Promise<void> => Boolean(pool)));
    }
  });

  it("reserves the first request using the database's current UTC day", async () => {
    await expect(reserveRemoteOkDailyRequest(firstPool)).resolves.toBe("reserved");
    const result = await firstPool.query<{ utc_date: string; request_count: number }>(
      "select utc_date::text, request_count from public.remoteok_request_budgets where provider = 'remoteok' and utc_date = (pg_catalog.now() at time zone 'UTC')::date",
    );
    expect(result.rows).toEqual([{ utc_date: currentUtcDate.toISOString().slice(0, 10), request_count: 1 }]);
  });

  it("does not reserve beyond the configured daily budget", async () => {
    const reservations = await Promise.all(Array.from({ length: REMOTE_OK_DAILY_REQUEST_LIMIT }, () =>
      reserveRemoteOkDailyRequest(firstPool, testDates[0]),
    ));
    expect(reservations).toEqual(Array.from({ length: REMOTE_OK_DAILY_REQUEST_LIMIT }, () => "reserved"));
    await expect(reserveRemoteOkDailyRequest(secondPool, testDates[0])).resolves.toBe("exhausted");
  });

  it("never exceeds the cap under concurrent reservations from separate pools", async () => {
    const requests = Array.from({ length: 20 }, (_, index) =>
      reserveRemoteOkDailyRequest(index % 2 === 0 ? firstPool : secondPool, testDates[0]),
    );
    const outcomes = await Promise.all(requests);
    expect(outcomes.filter((outcome) => outcome === "reserved")).toHaveLength(REMOTE_OK_DAILY_REQUEST_LIMIT);
    expect(outcomes.filter((outcome) => outcome === "exhausted")).toHaveLength(20 - REMOTE_OK_DAILY_REQUEST_LIMIT);
  });

  it("persists reservations across independent database connections", async () => {
    await expect(reserveRemoteOkDailyRequest(firstPool, testDates[0])).resolves.toBe("reserved");
    await expect(reserveRemoteOkDailyRequest(secondPool, testDates[0])).resolves.toBe("reserved");
    const result = await secondPool.query<{ request_count: number }>(
      "select request_count from public.remoteok_request_budgets where provider = 'remoteok' and utc_date = $1::date",
      [testDates[0].toISOString().slice(0, 10)],
    );
    expect(result.rows[0]?.request_count).toBe(2);
  });

  it("does not grant student-facing Supabase roles access to the counter or function", async () => {
    const result = await firstPool.query<{
      role_name: string;
      role_exists: boolean;
      can_select: boolean | null;
      can_insert: boolean | null;
      can_update: boolean | null;
      can_delete: boolean | null;
      can_truncate: boolean | null;
      can_reference: boolean | null;
      can_trigger: boolean | null;
      can_maintain: boolean | null;
      can_execute_function: boolean | null;
    }>(`
      select expected.role_name,
        roles.oid is not null as role_exists,
        case when roles.oid is not null then pg_catalog.has_table_privilege(roles.oid, 'public.remoteok_request_budgets', 'select') end as can_select,
        case when roles.oid is not null then pg_catalog.has_table_privilege(roles.oid, 'public.remoteok_request_budgets', 'insert') end as can_insert,
        case when roles.oid is not null then pg_catalog.has_table_privilege(roles.oid, 'public.remoteok_request_budgets', 'update') end as can_update,
        case when roles.oid is not null then pg_catalog.has_table_privilege(roles.oid, 'public.remoteok_request_budgets', 'delete') end as can_delete,
        case when roles.oid is not null then pg_catalog.has_table_privilege(roles.oid, 'public.remoteok_request_budgets', 'truncate') end as can_truncate,
        case when roles.oid is not null then pg_catalog.has_table_privilege(roles.oid, 'public.remoteok_request_budgets', 'references') end as can_reference,
        case when roles.oid is not null then pg_catalog.has_table_privilege(roles.oid, 'public.remoteok_request_budgets', 'trigger') end as can_trigger,
        case when roles.oid is not null and current_setting('server_version_num')::integer >= 170000
          then pg_catalog.has_table_privilege(roles.oid, 'public.remoteok_request_budgets', 'maintain')
          when roles.oid is not null then false
        end as can_maintain,
        case when roles.oid is not null then pg_catalog.has_function_privilege(roles.oid, 'public.reserve_remoteok_request_budget(integer,timestamptz)', 'execute') end as can_execute_function
      from unnest(array['anon', 'authenticated', 'service_role']) as expected(role_name)
      left join pg_catalog.pg_roles as roles on roles.rolname = expected.role_name
    `);

    expect(result.rows).toHaveLength(3);
    for (const role of result.rows) {
      expect(role.role_exists, `Expected required test role '${role.role_name}' to exist; missing roles are not proof of denied access.`).toBe(true);
      expect({
        select: role.can_select,
        insert: role.can_insert,
        update: role.can_update,
        delete: role.can_delete,
        truncate: role.can_truncate,
        references: role.can_reference,
        trigger: role.can_trigger,
        maintain: role.can_maintain,
      }, `${role.role_name} must have no table privileges on the private request-budget table.`).toEqual({
        select: false,
        insert: false,
        update: false,
        delete: false,
        truncate: false,
        references: false,
        trigger: false,
        maintain: false,
      });
      expect(role.can_execute_function, `${role.role_name} must not execute the private reservation function.`).toBe(false);
    }
  });

  it("resets the budget on the UTC date boundary, independent of session timezone", async () => {
    const client = await firstPool.connect();
    try {
      await client.query("set time zone 'Pacific/Honolulu'");
      const beforeMidnight = await client.query<{ reserved: boolean }>(
        "select public.reserve_remoteok_request_budget($1, $2) as reserved",
        [REMOTE_OK_DAILY_REQUEST_LIMIT, testDates[1]],
      );
      const afterMidnight = await client.query<{ reserved: boolean }>(
        "select public.reserve_remoteok_request_budget($1, $2) as reserved",
        [REMOTE_OK_DAILY_REQUEST_LIMIT, testDates[2]],
      );
      expect(beforeMidnight.rows[0]?.reserved).toBe(true);
      expect(afterMidnight.rows[0]?.reserved).toBe(true);
    } finally {
      await client.query("set time zone 'UTC'");
      client.release();
    }
    const result = await firstPool.query<{ utc_date: string; request_count: number }>(
      "select utc_date::text, request_count from public.remoteok_request_budgets where provider = 'remoteok' and utc_date = any($1::date[]) order by utc_date",
      [["2031-01-01", "2031-01-02"]],
    );
    expect(result.rows).toEqual([
      { utc_date: "2031-01-01", request_count: 1 },
      { utc_date: "2031-01-02", request_count: 1 },
    ]);
  });
});
