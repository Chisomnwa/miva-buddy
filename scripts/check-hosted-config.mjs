import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());

const env = process.env;
const validUrl = (value, protocols) => {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const statuses = {
  NEXT_PUBLIC_SUPABASE_URL: validUrl(env.NEXT_PUBLIC_SUPABASE_URL, ["https:"]),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: Boolean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  DATABASE_URL: validUrl(env.DATABASE_URL, ["postgres:", "postgresql:"]),
  GEMINI_API_KEY: Boolean(env.GEMINI_API_KEY),
};

for (const [name, valid] of Object.entries(statuses)) {
  console.log(`${name}: ${valid ? "present/valid" : "missing/invalid"}`);
}

let databaseConnected = false;
if (statuses.DATABASE_URL) {
  const client = new pg.Client({
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 8_000,
    query_timeout: 8_000,
  });
  try {
    await client.connect();
    await client.query("select 1");
    databaseConnected = true;
  } catch {
    // Deliberately do not print driver errors: they can contain connection details.
  } finally {
    await client.end().catch(() => {});
  }
}

console.log(`DATABASE_URL connectivity: ${databaseConnected ? "connected" : "not connected"}`);
if (!Object.values(statuses).every(Boolean) || !databaseConnected) process.exitCode = 1;
