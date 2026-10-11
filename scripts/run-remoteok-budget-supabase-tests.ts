import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { resolve } from "node:path";
import {
  approvedSupabaseRemoteOkBudgetTestEndpoint,
  approvedSupabaseRemoteOkBudgetTestPostgresMajorVersion,
  approvedSupabaseRemoteOkBudgetTestProjectRef,
  parseSupabaseRemoteOkBudgetTestConfig,
} from "../tests/integration/remoteok-budget-supabase-test-database";

const hostedTestVariables = [
  "RUN_REMOTEOK_BUDGET_SUPABASE_TESTS",
  "REMOTEOK_BUDGET_SUPABASE_TEST_DATABASE_URL",
  "REMOTEOK_BUDGET_SUPABASE_TEST_PROJECT_REF",
  "REMOTEOK_BUDGET_SUPABASE_TEST_ENDPOINT",
  "REMOTEOK_BUDGET_SUPABASE_TEST_MARKER",
  "REMOTEOK_BUDGET_SUPABASE_TEST_POSTGRES_MAJOR_VERSION",
] as const;

const hostedIntegrationTest = "tests/integration/remoteok-budget.integration.test.ts";

export type HostedRunnerConfig = {
  childEnvironment: NodeJS.ProcessEnv;
  redactions: string[];
};

function extractAssignmentKeys(contents: string): string[] | null {
  const keys: string[] = [];
  for (const line of contents.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/u.exec(line);
    if (!match?.[1]) return null;
    keys.push(match[1]);
  }
  return keys;
}

export function buildHostedRunnerConfig(
  testEnvironmentFile: string,
  trustedApplicationSupabaseUrl: string | undefined,
  runtimeEnvironment: Record<string, string | undefined> = {},
): HostedRunnerConfig | null {
  if (typeof parseEnv !== "function") return null;

  let parsedFile: Record<string, string | undefined>;
  let keys: string[];
  try {
    keys = extractAssignmentKeys(testEnvironmentFile) ?? [];
    parsedFile = parseEnv(testEnvironmentFile);
  } catch {
    return null;
  }

  const allowed = new Set<string>(hostedTestVariables);
  const parsedKeys = Object.keys(parsedFile);
  if (keys.length !== parsedKeys.length
    || new Set(keys).size !== keys.length
    || parsedKeys.some((key) => !allowed.has(key))
    || keys.some((key) => !allowed.has(key))
    || hostedTestVariables.some((key) => !Object.hasOwn(parsedFile, key))) {
    return null;
  }

  const fileVariables: Record<string, string> = {};
  for (const key of hostedTestVariables) {
    const value = parsedFile[key];
    if (value === undefined) return null;
    fileVariables[key] = value;
  }

  if (fileVariables.REMOTEOK_BUDGET_SUPABASE_TEST_PROJECT_REF !== approvedSupabaseRemoteOkBudgetTestProjectRef
    || fileVariables.REMOTEOK_BUDGET_SUPABASE_TEST_ENDPOINT !== approvedSupabaseRemoteOkBudgetTestEndpoint
    || fileVariables.REMOTEOK_BUDGET_SUPABASE_TEST_POSTGRES_MAJOR_VERSION !== approvedSupabaseRemoteOkBudgetTestPostgresMajorVersion) {
    return null;
  }

  const validated = parseSupabaseRemoteOkBudgetTestConfig({
    optIn: fileVariables.RUN_REMOTEOK_BUDGET_SUPABASE_TESTS,
    databaseUrl: fileVariables.REMOTEOK_BUDGET_SUPABASE_TEST_DATABASE_URL,
    allowedProjectRef: fileVariables.REMOTEOK_BUDGET_SUPABASE_TEST_PROJECT_REF,
    allowedEndpoint: fileVariables.REMOTEOK_BUDGET_SUPABASE_TEST_ENDPOINT,
    marker: fileVariables.REMOTEOK_BUDGET_SUPABASE_TEST_MARKER,
    postgresMajorVersion: fileVariables.REMOTEOK_BUDGET_SUPABASE_TEST_POSTGRES_MAJOR_VERSION,
    applicationSupabaseUrl: trustedApplicationSupabaseUrl,
  });
  if (!validated || !trustedApplicationSupabaseUrl) return null;

  const childEnvironment: NodeJS.ProcessEnv = { NODE_ENV: "test" };
  for (const key of ["PATH", "TMPDIR", "TMP", "TEMP"] as const) {
    const value = runtimeEnvironment[key];
    if (value) childEnvironment[key] = value;
  }
  childEnvironment.NEXT_PUBLIC_SUPABASE_URL = trustedApplicationSupabaseUrl;
  for (const key of hostedTestVariables) childEnvironment[key] = fileVariables[key]!;

  const databaseUrl = fileVariables.REMOTEOK_BUDGET_SUPABASE_TEST_DATABASE_URL!;
  let urlPassword = "";
  try {
    urlPassword = decodeURIComponent(new URL(databaseUrl).password);
  } catch {
    return null;
  }

  return {
    childEnvironment,
    redactions: [databaseUrl, urlPassword, encodeURIComponent(urlPassword), fileVariables.REMOTEOK_BUDGET_SUPABASE_TEST_MARKER!]
      .filter((value) => value.length > 0),
  };
}

