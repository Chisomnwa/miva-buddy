import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/app/actions/practice", () => ({ startPracticeSessionAction: async () => undefined }));
import { PracticePatternList } from "@/components/practice-pattern-list";
import { PRACTICE_TOPICS, getPracticeProblemsForTopic } from "@/server/practice/catalog";
import type { PracticeSessionDisplay } from "@/lib/practice-session-display";

const arraysProblems = getPracticeProblemsForTopic("arrays-hashing");

describe("Practice pattern disclosures", () => {
  it("renders all 14 patterns and 107 compact, directly actionable problem rows", () => {
    const html = renderToStaticMarkup(<PracticePatternList sessions={[]} progressAvailable />);

    expect((html.match(/<details class="practice-pattern">/g) ?? [])).toHaveLength(14);
    expect((html.match(/class="practice-problem-row practice-pattern-problem/g) ?? [])).toHaveLength(107);
    expect((html.match(/role="progressbar"/g) ?? [])).toHaveLength(14);
    expect(html).toContain("0/15");
    expect(html).toContain("aria-valuenow=\"0\"");
    expect(html).toContain("width:0%");
    expect(html).toContain("Start or resume Two Sum");
    expect(html).toContain('name="problemSlug" value="two-sum"');
    expect(html).toContain('name="topicId" value="arrays-hashing"');
    expect(html).toContain("Not started");
    expect(html).toContain("Difficulty");
    expect(html).not.toContain("Open pattern to start or resume practice");
    expect(html).not.toContain("practice-pattern-problem is-completed");
    expect(html).not.toContain("<details class=\"practice-pattern\" open>");
  });

  it("counts only explicit self-reported completions and keeps active rows distinct", () => {
    const html = renderToStaticMarkup(<PracticePatternList sessions={[
      { id: "completed-session", problem_slug: "two-sum", status: "completed" },
      { id: "active-session", problem_slug: "contains-duplicate", status: "in_progress" },
    ]} progressAvailable />);

    expect(html).toContain("1/15");
    expect(html).toContain("aria-valuenow=\"1\"");
    expect(html).toContain("width:7%");
    expect(html).toContain("Completed by you");
    expect(html).toContain("In progress");
    expect(html).toContain("practice-pattern-problem is-completed");
    expect(html).toContain("practice-pattern-problem is-in-progress");
    expect(html).toContain("Resume Contains Duplicate practice");
    expect(html).toContain("/practice/session/active-session");
  });

  it("shows full completion only when each curated problem has a completed session", () => {
    const sessions: PracticeSessionDisplay[] = arraysProblems.map((problem) => ({
      id: `completed-${problem.slug}`,
      problem_slug: problem.slug,
      status: "completed",
    }));
    const html = renderToStaticMarkup(<PracticePatternList sessions={sessions} progressAvailable />);
    const arraysPattern = html.slice(html.indexOf("Arrays &amp; Hashing"), html.indexOf("Two Pointers"));

    expect(arraysPattern).toContain("15/15");
    expect(arraysPattern).toContain("aria-valuenow=\"15\"");
    expect(arraysPattern).toContain("width:100%");
    expect((html.match(/practice-pattern-problem is-completed/g) ?? [])).toHaveLength(arraysProblems.length);
  });

  it("does not invent zero progress when saved progress is unavailable", () => {
    const html = renderToStaticMarkup(<PracticePatternList sessions={[]} progressAvailable={false} />);
    const arraysPattern = html.slice(html.indexOf("Arrays &amp; Hashing"), html.indexOf("Two Pointers"));

    expect(arraysPattern).toContain("—/15");
    expect(arraysPattern).toContain("aria-valuetext=\"Progress unavailable\"");
    expect(arraysPattern).not.toContain("aria-valuenow");
    expect(arraysPattern).toContain("Status unavailable");
  });

  it("retains native summary keyboard semantics for every pattern", () => {
    const html = renderToStaticMarkup(<PracticePatternList sessions={[]} progressAvailable />);
    expect((html.match(/<summary class="practice-pattern-summary">/g) ?? [])).toHaveLength(PRACTICE_TOPICS.length);
  });

  it("renders the existing description for every pattern without changing its content", () => {
    const html = renderToStaticMarkup(<PracticePatternList sessions={[]} progressAvailable />);
    const descriptions = html.match(/<p class="practice-pattern-description">.*?<\/p>/g) ?? [];

    expect(descriptions).toHaveLength(14);
    expect(descriptions).toContain("<p class=\"practice-pattern-description\">Build fluency with arrays, strings, and lookup structures.</p>");
    expect(descriptions).toContain("<p class=\"practice-pattern-description\">Use coordinated positions to reason across sequences.</p>");
  });
});
