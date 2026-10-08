import { describe, expect, it } from "vitest";
import { profileInputSchema } from "@/contracts/profile";

describe("student profile input", () => {
  it("accepts valid programme, level, and optional interests", () => {
    const result = profileInputSchema.safeParse({
      programme: "Computer Science",
      level: "200 Level",
      careerInterests: ["Software Engineering"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing or unreasonably long profile fields", () => {
    expect(profileInputSchema.safeParse({ programme: "", level: "", careerInterests: [] }).success).toBe(false);
    expect(profileInputSchema.safeParse({ programme: "x".repeat(101), level: "200 Level", careerInterests: [] }).success).toBe(false);
  });

  it("limits interest count and trims values", () => {
    expect(profileInputSchema.safeParse({ programme: "CS", level: "200 Level", careerInterests: Array(5).fill("Software Engineering") }).success).toBe(false);
    expect(profileInputSchema.safeParse({ programme: "CS", level: "200 Level", careerInterests: ["Unlisted interest"] }).success).toBe(false);
    expect(profileInputSchema.parse({ programme: " CS ", level: " 200 Level ", careerInterests: ["Software Engineering"] })).toEqual({
      programme: "CS",
      level: "200 Level",
      careerInterests: ["Software Engineering"],
    });
  });
});
