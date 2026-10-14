import { isIP } from "node:net";

export const expectedMigrationTags = Object.freeze([
  "0000_profiles",
  "0001_learn_conversations",
  "0002_courses_and_materials",
  "0003_pasted_notes_sources",
  "0004_expand_material_page_text",
  "0005_grounded_learn",
  "0006_practice_sessions",
  "0007_practice_coaching",
  "0008_expand_practice_topics",
  "0009_remoteok_request_budget",
  "0010_embedding_model_retrieval_filter",
  "0011_require_permanent_auth",
  "0012_gemini_usage_reservations",
  "0013_course_material_admission_limits",
]);

const loopbackNames = new Set(["localhost", "127.0.0.1", "::1"]);
const identityKeys = ["id", "project_id", "projectId"];

const safeFailureMessages = Object.freeze({
  "configuration": "repository migration configuration could not be verified.",
  "status-command-start": "the local Supabase status command could not be started.",
  "status-command-failed": "the local Supabase status command did not return a successful result.",
  "status-json": "the local Supabase status response was not valid JSON.",
  "project-identity": "the local Supabase project identity did not match supabase/config.toml.",
  "linked-project": "Supabase status indicates a linked project; only an unlinked local project is allowed.",
  "endpoint-missing": "the local database endpoint was missing from Supabase status.",
  "endpoint-malformed": "the local database endpoint in Supabase status was malformed.",
  "endpoint-unsafe": "the local database endpoint failed its loopback safety checks.",
  "docker-context": "Docker is not using a verified local Unix-socket context.",
  "docker-command": "local Docker metadata could not be read safely.",
  "docker-output": "local Docker metadata was incomplete or malformed.",
  "docker-identity": "the database endpoint could not be matched to one unambiguous Supabase container for this project.",
  "drizzle-missing": "the local Drizzle CLI is unavailable.",
  "migration-start": "the local Drizzle migration process could not be started.",
  "unexpected": "an unexpected preflight error occurred; no migration was started.",
});

export class LocalMigrationSafetyError extends Error {
  constructor(category) {
    super(safeFailureMessages[category] ?? safeFailureMessages.unexpected);
    this.name = "LocalMigrationSafetyError";
    this.category = Object.hasOwn(safeFailureMessages, category) ? category : "unexpected";
  }
}

export function formatLocalMigrationFailure(error, stage) {
  if (error instanceof LocalMigrationSafetyError) {
    return safeFailureMessages[error.category];
  }

  const stageCategories = {
    configuration: "configuration",
    status: "status-command-failed",
    docker: "docker-command",
    drizzle: "drizzle-missing",
    migration: "migration-start",
  };

  return safeFailureMessages[stageCategories[stage] ?? "unexpected"];
}

function isLoopbackHost(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (loopbackNames.has(normalized)) return true;
  return isIP(normalized) === 6 && normalized === "::1";
}

export function parseLocalSupabaseConfig(configText) {
  const projectMatches = [...configText.matchAll(/^\s*project_id\s*=\s*"([^"]+)"\s*(?:#.*)?$/gm)];
  const dbSection = configText.match(/^\s*\[db\]\s*\n([\s\S]*?)(?=^\s*\[|$(?![\s\S]))/m)?.[1];
  const portMatches = dbSection
    ? [...dbSection.matchAll(/^\s*port\s*=\s*(\d+)\s*(?:#.*)?$/gm)]
    : [];

  if (projectMatches.length !== 1 || portMatches.length !== 1) {
    throw new Error("Local Supabase configuration is missing or ambiguous.");
  }

  const projectId = projectMatches[0][1];
  const databasePort = Number(portMatches[0][1]);
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId) || !Number.isInteger(databasePort) || databasePort < 1 || databasePort > 65535) {
    throw new Error("Local Supabase project identity or database port is invalid.");
  }

  return { projectId, databasePort };
}

function getSqlEndpoint(status) {
  const endpoint = status?.endpoints?.["database.sql"] ?? status?.endpoints?.database?.sql;
  if (endpoint) return endpoint;

  if (typeof status?.DB_URL === "string") {
    try {
      const databaseUrl = new URL(status.DB_URL);
      return {
        url: status.DB_URL,
        address: databaseUrl.hostname,
        port: Number(databaseUrl.port),
      };
    } catch {
      return { url: status.DB_URL, address: "", port: 0 };
    }
  }

  return undefined;
}

export function validateLocalSupabaseStatus(status, localConfig) {
  const suppliedIdentities = status && typeof status === "object"
    ? identityKeys.filter((key) => Object.hasOwn(status, key)).map((key) => status[key])
    : [];

  if (
    suppliedIdentities.some((identity) => typeof identity !== "string" || identity !== localConfig.projectId)
  ) {
    throw new LocalMigrationSafetyError("project-identity");
  }

  if (status?.linked_project_ref !== undefined && status.linked_project_ref !== null) {
    throw new LocalMigrationSafetyError("linked-project");
  }

  const endpoint = getSqlEndpoint(status);
  if (!endpoint || typeof endpoint.url !== "string" || typeof endpoint.address !== "string") {
    throw new LocalMigrationSafetyError("endpoint-missing");
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(endpoint.url);
  } catch {
    throw new LocalMigrationSafetyError("endpoint-malformed");
  }

  const urlPort = Number(databaseUrl.port);
  const endpointPort = Number(endpoint.port);
  const address = endpoint.address.replace(/^\[|\]$/g, "");
  const hostname = databaseUrl.hostname.replace(/^\[|\]$/g, "");

  if (
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol)
    || !isLoopbackHost(hostname)
    || !isLoopbackHost(address)
    || urlPort !== localConfig.databasePort
    || endpointPort !== localConfig.databasePort
    || hostname.toLowerCase() !== address.toLowerCase()
    || databaseUrl.username !== "postgres"
    || databaseUrl.pathname !== "/postgres"
    || databaseUrl.search
    || databaseUrl.hash
  ) {
    throw new LocalMigrationSafetyError("endpoint-unsafe");
  }

  return databaseUrl.toString();
}

function parseDockerLabels(labels) {
  if (labels && typeof labels === "object" && !Array.isArray(labels)) return labels;
  if (typeof labels !== "string") return {};

  return Object.fromEntries(labels.split(",").map((label) => {
    const separator = label.indexOf("=");
    return separator < 0 ? [label, ""] : [label.slice(0, separator), label.slice(separator + 1)];
  }));
}

function publishesConfiguredDatabasePort(ports, databasePort) {
  if (typeof ports !== "string") return false;
  return ports.split(",").some((mapping) => {
    const match = mapping.trim().match(/(?:(?:\[[^\]]+\]|[^:,]+):)?(\d+)->5432\/tcp$/);
    return match && Number(match[1]) === databasePort;
  });
}

