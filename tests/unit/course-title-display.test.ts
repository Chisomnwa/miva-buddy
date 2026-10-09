import { describe, expect, it } from "vitest";
import { displayCourseTitle } from "@/lib/course-title-display";

describe("course title presentation", () => {
  it("renders a filename-style course title with spaces without mutating its source", () => {
    const storedTitle = "Advanced_Object_Oriented_Programming";
    expect(displayCourseTitle(storedTitle)).toBe("Advanced Object Oriented Programming");
    expect(storedTitle).toBe("Advanced_Object_Oriented_Programming");
  });

  it.each([
    "CS_101",
    "Algorithms & Data Structures",
    "object_oriented_programming",
    "Advanced-Object-Oriented-Programming",
    "Advanced_Object_Oriented_Programming (Lab)",
    "Data_Structures",
  ])("preserves intentional or ambiguous punctuation in %s", (title) => {
    expect(displayCourseTitle(title)).toBe(title);
  });
});
