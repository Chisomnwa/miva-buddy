import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDrizzleEnvironment,
  formatLocalMigrationFailure,
  LocalMigrationSafetyError,
  parseLocalDockerPsOutput,
  parseLocalSupabaseConfig,
  validateDrizzleMigrationChain,
  validateLocalDockerContextHost,
  validateLocalDockerIdentity,
  validateLocalSupabaseStatus,
} from "./local-supabase-migration-guard.mjs";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function minimalCliEnvironment(parentEnvironment) {
  const environment = {};
  for (const key of ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "SystemRoot"]) {
    if (parentEnvironment[key]) environment[key] = parentEnvironment[key];
  }
  environment.CI = "1";
  environment.npm_config_offline = "true";
  environment.npm_config_yes = "false";
  return environment;
}

function readAndValidateMigrationInputs() {
  const configPath = resolve(projectRoot, "supabase/config.toml");
  const journalPath = resolve(projectRoot, "drizzle/meta/_journal.json");
  const migrationsPath = resolve(projectRoot, "drizzle");

  const localConfig = parseLocalSupabaseConfig(readFileSync(configPath, "utf8"));
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  const sqlFiles = readdirSync(migrationsPath).filter((filename) => filename.endsWith(".sql"));
  validateDrizzleMigrationChain(journal, sqlFiles);
  return localConfig;
}

function getLocalDatabaseUrl(localConfig) {
  const result = spawnSync(
    "npx",
    ["--offline", "--yes=false", "supabase", "status", "--output-format", "json"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: minimalCliEnvironment(process.env),
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    },
  );

  if (result.error || result.status !== 0 || !result.stdout) {
    throw new LocalMigrationSafetyError(result.error ? "status-command-start" : "status-command-failed");
  }

  let status;
  try {
    status = JSON.parse(result.stdout);
  } catch {
    throw new LocalMigrationSafetyError("status-json");
  }

  return validateLocalSupabaseStatus(status, localConfig);
}

function getLocalDockerContainers() {
  const contextResult = spawnSync(
    "docker",
    ["context", "inspect", "--format", "{{json .Endpoints.docker.Host}}"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: minimalCliEnvironment(process.env),
      maxBuffer: 256 * 1024,
      windowsHide: true,
    },
  );

  if (contextResult.error || contextResult.status !== 0 || !contextResult.stdout) {
    throw new LocalMigrationSafetyError("docker-command");
  }
  validateLocalDockerContextHost(contextResult.stdout.trim());

  const containersResult = spawnSync(
    "docker",
    ["ps", "--all", "--format", "{{json .}}"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: minimalCliEnvironment(process.env),
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    },
  );

  if (containersResult.error || containersResult.status !== 0 || !containersResult.stdout) {
    throw new LocalMigrationSafetyError("docker-command");
  }
  return parseLocalDockerPsOutput(containersResult.stdout);
}

function run() {
  let stage = "configuration";
  try {
    const localConfig = readAndValidateMigrationInputs();
    stage = "status";
    const databaseUrl = getLocalDatabaseUrl(localConfig);
    stage = "docker";
    const containers = getLocalDockerContainers();
    validateLocalDockerIdentity(containers, localConfig, databaseUrl);
    const drizzleBin = resolve(projectRoot, "node_modules/drizzle-kit/bin.cjs");
    if (!existsSync(drizzleBin)) {
      throw new LocalMigrationSafetyError("drizzle-missing");
    }

    stage = "migration";
    const result = spawnSync(process.execPath, [drizzleBin, "migrate"], {
      cwd: projectRoot,
      env: createDrizzleEnvironment(process.env, databaseUrl),
      stdio: "inherit",
      windowsHide: true,
    });

    if (result.error || result.status === null) {
      throw new LocalMigrationSafetyError("migration-start");
    }
    process.exitCode = result.status ?? 1;
  } catch (error) {
    const message = formatLocalMigrationFailure(error, stage);
    console.error(`Local-only migration stopped safely: ${message}`);
    process.exitCode = 1;
  }
}

run();
