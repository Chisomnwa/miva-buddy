import { describe, expect, it } from "vitest";
import { getStudentLevelDefault, profileInputSchema, studentLevelOptions } from "@/contracts/profile";

describe("student profile input", () => {
  it("offers the five allowed levels and preserves saved values as the picker default", () => {
    expect(studentLevelOptions).toEqual(["100 Level", "200 Level", "300 Level", "400 Level", "Other"]);
    expect(getStudentLevelDefault(undefined)).toBe("100 Level");
    expect(getStudentLevelDefault("300 Level")).toBe("300 Level");
    expect(getStudentLevelDefault("Other")).toBe("Other");
    expect(getStudentLevelDefault("600 Level")).toBe("");
  });

  it("accepts exactly the listed levels for new submissions", () => {
    for (const level of studentLevelOptions) {
      expect(profileInputSchema.safeParse({
        programme: "Computer Science",
        level,
        careerInterests: ["Software Engineering"],
      }).success).toBe(true);
    }

    for (const level of ["500 Level", "600 Level", "Undergraduate", ""]) {
      expect(profileInputSchema.safeParse({
        programme: "Computer Science",
        level,
        careerInterests: [],
      }).success).toBe(false);
    }
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
