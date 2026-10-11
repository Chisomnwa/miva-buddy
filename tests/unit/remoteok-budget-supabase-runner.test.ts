import { describe, expect, it } from "vitest";
import { buildHostedRunnerConfig, redactSensitiveOutput } from "../../scripts/run-remoteok-budget-supabase-tests";
import {
  approvedSupabaseRemoteOkBudgetTestEndpoint as endpoint,
  approvedSupabaseRemoteOkBudgetTestProjectRef as projectRef,
} from "../integration/remoteok-budget-supabase-test-database";

const appProjectRef = "mainprojectref000000";
const marker = "a".repeat(64);

function makeDatabaseUrl(user: string, password: string, host: string): string {
  const url = new URL("postgresql://localhost");
  url.username = user;
  url.password = password;
  url.hostname = host;
  url.port = "5432";
  url.pathname = "/postgres";
  return url.toString();
}

function validFile(): string {
  return [
    "RUN_REMOTEOK_BUDGET_SUPABASE_TESTS=1",
    `REMOTEOK_BUDGET_SUPABASE_TEST_DATABASE_URL=${makeDatabaseUrl(`miva_remoteok_budget_test.${projectRef}`, "synthetic-password", endpoint.slice(0, -":5432".length))}`,
    `REMOTEOK_BUDGET_SUPABASE_TEST_PROJECT_REF=${projectRef}`,
    `REMOTEOK_BUDGET_SUPABASE_TEST_ENDPOINT=${endpoint}`,
    `REMOTEOK_BUDGET_SUPABASE_TEST_MARKER=${marker}`,
    "REMOTEOK_BUDGET_SUPABASE_TEST_POSTGRES_MAJOR_VERSION=17",
  ].join("\n");
}

describe("Remote OK hosted-test runner configuration", () => {
  it("accepts the explicitly approved test project and adds the trusted app URL separately", () => {
    const config = buildHostedRunnerConfig(validFile(), `https://${appProjectRef}.supabase.co`, {
      PATH: "/usr/bin",
      TMPDIR: "/tmp",
      DATABASE_URL: "must-not-be-forwarded",
      NODE_OPTIONS: "must-not-be-forwarded",
    });
    expect(config).not.toBeNull();
    expect(Object.keys(config!.childEnvironment).sort()).toEqual([
      "NODE_ENV",
      "NEXT_PUBLIC_SUPABASE_URL",
      "PATH",
      "REMOTEOK_BUDGET_SUPABASE_TEST_DATABASE_URL",
      "REMOTEOK_BUDGET_SUPABASE_TEST_ENDPOINT",
      "REMOTEOK_BUDGET_SUPABASE_TEST_MARKER",
      "REMOTEOK_BUDGET_SUPABASE_TEST_POSTGRES_MAJOR_VERSION",
      "REMOTEOK_BUDGET_SUPABASE_TEST_PROJECT_REF",
      "RUN_REMOTEOK_BUDGET_SUPABASE_TESTS",
      "TMPDIR",
    ].sort());
    expect(config!.childEnvironment.NEXT_PUBLIC_SUPABASE_URL).toBe(`https://${appProjectRef}.supabase.co`);
    expect(config!.childEnvironment).not.toHaveProperty("DATABASE_URL");
    expect(config!.childEnvironment).not.toHaveProperty("NODE_OPTIONS");
  });

  it.each([
    ["unexpected DATABASE_URL", `DATABASE_URL=${makeDatabaseUrl("user", "placeholder", "localhost")}`],
    ["unexpected application URL override", `NEXT_PUBLIC_SUPABASE_URL=https://${projectRef}.supabase.co`],
    ["unexpected NODE_OPTIONS", "NODE_OPTIONS=--require=unexpected"],
  ])("rejects %s in the dedicated test file", (_label, extra) => {
    expect(buildHostedRunnerConfig(`${validFile()}\n${extra}`, `https://${appProjectRef}.supabase.co`)).toBeNull();
  });

  it("rejects missing, duplicate, and malformed assignments", () => {
    const withoutMarker = validFile().split("\n")
      .filter((line) => !line.startsWith("REMOTEOK_BUDGET_SUPABASE_TEST_MARKER="))
      .join("\n");
    expect(buildHostedRunnerConfig(withoutMarker, `https://${appProjectRef}.supabase.co`)).toBeNull();
    expect(buildHostedRunnerConfig(`${validFile()}\nRUN_REMOTEOK_BUDGET_SUPABASE_TESTS=0`, `https://${appProjectRef}.supabase.co`)).toBeNull();
    expect(buildHostedRunnerConfig(`${validFile()}\nthis is not an assignment`, `https://${appProjectRef}.supabase.co`)).toBeNull();
  });

  it("pins the allowed project, endpoint, and PostgreSQL major version", () => {
    expect(buildHostedRunnerConfig(validFile().replace(projectRef, "otherprojectref000000"), `https://${appProjectRef}.supabase.co`)).toBeNull();
    expect(buildHostedRunnerConfig(validFile().replace(endpoint, "other-0-region.pooler.supabase.com:5432"), `https://${appProjectRef}.supabase.co`)).toBeNull();
    expect(buildHostedRunnerConfig(validFile().replace("POSTGRES_MAJOR_VERSION=17", "POSTGRES_MAJOR_VERSION=16"), `https://${appProjectRef}.supabase.co`)).toBeNull();
  });

  it("rejects a missing, malformed, or matching application project URL", () => {
    expect(buildHostedRunnerConfig(validFile(), undefined)).toBeNull();
    expect(buildHostedRunnerConfig(validFile(), "not-a-url")).toBeNull();
    expect(buildHostedRunnerConfig(validFile(), `https://${projectRef}.supabase.co`)).toBeNull();
  });

  it("redacts the raw URL, password, and marker from captured test output", () => {
    const config = buildHostedRunnerConfig(validFile(), `https://${appProjectRef}.supabase.co`)!;
    const unsafeOutput = `${validFile()} password synthetic-password marker ${marker}`;
    const safeOutput = redactSensitiveOutput(unsafeOutput, config.redactions);
    expect(safeOutput).not.toContain("synthetic-password");
    expect(safeOutput).not.toContain(marker);
    expect(safeOutput).not.toContain("postgresql://");
  });
});
