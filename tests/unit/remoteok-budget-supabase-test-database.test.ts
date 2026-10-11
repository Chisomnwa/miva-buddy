import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  approvedSupabaseRemoteOkBudgetTestEndpoint,
  approvedSupabaseRemoteOkBudgetTestPostgresMajorVersion,
  approvedSupabaseRemoteOkBudgetTestProjectRef,
  parseSupabaseRemoteOkBudgetTestConfig,
  createSupabaseRemoteOkBudgetTestTls,
  validateSupabaseRemoteOkBudgetTestCaCertificate,
  verifySupabaseRemoteOkBudgetTestDatabase,
  type SupabaseRemoteOkBudgetTestConfig,
  type SupabaseRemoteOkBudgetTestEnvironment,
} from "../integration/remoteok-budget-supabase-test-database";

const testProjectRef = approvedSupabaseRemoteOkBudgetTestProjectRef;
const applicationProjectRef = "mainprojectref000000";
const testMarker = "a".repeat(64);
const testEndpointHost = approvedSupabaseRemoteOkBudgetTestEndpoint.slice(0, -":5432".length);

function makeDatabaseUrl(user: string, password: string, host: string, database = "postgres"): string {
  const url = new URL("postgresql://localhost");
  url.username = user;
  url.password = password;
  url.hostname = host;
  url.port = "5432";
  url.pathname = `/${database}`;
  return url.toString();
}

function validEnvironment(): SupabaseRemoteOkBudgetTestEnvironment {
  return {
    optIn: "1",
    databaseUrl: makeDatabaseUrl(`miva_remoteok_budget_test.${testProjectRef}`, "synthetic-password", testEndpointHost),
    allowedProjectRef: testProjectRef,
    allowedEndpoint: approvedSupabaseRemoteOkBudgetTestEndpoint,
    marker: testMarker,
    postgresMajorVersion: approvedSupabaseRemoteOkBudgetTestPostgresMajorVersion,
    applicationSupabaseUrl: `https://${applicationProjectRef}.supabase.co`,
  };
}

function validConfig(): SupabaseRemoteOkBudgetTestConfig {
  const config = parseSupabaseRemoteOkBudgetTestConfig(validEnvironment());
  if (!config) throw new Error("Test fixture must satisfy the hosted test configuration contract.");
  return config;
}

describe("Supabase Remote OK integration database configuration", () => {
  it("keeps certificate verification enabled when adding the local CA", () => {
    expect(createSupabaseRemoteOkBudgetTestTls("validated test CA PEM")).toEqual({
      ca: "validated test CA PEM",
      rejectUnauthorized: true,
    });
  });

  it("rejects a missing, malformed, or non-CA local certificate bundle", () => {
    expect(validateSupabaseRemoteOkBudgetTestCaCertificate("")).toBeNull();
    expect(validateSupabaseRemoteOkBudgetTestCaCertificate("not a certificate")).toBeNull();
    expect(validateSupabaseRemoteOkBudgetTestCaCertificate(
      "-----BEGIN CERTIFICATE-----\nAQID\n-----END CERTIFICATE-----",
    )).toBeNull();
    expect(validateSupabaseRemoteOkBudgetTestCaCertificate(
      "-----BEGIN CERTIFICATE-----\nAQID\n-----END CERTIFICATE-----\nextra content",
    )).toBeNull();
  });

  it("accepts only the approved test endpoint and returns verified TLS connection fields", () => {
    const config = parseSupabaseRemoteOkBudgetTestConfig(validEnvironment());
    expect(config).toMatchObject({
      connection: {
        host: testEndpointHost,
        port: 5432,
        database: "postgres",
        user: `miva_remoteok_budget_test.${testProjectRef}`,
        ssl: { rejectUnauthorized: true },
      },
      projectRef: testProjectRef,
      endpoint: approvedSupabaseRemoteOkBudgetTestEndpoint,
      marker: testMarker,
      postgresMajorVersion: 17,
    });
    expect(config?.connection).not.toHaveProperty("connectionString");
  });

  it("accepts an exact allowlisted Supabase Session pooler endpoint only in session mode", () => {
    const environment = validEnvironment();
    const host = testEndpointHost;
    expect(parseSupabaseRemoteOkBudgetTestConfig(environment)?.connection).toMatchObject({
      host,
      port: 5432,
      user: `miva_remoteok_budget_test.${testProjectRef}`,
      ssl: { rejectUnauthorized: true },
    });
  });

  it.each([
    ["missing opt-in", { optIn: undefined }],
    ["main application project", {
      allowedProjectRef: applicationProjectRef,
      allowedEndpoint: approvedSupabaseRemoteOkBudgetTestEndpoint,
      databaseUrl: makeDatabaseUrl(`miva_remoteok_budget_test.${applicationProjectRef}`, "synthetic-password", testEndpointHost),
    }],
    ["unexpected project reference", { allowedProjectRef: "otherprojectref000000" }],
    ["unapproved endpoint", { allowedEndpoint: "aws-0-us-east-1.pooler.supabase.com:5432" }],
    ["direct endpoint instead of the approved pooler", {
      allowedEndpoint: `db.${testProjectRef}.supabase.co:5432`,
      databaseUrl: makeDatabaseUrl("miva_remoteok_budget_test", "synthetic-password", `db.${testProjectRef}.supabase.co`),
    }],
    ["missing application project reference", { applicationSupabaseUrl: undefined }],
    ["unparseable application project reference", { applicationSupabaseUrl: "https://supabase.co" }],
    ["unexpected endpoint host", { allowedEndpoint: "db.otherprojectref000000.supabase.co:5432" }],
    ["missing marker", { marker: undefined }],
    ["malformed marker", { marker: "not-an-independent-project-marker" }],
    ["query parameters", { databaseUrl: `${validEnvironment().databaseUrl}?host=127.0.0.1` }],
    ["URL fragment", { databaseUrl: `${validEnvironment().databaseUrl}#fragment` }],
    ["empty query delimiter", { databaseUrl: `${validEnvironment().databaseUrl}?` }],
    ["transaction pooler port", {
      allowedEndpoint: "aws-0-us-east-1.pooler.supabase.com:6543",
      databaseUrl: makeDatabaseUrl(`miva_remoteok_budget_test.${testProjectRef}`, "synthetic-password", "aws-0-us-east-1.pooler.supabase.com"),
    }],
    ["wrong role identity", {
      databaseUrl: makeDatabaseUrl("postgres", "synthetic-password", testEndpointHost),
    }],
    ["missing role identity", {
      databaseUrl: makeDatabaseUrl("", "synthetic-password", testEndpointHost),
    }],
    ["missing password", {
      databaseUrl: makeDatabaseUrl(`miva_remoteok_budget_test.${testProjectRef}`, "", testEndpointHost),
    }],
    ["insecure TLS override", { databaseUrl: `${validEnvironment().databaseUrl}?sslmode=disable` }],
    ["unsupported database URL scheme", { databaseUrl: validEnvironment().databaseUrl!.replace("postgresql://", "https://") }],
    ["wrong database name", { databaseUrl: validEnvironment().databaseUrl!.replace(/\/postgres$/u, "/miva_buddy_remoteok_budget_test") }],
    ["wrong expected PostgreSQL version", { postgresMajorVersion: "not-a-version" }],
  ])("rejects %s", (_name, overrides) => {
    expect(parseSupabaseRemoteOkBudgetTestConfig({ ...validEnvironment(), ...overrides })).toBeNull();
  });
});

