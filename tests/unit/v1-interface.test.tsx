import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BrandLockup } from "@/components/brand-lockup";
import { MessageContent } from "@/components/message-content";
import { latestPracticeStateByProblem } from "@/lib/practice-session-display";

describe("V1 interface boundaries", () => {
  it("uses the complete official Miva Open University wordmark", () => {
    const html = renderToStaticMarkup(<BrandLockup />);
    expect(html).toContain('alt="Miva Open University"');
    expect(html).toContain("miva-logo.png");
    expect(html).toContain('width="1920"');
    expect(html).toContain('height="497"');
  });

  it("uses the Miva Buddy product lockup in application navigation", () => {
    const html = renderToStaticMarkup(<BrandLockup linked variant="product" />);
    expect(html).toContain('aria-label="Miva Buddy home"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Miva Buddy"');
    expect(html).toContain('class="brand-product-symbol"');
    expect(html).toContain('class="brand-product-miva"');
    expect(html).toContain('class="brand-product-name"');
    expect(html).toContain(">Buddy</span>");
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
