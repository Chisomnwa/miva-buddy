import { spawnSync } from "node:child_process";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const childEnv = { PATH: process.env.PATH ?? "" };
for (const name of [
  "CI", "NODE_ENV", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "GEMINI_API_KEY", "GEMINI_MODEL", "GROQ_API_KEY", "GROQ_MODEL", "AI_PROVIDER",
]) {
  if (process.env[name] !== undefined) childEnv[name] = process.env[name];
}

const result = spawnSync(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", "--config", "vitest.ai-eval.config.ts", ...process.argv.slice(2)],
  { stdio: "inherit", env: childEnv },
);

process.exit(result.status ?? 1);
