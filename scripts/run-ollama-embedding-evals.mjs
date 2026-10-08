import { spawnSync } from "node:child_process";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

if (process.env.EMBEDDING_PROVIDER !== "ollama") {
  console.error("Set EMBEDDING_PROVIDER=ollama in the local environment before running this check.");
  process.exit(1);
}

process.env.RUN_OLLAMA_EMBEDDING_TESTS = "1";
const childEnv = { PATH: process.env.PATH ?? "", RUN_OLLAMA_EMBEDDING_TESTS: "1" };
for (const name of ["OLLAMA_BASE_URL", "OLLAMA_EMBEDDING_MODEL"]) {
  if (process.env[name] !== undefined) childEnv[name] = process.env[name];
}
const result = spawnSync(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", "tests/integration/ollama-embedding.integration.test.ts"],
  { stdio: "inherit", env: childEnv },
);

process.exit(result.status ?? 1);
