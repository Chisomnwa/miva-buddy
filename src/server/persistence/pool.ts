import { Pool } from "pg";
import { getServerConfig } from "@/lib/config";

const globalPool = globalThis as typeof globalThis & { mivaBuddyPool?: Pool };

export function getDatabasePool(): Pool {
  if (globalPool.mivaBuddyPool) return globalPool.mivaBuddyPool;
  const connectionString = getServerConfig().DATABASE_URL;
  if (!connectionString) throw new Error("Database connection is not configured");
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    application_name: "miva-buddy-web-worker",
  });
  pool.on("error", (error: NodeJS.ErrnoException) => {
    console.error("Idle database connection error", { code: error.code ?? "unknown" });
  });
  globalPool.mivaBuddyPool = pool;
  return pool;
}
