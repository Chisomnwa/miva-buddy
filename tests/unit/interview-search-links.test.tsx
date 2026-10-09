import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InterviewPreparationCard } from "@/components/interview-preparation-card";
import { buildInterviewSearchLinks } from "@/lib/interview-search-links";
import { buildInterviewPreparation } from "@/server/interview-preparation/prepare";

describe("user-directed interview searches", () => {
  it("builds website-restricted company-only searches", () => {
    const links = buildInterviewSearchLinks("Coinbase", null);
    expect(links).not.toBeNull();
    const hn = new URL(links!.hackerNews);
    const leetCode = new URL(links!.leetCodeDiscuss);
    expect(hn.origin).toBe("https://www.google.com");
    expect(hn.searchParams.get("q")).toBe('site:news.ycombinator.com/item "Coinbase" interview');
    expect(leetCode.searchParams.get("q")).toBe('site:leetcode.com/discuss "Coinbase" interview experience');
  });

  it("includes the explicitly provided role and safely encodes query characters", () => {
    const links = buildInterviewSearchLinks("C++ Labs & Co", "Backend Engineer (Intern)");
    expect(links).not.toBeNull();
    for (const link of [links!.hackerNews, links!.leetCodeDiscuss]) {
      const url = new URL(link);
      expect(url.searchParams.get("q")).toContain('"C++ Labs & Co"');
      expect(url.searchParams.get("q")).toContain('"Backend Engineer (Intern)"');
      expect(url.href).toContain("%22");
    }
  });

  it("does not build search URLs for missing or invalid company input", () => {
    expect(buildInterviewSearchLinks(null, "Backend Engineer")).toBeNull();
    expect(buildInterviewSearchLinks("  ", null)).toBeNull();
    expect(buildInterviewSearchLinks("x".repeat(121), null)).toBeNull();
  });

  it("renders external search links, not fabricated post URLs or verified evidence", () => {
    const prep = buildInterviewPreparation({ message: "Prepare for a backend engineer interview at Coinbase." });
    const html = renderToStaticMarkup(<InterviewPreparationCard value={prep} id="sample" />);
    expect(html).toContain("Explore interview experiences");
    expect(html).toContain("Miva Buddy does not fetch or review the results");
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("Search Hacker News discussions (external)");
    expect(html).toContain("Search LeetCode Discuss (external)");
    expect(html).toContain("General interview preparation—not company-specific");
    expect(html).not.toContain("news.ycombinator.com/item?id=");
    expect(html).not.toContain("leetcode.com/discuss/post/");
  });

  it("does not show searches until the student resolves the company clarification", () => {
    const prep = buildInterviewPreparation({ message: "Help me prepare for an interview." });
    const html = renderToStaticMarkup(<InterviewPreparationCard value={prep} />);
    expect(html).toContain("A quick clarification");
    expect(html).not.toContain("Explore interview experiences");
  });
});
