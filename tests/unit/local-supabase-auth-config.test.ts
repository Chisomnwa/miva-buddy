import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const supabaseConfig = readFileSync(
  new URL("../../supabase/config.toml", import.meta.url),
  "utf8",
);
const authSection = supabaseConfig.split(/^\[auth\]\s*$/m)[1]?.split(/^\[/m)[0] ?? "";

describe("local Supabase Auth configuration", () => {
  it("requires Google Auth and disables anonymous and email signups", () => {
    expect(authSection).toMatch(/^enable_anonymous_sign_ins\s*=\s*false\s*$/m);
    expect(supabaseConfig).toMatch(/\[auth\.email\][\s\S]*?enable_signup\s*=\s*false/);
    expect(supabaseConfig.match(/^\[auth\.external\.google\]$/gm)).toHaveLength(1);
    expect(supabaseConfig).toContain('client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"');
    expect(supabaseConfig).toContain('secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"');
  });
});
