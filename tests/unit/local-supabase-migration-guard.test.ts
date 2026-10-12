import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createDrizzleEnvironment,
  expectedMigrationTags,
  formatLocalMigrationFailure,
  LocalMigrationSafetyError,
  parseLocalDockerPsOutput,
  parseLocalSupabaseConfig,
  validateDrizzleMigrationChain,
  validateLocalDockerContextHost,
  validateLocalDockerIdentity,
  validateLocalSupabaseStatus,
} from "../../scripts/local-supabase-migration-guard.mjs";

const localConfig = { projectId: "miva-buddy", databasePort: 54322 };
function makeDatabaseUrl(host: string, port: number, database = "postgres"): string {
  const url = new URL(["post", "gresql", "://", "localhost"].join(""));
  url.username = "postgres";
  url.password = "synthetic-local-password";
  url.hostname = host;
  url.port = String(port);
  url.pathname = `/${database}`;
  return url.toString();
}

const localStatus = {
  id: "miva-buddy",
  endpoints: {
    "database.sql": {
      protocol: "postgresql:",
      address: "127.0.0.1",
      port: 54322,
      url: makeDatabaseUrl("127.0.0.1", 54322),
    },
  },
};
const supabaseCli2120Status = {
  DB_URL: localStatus.endpoints["database.sql"].url,
  REST_URL: "http://127.0.0.1:54321",
  publishable_key: "synthetic-publishable-placeholder",
  secret_key: "synthetic-secret-placeholder",
  linked_project_ref: null,
};
const localDatabaseContainer = {
  State: "running",
  Ports: "127.0.0.1:54322->5432/tcp",
  Labels: {
    "com.supabase.cli.project": "miva-buddy",
    "com.supabase.service": "database",
    "com.docker.compose.project": "supabase-miva-buddy-teststack",
    "com.docker.compose.service": "db",
  },
};
const observedCli2120DatabaseContainer = {
  Names: "supabase_db_miva-buddy",
  State: "running",
  Ports: "0.0.0.0:54322->5432/tcp",
  Labels: "com.supabase.cli.project=miva-buddy,com.docker.compose.project=miva-buddy",
};
function statusWithoutId() {
  const status = structuredClone(localStatus);
  Reflect.deleteProperty(status, "id");
  return status;
}
const journal = {
  dialect: "postgresql",
  version: "7",
  entries: expectedMigrationTags.map((tag, idx) => ({ idx, tag, version: "7" })),
};
const migrationFiles = expectedMigrationTags.map((tag) => `${tag}.sql`);

