import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecentLearning } from "@/components/recent-learning";
import type { RecentLearnConversation } from "@/lib/learning";

const makeConversations = (count: number): RecentLearnConversation[] => Array.from({ length: count }, (_, index) => ({
  id: "conversation-" + (index + 1),
  title: "Learning conversation " + (index + 1),
  updated_at: new Date(Date.UTC(2026, 0, count - index)).toISOString(),
}));

describe("RecentLearning", () => {
  it("renders nothing when there are no conversations", () => {
    expect(renderToStaticMarkup(<RecentLearning conversations={[]} collapsible />)).toBe("");
  });

  it.each([1, 3])("does not show a disclosure for %i conversations", (count) => {
    const html = renderToStaticMarkup(<RecentLearning conversations={makeConversations(count)} collapsible />);

    expect((html.match(/class="recent-learning-conversation"/g) ?? [])).toHaveLength(count);
    expect(html).not.toContain("<details");
    expect(html).not.toContain("Show less");
  });

  it("shows the three newest in their existing order and provides a native accessible disclosure for the rest", () => {
    const html = renderToStaticMarkup(<RecentLearning conversations={makeConversations(5)} collapsible />);
    const cardList = html.match(/<ul class="recent-learning-list">([\s\S]*?)<\/ul>/)?.[1] ?? "";
    const disclosure = html.match(/<details class="recent-learning-expansion">([\s\S]*?)<\/details>/)?.[1] ?? "";

    expect(html).toContain('href="/learn/conversation-1"');
    expect(html).toContain('href="/learn/conversation-3"');
    expect(disclosure).toContain("Show 2 more conversations");
    expect(disclosure).toContain('aria-controls="recent-learning-more"');
    expect(disclosure).toContain('id="recent-learning-more"');
    expect(html).not.toMatch(/<details[^>]*\sopen(?:\s|=|>)/);
    expect((html.match(/class="recent-learning-conversation"/g) ?? [])).toHaveLength(5);
    expect((cardList.match(/class="recent-learning-conversation"/g) ?? [])).toHaveLength(3);
    expect(html.indexOf("</ul>")).toBeLessThan(html.indexOf('<details class="recent-learning-expansion">'));
    expect(disclosure).toContain('href="/learn/conversation-4"');
    expect(disclosure).toContain('href="/learn/conversation-5"');
    expect(disclosure).toContain("Show less");
    expect(html).toContain('class="practice-resume-toggle"');
  });

  it("keeps the non-collapsible Home presentation unchanged", () => {
    const html = renderToStaticMarkup(<RecentLearning conversations={makeConversations(4)} />);

    expect((html.match(/class="recent-learning-conversation"/g) ?? [])).toHaveLength(4);
    expect(html).not.toContain("<details");
    expect(html).not.toContain("recent-learning-more");
  });
});
