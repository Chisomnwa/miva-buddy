import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("OAuth session preservation", () => {
  it("does not clear the existing browser session before starting OAuth", async () => {
    const source = await readFile(new URL("../../src/components/google-sign-in-button.tsx", import.meta.url), "utf8");
    expect(source).toContain("signInWithOAuth");
    expect(source).not.toContain("signOut");
  });
});