describe("Supabase Remote OK database read-only preflight", () => {
  const row = {
    database_name: "postgres",
    database_user: "miva_remoteok_budget_test",
    server_version_num: 170006,
    project_ref: testProjectRef,
    endpoint: approvedSupabaseRemoteOkBudgetTestEndpoint,
    marker_value: testMarker,
  };

  it("accepts exactly one row matching the expected project, endpoint, identity, version, and marker", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row] });
    await expect(verifySupabaseRemoteOkBudgetTestDatabase(
      { query } as unknown as Pick<Pool, "query">,
      validConfig(),
    )).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0]?.[0]).toContain("select current_database()");
    expect(query.mock.calls[0]?.[0]).toContain("from public.miva_buddy_remoteok_test_guard");
    expect(query.mock.calls[0]?.[1]).toEqual(["remoteok-budget-integration"]);
  });

  it.each([
    ["wrong database", { database_name: "other" }],
    ["wrong database user", { database_user: "postgres" }],
    ["wrong PostgreSQL version", { server_version_num: 160000 }],
    ["wrong project reference", { project_ref: "otherprojectref000000" }],
    ["wrong endpoint", { endpoint: "db.otherprojectref000000.supabase.co:5432" }],
    ["wrong marker", { marker_value: "b".repeat(64) }],
  ])("fails closed for %s", async (_name, changes) => {
    const query = vi.fn().mockResolvedValue({ rows: [{ ...row, ...changes }] });
    await expect(verifySupabaseRemoteOkBudgetTestDatabase(
      { query } as unknown as Pick<Pool, "query">,
      validConfig(),
    )).rejects.toThrow(/no migration or test setup was executed/u);
  });

  it("fails closed when no marker row is present", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await expect(verifySupabaseRemoteOkBudgetTestDatabase(
      { query } as unknown as Pick<Pool, "query">,
      validConfig(),
    )).rejects.toThrow(/no migration or test setup was executed/u);
  });

  it("fails closed when duplicate marker rows are present", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row, row] });
    await expect(verifySupabaseRemoteOkBudgetTestDatabase(
      { query } as unknown as Pick<Pool, "query">,
      validConfig(),
    )).rejects.toThrow(/no migration or test setup was executed/u);
  });

  it("sanitizes preflight query errors and does not continue setup", async () => {
    const query = vi.fn().mockRejectedValue(new Error("sensitive driver details"));
    await expect(verifySupabaseRemoteOkBudgetTestDatabase(
      { query } as unknown as Pick<Pool, "query">,
      validConfig(),
    )).rejects.toThrow("Hosted Remote OK test database preflight failed; no migration or test setup was executed.");
  });
});
