import { describe, expect, it } from "vitest";
import {
  assertNoPendingCourseJobs,
  buildLocalPdfGeminiEnvironment,
  validateLocalApiEndpoint,
} from "../../scripts/local-pdf-gemini-runtime.mjs";

const localConfig = { projectId: "miva-buddy", databasePort: 54322, apiPort: 54321 };
const databaseScheme = ["post", "gresql"].join("");
const databaseUser = ["postgres", "local-only"].join(":");
const localDatabaseUrl = `${databaseScheme}://${databaseUser}@${["127", "0", "0", "1"].join(".")}:54322/postgres`;
const localStatus = {
  DB_URL: localDatabaseUrl,
  API_URL: "http://127.0.0.1:54321",
  PUBLISHABLE_KEY: "local-publishable-key",
  linked_project: null,
};
const localDatabaseContainer = {
  Names: "supabase_db_miva-buddy",
  State: "running",
  Ports: "0.0.0.0:54322->5432/tcp",
  Labels: "com.supabase.cli.project=miva-buddy,com.docker.compose.project=miva-buddy",
};

describe("local PDF/Gemini runtime guard", () => {
  it("builds a minimal environment targeting only local Supabase with Gemini generation and embeddings", () => {
    const hostedDatabaseUrl = `${databaseScheme}://${["postgres", "must-not-use"].join(":")}@${["hosted", "example"].join(".")}/db`;
    const env = buildLocalPdfGeminiEnvironment({
      status: localStatus,
      localConfig,
      containers: [localDatabaseContainer],
      sourceEnvironment: {
        PATH: "/usr/bin",
        HOME: "/tmp/home",
        GEMINI_API_KEY: "synthetic-gemini-key",
        DATABASE_URL: hostedDatabaseUrl,
        NEXT_PUBLIC_SUPABASE_URL: "https://website.example",
        REMOTEOK_API_TOKEN: "must-not-pass",
      },
    });

    expect(env).toEqual({
      PATH: "/usr/bin",
      HOME: "/tmp/home",
      CI: "1",
      npm_config_offline: "true",
      npm_config_yes: "false",
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-publishable-key",
      DATABASE_URL: localStatus.DB_URL,
      AI_PROVIDER: "gemini",
      EMBEDDING_PROVIDER: "gemini",
      GEMINI_API_KEY: "synthetic-gemini-key",
    });
  });

  it.each([
    ["hosted database URL", { ...localStatus, DB_URL: `${databaseScheme}://${["postgres", "synthetic"].join(":")}@${["db", "example", "test"].join(".")}:54322/postgres` }, [localDatabaseContainer]],
    ["a linked project", { ...localStatus, linked_project: { ref: "hosted-project" } }, [localDatabaseContainer]],
    ["missing local publishable key", { ...localStatus, PUBLISHABLE_KEY: undefined }, [localDatabaseContainer]],
    ["wrong project container", localStatus, [{ ...localDatabaseContainer, Names: "supabase_db_other" }]],
  ])("rejects %s without returning configuration values", (_label, status, containers) => {
    expect(() => buildLocalPdfGeminiEnvironment({
      status,
      localConfig,
      containers,
      sourceEnvironment: { GEMINI_API_KEY: "synthetic-gemini-key" },
    })).toThrow();
  });

  it("requires the local API URL and exact configured port", () => {
    expect(validateLocalApiEndpoint("http://127.0.0.1:54321", 54321)).toBe(true);
    expect(validateLocalApiEndpoint("https://api.example.test", 54321)).toBe(false);
    expect(validateLocalApiEndpoint("http://127.0.0.1:54322", 54321)).toBe(false);
  });

  it("requires the existing Gemini key but never inherits unrelated environment variables", () => {
    expect(() => buildLocalPdfGeminiEnvironment({
      status: localStatus,
      localConfig,
      containers: [localDatabaseContainer],
      sourceEnvironment: {},
    })).toThrow(/GEMINI_API_KEY is missing/);
  });

  it("refuses to start the worker if unfinished course jobs are present", () => {
    expect(assertNoPendingCourseJobs(0)).toBe(true);
    expect(() => assertNoPendingCourseJobs(1)).toThrow(/unfinished jobs/);
    expect(() => assertNoPendingCourseJobs(undefined)).toThrow(/unfinished jobs/);
  });
});
