export type RemoteOkBudgetTestDatabaseConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
};

const dedicatedDatabaseName = "miva_buddy_remoteok_budget_test";
const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);

/** Parse only an explicit loopback PostgreSQL URL; returned fields are passed directly to pg. */
export function parseRemoteOkBudgetTestDatabaseUrl(value: string | undefined): RemoteOkBudgetTestDatabaseConfig | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if ((url.protocol !== "postgres:" && url.protocol !== "postgresql:")
      || value.includes("?") || value.includes("#")) return null;

    const host = url.hostname.replace(/^\[(.+)\]$/u, "$1");
    const port = Number(url.port);
    const database = decodeURIComponent(url.pathname.replace(/^\//u, ""));
    const user = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    if (!loopbackHosts.has(host) || !url.port || !Number.isInteger(port) || port < 1 || port > 65_535
      || database !== dedicatedDatabaseName || !user) return null;

    return { host, port, database, user, ...(password ? { password } : {}) };
  } catch {
    return null;
  }
}
