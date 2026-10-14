import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationPath = new URL("../../drizzle/0011_require_permanent_auth.sql", import.meta.url);

describe("permanent-auth migration", () => {
  it("keeps local Auth configured for Google only without embedding credentials", async () => {
    const config = await readFile(new URL("../../supabase/config.toml", import.meta.url), "utf8");
    expect(config).toContain('enable_anonymous_sign_ins = false');
    expect(config).toMatch(/\[auth\.email\][\s\S]*?enable_signup = false/);
    expect(config.match(/\[auth\.external\.google\]/g)).toHaveLength(1);
    expect(config).toMatch(/\[auth\.external\.google\][\s\S]*?enabled = true/);
    expect(config).toContain('client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"');
    expect(config).toContain('secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"');
    expect(config).toContain('http://localhost:3000/auth/callback');
    const googleProvider = config.split("[auth.external.google]")[1]?.split("\n[")[0] ?? "";
    expect(googleProvider).toMatch(/secret\s*=\s*"env\(/i);
  });

  it("adds restrictive permanent-identity checks while retaining the owner policies", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const ownedTables = [
      "profiles", "learn_conversations", "learn_messages", "courses", "course_materials",
      "material_pages", "material_chunks", "course_concepts", "course_concept_sources",
      "practice_sessions", "practice_messages",
    ];

    expect(sql).toContain("as restrictive for all to authenticated");
    expect(sql).toContain("using ((select auth.jwt()->>''is_anonymous'') = ''false'')");
    expect(sql).toContain("with check ((select auth.jwt()->>''is_anonymous'') = ''false'')");
    for (const table of ownedTables) expect(sql).toContain(`'${table}'`);
    expect(sql).not.toContain("storage.objects");
    expect(sql).not.toContain("course-materials");
    expect(sql).toContain("on public.%I as restrictive for all to authenticated");
    expect(sql).toContain("revoke all on function public.search_course_material_chunks(uuid, text, extensions.vector, text, uuid, uuid, integer) from public, anon");
    expect(sql).not.toMatch(/\b(drop|alter|truncate)\s+(table|policy|function|role)\b/i);
    expect(sql).not.toContain("remoteok");
  });

  it("keeps the retrieval migration invoker-secured and model-filtered", async () => {
    const sql = await readFile(new URL("../../drizzle/0010_embedding_model_retrieval_filter.sql", import.meta.url), "utf8");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("chunks.embedding_model = p_embedding_model");
  });
});