describe("local Supabase migration safety guard", () => {
  it("reads the local project ID and database port from Supabase config", () => {
    expect(parseLocalSupabaseConfig(`project_id = "miva-buddy"\n\n[db]\nport = 54322\n`)).toEqual(localConfig);
  });

  it("rejects missing or ambiguous project and database configuration", () => {
    expect(() => parseLocalSupabaseConfig("[db]\nport = 54322\n")).toThrow();
    expect(() => parseLocalSupabaseConfig("project_id = \"one\"\nproject_id = \"two\"\n[db]\nport = 54322\n")).toThrow();
    expect(() => parseLocalSupabaseConfig("project_id = \"miva-buddy\"\n[db]\nport = 70000\n")).toThrow();
  });

  it("accepts the matching local stack endpoint and returns its validated URL", () => {
    expect(validateLocalSupabaseStatus(localStatus, localConfig)).toBe(localStatus.endpoints["database.sql"].url);
  });

  it("accepts the Supabase CLI 2.120.0 status shape only when Docker confirms this project", () => {
    const databaseUrl = validateLocalSupabaseStatus(supabaseCli2120Status, localConfig);

    expect(databaseUrl).toBe(supabaseCli2120Status.DB_URL);
    expect(validateLocalDockerIdentity([localDatabaseContainer], localConfig, databaseUrl)).toBe(true);
  });

  it("does not treat linked_project_ref=null as project identity proof", () => {
    const databaseUrl = validateLocalSupabaseStatus(supabaseCli2120Status, localConfig);

    expect(() => validateLocalDockerIdentity([], localConfig, databaseUrl)).toThrow(/unambiguous Supabase container/);
  });

  it("rejects a linked online project even when its database URL is loopback", () => {
    expect(() => validateLocalSupabaseStatus({
      ...supabaseCli2120Status,
      linked_project_ref: "hosted-project-reference",
    }, localConfig)).toThrow(/linked project/);
  });

  it.each(["project_id", "projectId"])("accepts the exact project identity from the %s CLI field", (identityField) => {
    expect(validateLocalSupabaseStatus({ ...statusWithoutId(), [identityField]: localConfig.projectId }, localConfig))
      .toBe(localStatus.endpoints["database.sql"].url);
  });

  it("allows an absent CLI identity but rejects malformed or conflicting supplied identities", () => {
    const statusWithoutProjectId = statusWithoutId();
    expect(validateLocalSupabaseStatus(statusWithoutProjectId, localConfig))
      .toBe(localStatus.endpoints["database.sql"].url);
    expect(() => validateLocalSupabaseStatus({ ...statusWithoutProjectId, project_id: 42 }, localConfig)).toThrow(/project identity/);
    expect(() => validateLocalSupabaseStatus({ ...localStatus, project_id: "another-project" }, localConfig))
      .toThrow(/project identity/);
  });

  it("accepts only a local Docker daemon context", () => {
    expect(validateLocalDockerContextHost(JSON.stringify("unix:///Users/test/.docker/run/docker.sock"))).toBe(true);
    expect(() => validateLocalDockerContextHost(JSON.stringify("tcp://remote.example:2376"))).toThrow(/Unix-socket/);
    expect(() => validateLocalDockerContextHost(JSON.stringify("ssh://remote.example"))).toThrow(/Unix-socket/);
    expect(() => validateLocalDockerContextHost(JSON.stringify("unix://remote.example/socket"))).toThrow(/Unix-socket/);
  });

  it("matches the configured database port to exactly one running Supabase database container", () => {
    expect(validateLocalDockerIdentity([localDatabaseContainer], localConfig, localStatus.endpoints["database.sql"].url))
      .toBe(true);
    expect(() => validateLocalDockerIdentity([
      localDatabaseContainer,
      { ...localDatabaseContainer, Labels: { ...localDatabaseContainer.Labels, "com.supabase.cli.project": "another-project" } },
    ], localConfig, localStatus.endpoints["database.sql"].url)).toThrow(/unambiguous Supabase container/);
  });

  it("accepts the observed Supabase CLI 2.120.0 database container when service labels are absent", () => {
    const databaseUrl = validateLocalSupabaseStatus(supabaseCli2120Status, localConfig);
    const containers = parseLocalDockerPsOutput(`${JSON.stringify(observedCli2120DatabaseContainer)}\n`);

    expect(validateLocalDockerIdentity(containers, localConfig, databaseUrl)).toBe(true);
  });

  it("rejects missing service labels when the database container name does not match the project", () => {
    const container = {
      ...observedCli2120DatabaseContainer,
      Names: "supabase_db_another-project",
    };

    expect(() => validateLocalDockerIdentity([container], localConfig, localStatus.endpoints["database.sql"].url))
      .toThrow(/unambiguous Supabase container/);
  });

  it("rejects conflicting service labels even when the expected database name matches", () => {
    const container = {
      ...observedCli2120DatabaseContainer,
      Labels: `${observedCli2120DatabaseContainer.Labels},com.docker.compose.service=web`,
    };

    expect(() => validateLocalDockerIdentity([container], localConfig, localStatus.endpoints["database.sql"].url))
      .toThrow(/unambiguous Supabase container/);
  });

  it.each([
    ["a different project label", { ...localDatabaseContainer, Labels: { ...localDatabaseContainer.Labels, "com.supabase.cli.project": "another-project" } }],
    ["a non-database service", { ...localDatabaseContainer, Labels: { ...localDatabaseContainer.Labels, "com.docker.compose.service": "web" } }],
    ["a conflicting compose project label", { ...localDatabaseContainer, Labels: { ...localDatabaseContainer.Labels, "com.docker.compose.project": "supabase-other-teststack" } }],
    ["a stopped database container", { ...localDatabaseContainer, State: "exited" }],
    ["a different published port", { ...localDatabaseContainer, Ports: "127.0.0.1:5432->5432/tcp" }],
  ])("rejects %s", (_description, container) => {
    expect(() => validateLocalDockerIdentity([container], localConfig, localStatus.endpoints["database.sql"].url))
      .toThrow(/unambiguous Supabase container/);
  });

  it("parses Docker ps JSON lines without inspecting container environments", () => {
    const rows = parseLocalDockerPsOutput(`${JSON.stringify(localDatabaseContainer)}\n`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ State: "running", Ports: localDatabaseContainer.Ports });
    expect(() => parseLocalDockerPsOutput("not-json")).toThrow(/malformed/);
  });

  it("maps status validation failures to complete safe messages", () => {
    expect(formatLocalMigrationFailure(new LocalMigrationSafetyError("project-identity"), "status"))
      .toBe("the local Supabase project identity did not match supabase/config.toml.");
    expect(formatLocalMigrationFailure(new LocalMigrationSafetyError("endpoint-unsafe"), "status"))
      .toBe("the local database endpoint failed its loopback safety checks.");
  });

  it("never includes an unexpected exception message in the user-facing diagnostic", () => {
    const syntheticConnectionText = [
      "Supabase status ", "post", "gresql", "://", "user", ":", "synthetic", "@", "remote", ".example/db?marker=", "fixture",
    ].join("");
    const secretBearingError = new Error(syntheticConnectionText);
    const message = formatLocalMigrationFailure(secretBearingError, "status");

    expect(message).toBe("the local Supabase status command did not return a successful result.");
    expect(message).not.toContain("password");
    expect(message).not.toContain("remote.example");
    expect(message).not.toContain("secret");
  });

  it.each([
    ["a different project", { ...localStatus, id: "website-project" }],
    ["a public database host", { ...localStatus, endpoints: { ...localStatus.endpoints, "database.sql": { ...localStatus.endpoints["database.sql"], address: "db.example.supabase.co", url: makeDatabaseUrl("db.example.supabase.co", 54322) } } }],
    ["a loopback URL on the wrong port", { ...localStatus, endpoints: { ...localStatus.endpoints, "database.sql": { ...localStatus.endpoints["database.sql"], url: makeDatabaseUrl("127.0.0.1", 5432) } } }],
    ["a mismatched endpoint port", { ...localStatus, endpoints: { ...localStatus.endpoints, "database.sql": { ...localStatus.endpoints["database.sql"], port: 5432 } } }],
    ["a non-default database", { ...localStatus, endpoints: { ...localStatus.endpoints, "database.sql": { ...localStatus.endpoints["database.sql"], url: makeDatabaseUrl("127.0.0.1", 54322, "other") } } }],
    ["an endpoint query string", { ...localStatus, endpoints: { ...localStatus.endpoints, "database.sql": { ...localStatus.endpoints["database.sql"], url: `${localStatus.endpoints["database.sql"].url}?host=db.example.supabase.co` } } }],
  ])("rejects %s", (_description, status) => {
    expect(() => validateLocalSupabaseStatus(status, localConfig)).toThrow();
  });

  it("keeps the verified URL in the child environment and excludes inherited database overrides", () => {
    const environment = createDrizzleEnvironment({
      PATH: "/usr/bin",
      HOME: "/tmp/home",
      DATABASE_URL: makeDatabaseUrl("remote-example.invalid", 54322),
      NODE_OPTIONS: "--require=unexpected",
      NEXT_PUBLIC_SUPABASE_URL: "https://remote-example.supabase.co",
    }, localStatus.endpoints["database.sql"].url);

    expect(environment).toEqual({
      PATH: "/usr/bin",
      HOME: "/tmp/home",
      NODE_ENV: "development",
      DATABASE_URL: localStatus.endpoints["database.sql"].url,
    });
  });

  it("accepts the exact Drizzle migration chain in journal order", () => {
    expect(validateDrizzleMigrationChain(journal, migrationFiles)).toEqual(expectedMigrationTags);
  });

  it("validates this repository's current Supabase config and migrations", () => {
    const repositoryRoot = new URL("../../", import.meta.url);
    const actualConfig = parseLocalSupabaseConfig(
      readFileSync(new URL("supabase/config.toml", repositoryRoot), "utf8"),
    );
    const actualJournal = JSON.parse(readFileSync(new URL("drizzle/meta/_journal.json", repositoryRoot), "utf8"));
    const actualFiles = readdirSync(new URL("drizzle/", repositoryRoot)).filter((filename) => filename.endsWith(".sql"));

    expect(actualConfig).toEqual(localConfig);
    expect(validateDrizzleMigrationChain(actualJournal, actualFiles)).toEqual(expectedMigrationTags);
  });

  it("routes both migration npm scripts through the local safety wrapper", () => {
    const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    const guardedCommand = "node scripts/migrate-local-supabase.mjs";

    expect(packageJson.scripts["db:migrate"]).toBe(guardedCommand);
    expect(packageJson.scripts["db:migrate:local"]).toBe(guardedCommand);
  });

  it("rejects reordered, missing, unexpected, or mismatched migrations", () => {
    const reordered = { ...journal, entries: [...journal.entries].reverse() };
    expect(() => validateDrizzleMigrationChain(reordered, migrationFiles)).toThrow();
    expect(() => validateDrizzleMigrationChain({ ...journal, entries: journal.entries.slice(0, -1) }, migrationFiles)).toThrow();
    expect(() => validateDrizzleMigrationChain(journal, [...migrationFiles, "0011_unreviewed.sql"])).toThrow();
    expect(() => validateDrizzleMigrationChain(journal, migrationFiles.slice(1))).toThrow();
  });
});
