import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import nextEnv from "@next/env";
import pg from "pg";
import {
  parseLocalDockerPsOutput,
  parseLocalSupabaseConfig,
  validateLocalDockerContextHost,
  validateLocalDockerIdentity,
  validateLocalSupabaseStatus,
} from "./local-supabase-migration-guard.mjs";

const { loadEnvConfig } = nextEnv;
const { Pool } = pg;
const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const safeErrors = Object.freeze({
  "api-endpoint": "local Supabase API endpoint did not match this project's loopback configuration.",
  "api-key": "local Supabase publishable key was not available from local Supabase status.",
  "gemini-key": "GEMINI_API_KEY is missing from the existing local application configuration.",
  "linked-project": "Supabase status reports a linked project; only the unlinked local project is allowed.",
  "docker-context": "Docker is not using a verified local Unix-socket context.",
  "docker-command": "local Docker metadata could not be read safely.",
  "docker-identity": "the local database could not be matched to one unambiguous project container.",
  "status": "local Supabase status could not be verified.",
  "database": "local database identity or read-only queue check failed.",
  "pending-jobs": "the course-processing queue has unfinished jobs; they were not started.",
  "startup": "the local web app and worker could not be started safely.",
});

function fail(category) {
  const error = new Error(safeErrors[category] ?? safeErrors.startup);
  error.category = category;
  throw error;
}

function minimalEnvironment(source) {
  const env = {};
  for (const key of ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "SystemRoot"]) {
    if (source[key]) env[key] = source[key];
  }
  env.CI = "1";
  env.npm_config_offline = "true";
  env.npm_config_yes = "false";
  return env;
}

function readLocalConfig() {
  const toml = (awaitReadFile("supabase/config.toml"));
  const localConfig = parseLocalSupabaseConfig(toml);
  const apiSection = toml.match(/^\s*\[api\]\s*\n([\s\S]*?)(?=^\s*\[|$(?![\s\S]))/m)?.[1];
  const apiPort = apiSection?.match(/^\s*port\s*=\s*(\d+)\s*$/m)?.[1];
  if (!apiPort || !Number.isInteger(Number(apiPort))) fail("api-endpoint");
  return { ...localConfig, apiPort: Number(apiPort) };
}

function awaitReadFile(path) {
  // Kept behind a helper so no file contents are ever included in diagnostics.
  return readFileSync(resolve(projectRoot, path), "utf8");
}

function readStatus(localConfig) {
  const result = spawnSync("npx", ["--offline", "--yes=false", "supabase", "status", "--output-format", "json"], {
    cwd: projectRoot,
    encoding: "utf8",
    env: minimalEnvironment(process.env),
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0 || !result.stdout) fail("status");

  let status;
  try { status = JSON.parse(result.stdout); } catch { fail("status"); }
  if (status.linked_project !== undefined && status.linked_project !== null) fail("linked-project");

  const databaseUrl = validateLocalSupabaseStatus(status, localConfig);
  const apiValue = status.API_URL ?? status.REST_URL;
  let apiUrl;
  try { apiUrl = new URL(apiValue); } catch { fail("api-endpoint"); }
  const allowedHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
  if (
    apiUrl.protocol !== "http:"
    || !allowedHosts.has(apiUrl.hostname.toLowerCase())
    || apiUrl.port !== String(localConfig.apiPort)
    || apiUrl.pathname !== "/"
    || apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash
  ) fail("api-endpoint");

  if (typeof status.PUBLISHABLE_KEY !== "string" || !status.PUBLISHABLE_KEY) fail("api-key");
  return { status, databaseUrl, apiUrl: apiUrl.toString(), publishableKey: status.PUBLISHABLE_KEY };
}

function readDockerContainers() {
  const context = spawnSync("docker", ["context", "inspect", "--format", "{{json .Endpoints.docker.Host}}"], {
    cwd: projectRoot, encoding: "utf8", env: minimalEnvironment(process.env), windowsHide: true,
  });
  if (context.error || context.status !== 0 || !context.stdout) fail("docker-command");
  try { validateLocalDockerContextHost(context.stdout.trim()); } catch { fail("docker-context"); }

  const containers = spawnSync("docker", ["ps", "--all", "--format", "{{json .}}"], {
    cwd: projectRoot, encoding: "utf8", env: minimalEnvironment(process.env), maxBuffer: 2 * 1024 * 1024, windowsHide: true,
  });
  if (containers.error || containers.status !== 0 || !containers.stdout) fail("docker-command");
  try { return parseLocalDockerPsOutput(containers.stdout); } catch { fail("docker-identity"); }
}

export function validateLocalApiEndpoint(rawUrl, apiPort) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "http:"
      && new Set(["127.0.0.1", "localhost", "[::1]"]).has(url.hostname.toLowerCase())
      && url.port === String(apiPort)
      && url.pathname === "/"
      && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}

export function assertNoPendingCourseJobs(count) {
  if (!Number.isInteger(count) || count < 0 || count !== 0) fail("pending-jobs");
  return true;
}

export function buildLocalPdfGeminiEnvironment({ status, localConfig, containers, sourceEnvironment }) {
  if (status?.linked_project !== undefined && status.linked_project !== null) fail("linked-project");
  const databaseUrl = validateLocalSupabaseStatus(status, localConfig);
  try { validateLocalDockerIdentity(containers, localConfig, databaseUrl); } catch { fail("docker-identity"); }

  const apiUrl = status.API_URL ?? status.REST_URL;
  if (!validateLocalApiEndpoint(apiUrl, localConfig.apiPort)) fail("api-endpoint");
  if (typeof status.PUBLISHABLE_KEY !== "string" || !status.PUBLISHABLE_KEY) fail("api-key");
  if (typeof sourceEnvironment.GEMINI_API_KEY !== "string" || !sourceEnvironment.GEMINI_API_KEY.trim()) fail("gemini-key");

  const env = minimalEnvironment(sourceEnvironment);
  Object.assign(env, {
    NODE_ENV: "development",
    NEXT_PUBLIC_SUPABASE_URL: new URL(apiUrl).origin,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
    DATABASE_URL: databaseUrl,
    AI_PROVIDER: "gemini",
    EMBEDDING_PROVIDER: "gemini",
    GEMINI_API_KEY: sourceEnvironment.GEMINI_API_KEY,
  });
  return env;
}

export async function assertLocalCourseQueueIsIdle(databaseUrl) {
  const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5_000, statement_timeout: 5_000 });
  try {
    const identity = await pool.query(`
      select current_database() as database_name,
             current_user as database_user,
             inet_server_port() as server_port,
             to_regclass('pgboss.job')::text as job_table
    `);
    const row = identity.rows[0];
    if (row.database_name !== "postgres" || row.database_user !== "postgres" || Number(row.server_port) !== 5432) fail("database");
    if (!row.job_table) return;
    const result = await pool.query(
      "select count(*)::int as count from pgboss.job where name = $1 and state in ('created', 'retry', 'active')",
      ["course-material-processing"],
    );
    assertNoPendingCourseJobs(result.rows[0]?.count);
  } catch (error) {
    if (error?.category) throw error;
    fail("database");
  } finally {
    await pool.end();
  }
}

