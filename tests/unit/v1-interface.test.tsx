import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandLockup } from "@/components/brand-lockup";
import { MessageContent } from "@/components/message-content";
import { latestPracticeStateByProblem } from "@/lib/practice-session-display";

describe("V1 interface boundaries", () => {
  it("uses the supplied symbol slot with the student product name", () => {
    const html = renderToStaticMarkup(<BrandLockup />);
    expect(html).toContain('class="brand-symbol"');
    expect(html).toContain("Miva Buddy");
    expect(html).not.toContain(">m<");
  });

  it("renders code legibly while escaping model-provided HTML", () => {
    const html = renderToStaticMarkup(<MessageContent content={'Example\n```ts\nconst x = "<script>";\n```'} />);
    expect(html).toContain("code-language");
    expect(html).toContain("learn-code-block");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("prefers an active owner-scoped session over a completed one for resume", () => {
    const state = latestPracticeStateByProblem([
      { id: "new-complete", problem_slug: "two-sum", status: "completed" },
      { id: "active", problem_slug: "two-sum", status: "in_progress" },
      { id: "old-complete", problem_slug: "two-sum", status: "completed" },
    ]);
    expect(state.get("two-sum")).toEqual({ id: "active", status: "in_progress" });
  });
});