export function redactSensitiveOutput(output: string, values: string[]): string {
  return values.reduce((redacted, value) => redacted.split(value).join("[redacted]"), output);
}

function isolateRunnerEnvironment(): Record<string, string | undefined> {
  const minimalRuntime: Record<string, string | undefined> = {};
  for (const key of ["PATH", "TMPDIR", "TMP", "TEMP"] as const) {
    minimalRuntime[key] = process.env[key];
  }
  for (const key of Object.keys(process.env)) delete process.env[key];
  for (const [key, value] of Object.entries(minimalRuntime)) {
    if (value) Reflect.set(process.env, key, value);
  }
  Reflect.set(process.env, "NODE_ENV", "development");
  return minimalRuntime;
}

async function run(): Promise<void> {
  const projectRoot = process.cwd();
  const runtimeEnvironment = isolateRunnerEnvironment();

  let trustedApplicationSupabaseUrl: string | undefined;
  try {
    const require = createRequire(import.meta.url);
    const nextEnv = require("@next/env") as { loadEnvConfig: (directory: string, dev: boolean) => unknown };
    nextEnv.loadEnvConfig(projectRoot, true);
    trustedApplicationSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  } catch {
    throw new Error("Could not load the trusted application environment configuration.");
  }

  let testEnvironmentFile: string;
  try {
    testEnvironmentFile = await readFile(resolve(projectRoot, ".env.remoteok-test.local"), "utf8");
  } catch {
    throw new Error("The ignored Remote OK test environment file is missing or unreadable.");
  }

  const config = buildHostedRunnerConfig(testEnvironmentFile, trustedApplicationSupabaseUrl, runtimeEnvironment);
  if (!config) {
    throw new Error("Hosted Remote OK test configuration is invalid; no test process was started.");
  }

  const vitestEntry = resolve(projectRoot, "node_modules/vitest/vitest.mjs");
  const result = spawnSync(process.execPath, [vitestEntry, "run", hostedIntegrationTest], {
    cwd: projectRoot,
    env: config.childEnvironment,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const stderr = typeof result.stderr === "string" ? result.stderr : "";
  if (stdout) process.stdout.write(redactSensitiveOutput(stdout, config.redactions));
  if (stderr) process.stderr.write(redactSensitiveOutput(stderr, config.redactions));
  if (result.error) throw new Error("Could not start the hosted Remote OK integration test process.");
  process.exitCode = result.status ?? 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch(() => {
    process.stderr.write("Hosted Remote OK runner stopped before test completion; sensitive configuration was not displayed.\n");
    process.exitCode = 1;
  });
}