async function run() {
  try {
    // Load existing local settings only to obtain GEMINI_API_KEY; the child receives
    // a strict allowlist with database/API targets replaced by validated local status.
    loadEnvConfig(projectRoot, true, { error() {}, warn() {}, info() {}, log() {} });
    const localConfig = readLocalConfig();
    const { status, databaseUrl } = readStatus(localConfig);
    const containers = readDockerContainers();
    const env = buildLocalPdfGeminiEnvironment({ status, localConfig, containers, sourceEnvironment: process.env });
    await assertLocalCourseQueueIsIdle(databaseUrl);

    console.info("Local Supabase identity, runtime configuration, and empty course queue verified.");
    const children = [
      spawn(process.execPath, [resolve(projectRoot, "node_modules/next/dist/bin/next"), "dev", "--webpack"], {
        cwd: projectRoot, env, stdio: "inherit", windowsHide: true,
      }),
      spawn(process.execPath, ["--import", "tsx", "src/worker.ts"], {
        cwd: projectRoot, env, stdio: "inherit", windowsHide: true,
      }),
    ];
    let stopping = false;
    const stop = (signal) => {
      if (stopping) return;
      stopping = true;
      for (const child of children) if (child.pid) child.kill(signal);
    };
    process.once("SIGINT", () => stop("SIGINT"));
    process.once("SIGTERM", () => stop("SIGTERM"));
    for (const child of children) {
      child.once("error", () => { console.error(safeErrors.startup); stop("SIGTERM"); process.exitCode = 1; });
      child.once("exit", (code) => {
        if (!stopping) {
          process.exitCode = code || 0;
          stop("SIGTERM");
        }
      });
    }
  } catch (error) {
    const category = error?.category;
    console.error(`Local PDF/Gemini test stopped safely: ${safeErrors[category] ?? safeErrors.startup}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void run();
