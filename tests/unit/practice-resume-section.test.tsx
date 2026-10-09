import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PracticeResumeSection, type PracticeResumeItem } from "@/components/practice-resume-section";

const makeItems = (count: number): PracticeResumeItem[] => Array.from({ length: count }, (_, index) => ({
  id: `session-${index + 1}`,
  title: `Practice problem ${index + 1}`,
  difficulty: index % 2 === 0 ? "Easy" : "Medium",
  mode: index % 2 === 0 ? "coach" : "tutor",
}));

describe("Practice resume section", () => {
  it.each([0, 1, 3])("does not show a toggle for %i resumable problems", (count) => {
    const html = renderToStaticMarkup(<PracticeResumeSection items={makeItems(count)} />);
    expect((html.match(/<li>/g) ?? [])).toHaveLength(count);
    expect(html).not.toContain("practice-resume-toggle");
    if (count === 0) expect(html).toBe("");
  });

  it("shows only three most recent ordered items and an accessible expand control", () => {
    const html = renderToStaticMarkup(<PracticeResumeSection items={makeItems(5)} />);

    expect((html.match(/<li>/g) ?? [])).toHaveLength(3);
    expect(html).toContain("Practice problem 1");
    expect(html).toContain("Practice problem 3");
    expect(html).not.toContain("Practice problem 4");
    expect(html).toContain("href=\"/practice/session/session-1\"");
    expect(html).toContain("Coach");
    expect(html).toContain("Tutor");
    expect(html).toContain("aria-expanded=\"false\"");
    expect(html).toContain("aria-controls=\"practice-resume-list\"");
    expect(html).toContain("Show 2 more questions");
  });
});
