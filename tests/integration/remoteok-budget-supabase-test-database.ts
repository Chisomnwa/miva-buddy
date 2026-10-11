import { X509Certificate } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Pool } from "pg";
import { fileURLToPath } from "node:url";

const dedicatedRole = "miva_remoteok_budget_test";
const markerName = "remoteok-budget-integration";
export const approvedSupabaseRemoteOkBudgetTestProjectRef = "ffthgvflulwrenfnetzb";
export const approvedSupabaseRemoteOkBudgetTestEndpoint = "aws-0-eu-west-1.pooler.supabase.com:5432";
export const approvedSupabaseRemoteOkBudgetTestPostgresMajorVersion = "17";
const projectRefPattern = /^[a-z0-9]{20}$/u;
const markerPattern = /^[a-f0-9]{64}$/u;
const directEndpointPattern = /^db\.([a-z0-9]{20})\.supabase\.co:5432$/u;
const sessionPoolerEndpointPattern = /^[a-z0-9-]+\.pooler\.supabase\.com:5432$/u;
const caCertificatePath = fileURLToPath(new URL("../../.supabase-remoteok-test-ca.pem", import.meta.url));

export function validateSupabaseRemoteOkBudgetTestCaCertificate(contents: string): string | null {
  const blocks = contents.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/gu);
  if (!blocks?.length || contents.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/gu, "").trim()) {
    return null;
  }

  try {
    for (const block of blocks) {
      const certificate = new X509Certificate(block);
      if (!certificate.ca) return null;
    }
    return contents;
  } catch {
    return null;
  }
}

/** Load only the local CA downloaded from this test project's Supabase dashboard. */
export async function loadSupabaseRemoteOkBudgetTestCaCertificate(): Promise<string> {
  let contents: string;
  try {
    contents = await readFile(caCertificatePath, "utf8");
  } catch {
    throw new Error("The local Supabase test CA file is missing or unreadable; download the database CA from the approved test project's dashboard.");
  }

  const certificate = validateSupabaseRemoteOkBudgetTestCaCertificate(contents);
  if (!certificate) {
    throw new Error("The local Supabase test CA file must contain only valid CA certificates in PEM format.");
  }
  return certificate;
}

export function createSupabaseRemoteOkBudgetTestTls(ca: string): { ca: string; rejectUnauthorized: true } {
  return { ca, rejectUnauthorized: true };
}

export type SupabaseRemoteOkBudgetTestConfig = {
  connection: {
    host: string;
    port: 5432;
    database: "postgres";
    user: string;
    password: string;
    ssl: { rejectUnauthorized: true };
  };
  projectRef: string;
  endpoint: string;
  marker: string;
  postgresMajorVersion: number;
};

export type SupabaseRemoteOkBudgetTestEnvironment = {
  optIn: string | undefined;
  databaseUrl: string | undefined;
  allowedProjectRef: string | undefined;
  allowedEndpoint: string | undefined;
  marker: string | undefined;
  postgresMajorVersion: string | undefined;
  applicationSupabaseUrl: string | undefined;
};

function parseProjectRefFromApplicationUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const match = /^([a-z0-9]{20})\.supabase\.co$/u.exec(url.hostname);
    if (url.protocol !== "https:" || !match || url.pathname !== "/" || url.search || url.hash) return null;
    return match[1] ?? null;
  } catch {
    return null;
  }
}

function parseEndpoint(value: string | undefined, projectRef: string): { host: string; endpoint: string } | null {
  if (!value || value.includes("/") || value.includes("?") || value.includes("#") || value.includes("@")) return null;
  const direct = directEndpointPattern.exec(value);
  if (direct?.[1] === projectRef) return { host: `db.${projectRef}.supabase.co`, endpoint: value };
  if (sessionPoolerEndpointPattern.test(value)) {
    const host = value.slice(0, -":5432".length);
    return { host, endpoint: value };
  }
  return null;
}

export function parseSupabaseRemoteOkBudgetTestConfig(
  environment: SupabaseRemoteOkBudgetTestEnvironment,
): SupabaseRemoteOkBudgetTestConfig | null {
  if (environment.optIn !== "1") return null;

  const projectRef = environment.allowedProjectRef;
  const endpoint = parseEndpoint(environment.allowedEndpoint, projectRef ?? "");
  const applicationProjectRef = parseProjectRefFromApplicationUrl(environment.applicationSupabaseUrl);
  const marker = environment.marker;
  const postgresMajorVersion = Number(environment.postgresMajorVersion);
  if (projectRef !== approvedSupabaseRemoteOkBudgetTestProjectRef
    || environment.allowedEndpoint !== approvedSupabaseRemoteOkBudgetTestEndpoint
    || !projectRefPattern.test(projectRef) || !endpoint || !applicationProjectRef
    || projectRef === applicationProjectRef || !marker || !markerPattern.test(marker)
    || postgresMajorVersion !== Number(approvedSupabaseRemoteOkBudgetTestPostgresMajorVersion)
    || !environment.databaseUrl) return null;

  try {
    const url = new URL(environment.databaseUrl);
    if ((url.protocol !== "postgres:" && url.protocol !== "postgresql:")
      || environment.databaseUrl.includes("?") || environment.databaseUrl.includes("#")
      || url.hostname !== endpoint.host || Number(url.port) !== 5432 || url.pathname !== "/postgres") return null;

    const username = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    const expectedUsername = endpoint.host === `db.${projectRef}.supabase.co`
      ? dedicatedRole
      : `${dedicatedRole}.${projectRef}`;
    if (username !== expectedUsername || !password) return null;

    return {
      connection: {
        host: endpoint.host,
        port: 5432,
        database: "postgres",
        user: username,
        password,
        ssl: { rejectUnauthorized: true },
      },
      projectRef,
      endpoint: endpoint.endpoint,
      marker,
      postgresMajorVersion,
    };
  } catch {
    return null;
  }
}

type PreflightRow = {
  database_name: string;
  database_user: string;
  server_version_num: number;
  project_ref: string;
  endpoint: string;
  marker_value: string;
};

/**
 * The test project must provision this read-only marker independently:
 * public.miva_buddy_remoteok_test_guard(marker_name, project_ref, endpoint, marker_value).
 * The test identity needs SELECT on this table; this test mode never creates or updates it.
 */
export async function verifySupabaseRemoteOkBudgetTestDatabase(
  pool: Pick<Pool, "query">,
  config: SupabaseRemoteOkBudgetTestConfig,
): Promise<void> {
  let rows: PreflightRow[];
  try {
    const result = await pool.query<PreflightRow>(`
      select current_database() as database_name,
        current_user as database_user,
        current_setting('server_version_num')::integer as server_version_num,
        project_ref,
        endpoint,
        marker_value
      from public.miva_buddy_remoteok_test_guard
      where marker_name = $1
      limit 2
    `, [markerName]);
    rows = result.rows;
  } catch {
    throw new Error("Hosted Remote OK test database preflight failed; no migration or test setup was executed.");
  }

  const [row] = rows;
  const actualMajorVersion = row ? Math.floor(row.server_version_num / 10_000) : null;
  if (rows.length !== 1 || !row
    || row.database_name !== "postgres"
    || row.database_user !== dedicatedRole
    || actualMajorVersion !== config.postgresMajorVersion
    || row.project_ref !== config.projectRef
    || row.endpoint !== config.endpoint
    || row.marker_value !== config.marker) {
    throw new Error("Hosted Remote OK test database identity did not match its approved project, endpoint, user, version, and marker; no migration or test setup was executed.");
  }
}
