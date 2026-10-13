import { describe, expect, it } from "vitest";
import { isPermanentUser, profileDestination } from "@/lib/auth/identity";

describe("Google-authenticated identity boundary", () => {
  it("accepts only a user with an explicit non-anonymous Auth claim", () => {
    expect(isPermanentUser({ id: "user", is_anonymous: false } as never)).toBe(true);
    expect(isPermanentUser({ id: "anon", is_anonymous: true } as never)).toBe(false);
    expect(isPermanentUser({ id: "missing-claim" } as never)).toBe(false);
    expect(isPermanentUser(null)).toBe(false);
    expect(isPermanentUser(undefined)).toBe(false);
  });

  it("does not infer permanent identity from email or user-editable metadata", () => {
    expect(isPermanentUser({
      id: "unverified",
      email: "student@example.test",
      is_anonymous: undefined,
      user_metadata: { provider: "google", is_anonymous: false },
    } as never)).toBe(false);
  });

  it("sends new profiles to onboarding and completed profiles to the workspace", () => {
    expect(profileDestination(null)).toBe("/onboarding");
    expect(profileDestination(undefined)).toBe("/onboarding");
    expect(profileDestination("Computer Science")).toBe("/home");
  });
});
