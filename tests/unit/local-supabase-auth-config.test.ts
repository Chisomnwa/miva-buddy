import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const supabaseConfig = readFileSync(
  new URL("../../supabase/config.toml", import.meta.url),
  "utf8",
);
const authSection = supabaseConfig.split(/^\[auth\]\s*$/m)[1]?.split(/^\[/m)[0] ?? "";

describe("local Supabase Auth configuration", () => {
  it("enables anonymous sign-in required by the onboarding profile save flow", () => {
    expect(authSection).toMatch(/^enable_anonymous_sign_ins\s*=\s*true\s*$/m);
  });
});