function isDatabaseService(service) {
  return service === "db" || service === "database";
}

function hasExpectedDatabaseContainerName(container, projectId) {
  const expectedName = `supabase_db_${projectId}`;
  const names = container?.Names ?? container?.Name;
  const values = Array.isArray(names) ? names : [names];

  return values.length === 1
    && typeof values[0] === "string"
    && values[0].replace(/^\//, "") === expectedName;
}

function isExpectedComposeProject(composeProject, projectId) {
  return composeProject === undefined
    || composeProject === projectId
    || composeProject.startsWith(`supabase-${projectId}-`);
}

export function validateLocalDockerIdentity(containers, localConfig, databaseUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new LocalMigrationSafetyError("docker-identity");
  }

  if (
    !Array.isArray(containers)
    || parsedUrl.port !== String(localConfig.databasePort)
    || !isLoopbackHost(parsedUrl.hostname)
  ) {
    throw new LocalMigrationSafetyError("docker-identity");
  }

  const portContainers = containers.filter((container) => (
    container?.State === "running"
    && publishesConfiguredDatabasePort(container?.Ports, localConfig.databasePort)
  ));

  if (portContainers.length !== 1) {
    throw new LocalMigrationSafetyError("docker-identity");
  }

  const container = portContainers[0];
  const labels = parseDockerLabels(container.Labels);
  const projectId = labels["com.supabase.cli.project"];
  const cliService = labels["com.supabase.service"];
  const composeService = labels["com.docker.compose.service"];
  const composeProject = labels["com.docker.compose.project"];

  const serviceValues = [cliService, composeService].filter((value) => value !== undefined);
  const hasValidServiceIdentity = serviceValues.length > 0
    ? serviceValues.every(isDatabaseService)
    : hasExpectedDatabaseContainerName(container, localConfig.projectId);

  if (
    projectId !== localConfig.projectId
    || !hasValidServiceIdentity
    || !isExpectedComposeProject(composeProject, localConfig.projectId)
  ) {
    throw new LocalMigrationSafetyError("docker-identity");
  }

  return true;
}

export function parseLocalDockerPsOutput(output) {
  if (typeof output !== "string" || output.trim() === "") {
    throw new LocalMigrationSafetyError("docker-output");
  }

  try {
    return output.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  } catch {
    throw new LocalMigrationSafetyError("docker-output");
  }
}

export function validateLocalDockerContextHost(output) {
  let host;
  try {
    host = JSON.parse(output);
  } catch {
    throw new LocalMigrationSafetyError("docker-context");
  }

  if (typeof host !== "string" || !host.startsWith("unix://")) {
    throw new LocalMigrationSafetyError("docker-context");
  }

  let socketPath;
  let socketUrl;
  try {
    socketUrl = new URL(host.replace(/^unix:/, "file:"));
    socketPath = decodeURIComponent(socketUrl.pathname);
  } catch {
    throw new LocalMigrationSafetyError("docker-context");
  }

  if (socketUrl.hostname || socketUrl.search || socketUrl.hash || !socketPath.startsWith("/")) {
    throw new LocalMigrationSafetyError("docker-context");
  }

  return true;
}

export function validateDrizzleMigrationChain(journal, sqlFilenames) {
  const entries = journal?.entries;
  const expectedFiles = expectedMigrationTags.map((tag) => `${tag}.sql`);

  if (
    journal?.dialect !== "postgresql"
    || !Array.isArray(entries)
    || entries.length !== expectedMigrationTags.length
    || entries.some((entry, index) => (
      entry?.idx !== index
      || entry?.tag !== expectedMigrationTags[index]
      || entry?.version !== journal.version
    ))
    || expectedFiles.some((filename) => !sqlFilenames.includes(filename))
    || sqlFilenames.some((filename) => /^\d{4}_.*\.sql$/.test(filename) && !expectedFiles.includes(filename))
  ) {
    throw new Error("Drizzle migrations 0000–0013 or their journal order do not match the approved chain.");
  }

  return expectedMigrationTags;
}

export function createDrizzleEnvironment(parentEnvironment, databaseUrl) {
  const childEnvironment = {};
  for (const key of ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "SystemRoot"]) {
    if (parentEnvironment[key]) childEnvironment[key] = parentEnvironment[key];
  }

  childEnvironment.NODE_ENV = "development";
  childEnvironment.DATABASE_URL = databaseUrl;
  return childEnvironment;
}
