import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import nextEnv from "@next/env";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required in the local environment.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10_000,
  query_timeout: 10_000,
});

const baseline = [
  { file: "drizzle/0000_profiles.sql", createdAt: 1791233010000 },
  { file: "drizzle/0001_learn_conversations.sql", createdAt: 1791319410000 },
];

try {
  await client.connect();
  const preflight = await client.query(`
    select t.relname as table_name, t.relrowsecurity as rls_enabled,
      (select count(*)::int from pg_policies p where p.schemaname = 'public' and p.tablename = t.relname) as policy_count
    from pg_class t
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = any($1)
  `, [["profiles", "learn_conversations", "learn_messages"]]);
  const expected = new Map([
    ["profiles", 4],
    ["learn_conversations", 3],
    ["learn_messages", 2],
  ]);
  const verified = preflight.rows.length === expected.size
    && preflight.rows.every((row) => row.rls_enabled && expected.get(row.table_name) === row.policy_count);
  if (!verified) {
    throw new Error("Existing M1/M2 tables or RLS policies do not match the expected hosted baseline; no migration history was changed.");
  }

  const existing = await client.query("select to_regclass('drizzle.__drizzle_migrations') as migration_table");
  if (existing.rows[0].migration_table) {
    throw new Error("Drizzle migration tracking already exists; refusing to alter its history.");
  }

  const bucket = await client.query("select public from storage.buckets where id = $1", ["course-materials"]);
  if (bucket.rowCount !== 1 || bucket.rows[0].public !== false) {
    throw new Error("The course-materials bucket is missing or not private; no migration history was changed.");
  }

  const hashes = await Promise.all(baseline.map(async ({ file }) => createHash("sha256").update(await readFile(file)).digest("hex")));
  await client.query("begin");
  await client.query("create schema if not exists drizzle");
  await client.query(`create table drizzle.__drizzle_migrations (
    id serial primary key,
    hash text not null,
    created_at bigint
  )`);
  for (const [index, migration] of baseline.entries()) {
    await client.query(
      "insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)",
      [hashes[index], migration.createdAt],
    );
  }
  await client.query("commit");
  console.log("Recorded verified M1/M2 SQL files in Drizzle migration history; no product rows were modified.");
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(error instanceof Error ? error.message : "Unable to record migration baseline.");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
