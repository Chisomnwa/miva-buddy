import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InterviewPreparationCard } from "@/components/interview-preparation-card";
import { buildInterviewSearchLinks } from "@/lib/interview-search-links";
import { buildInterviewPreparation } from "@/server/interview-preparation/prepare";

describe("user-directed interview searches", () => {
  const testDate = new Date("2026-10-11T12:00:00.000Z");

  it("builds recent and all-dates company-only searches", () => {
    const links = buildInterviewSearchLinks("Coinbase", null, testDate);
    expect(links).not.toBeNull();
    const hnRecent = new URL(links!.hackerNewsRecent);
    const hnAll = new URL(links!.hackerNewsAllDates);
    const leetRecent = new URL(links!.leetCodeDiscussRecent);
    const leetAll = new URL(links!.leetCodeDiscussAllDates);
    expect(hnRecent.origin).toBe("https://www.google.com");
    expect(hnRecent.searchParams.get("q")).toBe('site:news.ycombinator.com/item "Coinbase" interview after:2024-10-11');
    expect(leetRecent.searchParams.get("q")).toBe('site:leetcode.com/discuss "Coinbase" interview experience after:2024-10-11');
    expect(hnAll.searchParams.get("q")).toBe('site:news.ycombinator.com/item "Coinbase" interview');
    expect(leetAll.searchParams.get("q")).toBe('site:leetcode.com/discuss "Coinbase" interview experience');
    expect(hnAll.searchParams.get("q")).not.toMatch(/\b(?:after|before):/);
    expect(leetAll.searchParams.get("q")).not.toMatch(/\b(?:after|before):/);
  });

  it("calculates a rolling 24-month cutoff and clamps leap-day arithmetic", () => {
    const ordinary = buildInterviewSearchLinks("Paystack", null, testDate)!;
    expect(new URL(ordinary.hackerNewsRecent).searchParams.get("q")).toContain("after:2024-10-11");
    const leapDay = buildInterviewSearchLinks("Paystack", null, new Date("2024-02-29T23:00:00.000Z"))!;
    expect(new URL(leapDay.hackerNewsRecent).searchParams.get("q")).toContain("after:2022-02-28");
  });

  it("includes the known role and safely encodes query characters", () => {
    const links = buildInterviewSearchLinks("C++ Labs & Co", "Backend Engineer (Intern)", testDate)!;
    for (const link of Object.values(links)) {
      const url = new URL(link);
      expect(url.searchParams.get("q")).toContain('"C++ Labs & Co"');
      expect(url.searchParams.get("q")).toContain('"Backend Engineer (Intern)"');
      expect(url.href).toContain("%22");
      expect(url.href).toContain("%2B%2B");
      expect(url.href).toContain("%26");
    }
  });

  it("does not build search URLs for missing or invalid company input", () => {
    expect(buildInterviewSearchLinks(null, "Backend Engineer", testDate)).toBeNull();
    expect(buildInterviewSearchLinks("  ", null, testDate)).toBeNull();
    expect(buildInterviewSearchLinks("x".repeat(121), null, testDate)).toBeNull();
  });

  it("renders four external search choices with concise date and evidence context", () => {
    const prep = buildInterviewPreparation({ message: "Prepare for a backend engineer interview at Coinbase." });
    const html = renderToStaticMarkup(<InterviewPreparationCard value={prep} id="sample" />);
    expect(html).toContain("Explore interview experiences");
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("Search Hacker News — past 24 months (external)");
    expect(html).toContain("Search Hacker News — all dates (external)");
    expect(html).toContain("Search LeetCode Discuss — past 24 months (external)");
    expect(html).toContain("Search LeetCode Discuss — all dates (external)");
    expect(html).toContain("General interview preparation</h2>");
    expect(html).toContain("These open external Google searches, not verified candidate accounts.");
    expect(html).toContain("Recent filters page dates, not interview dates; some companies may have no recent results.");
    expect(html).not.toContain("news.ycombinator.com/item?id=");
    expect(html).not.toContain("leetcode.com/discuss/post/");
  });

  it("includes company and follow-up role in both recent and all-dates searches", () => {
    const firstTurn = buildInterviewPreparation({ message: "I have an onsite interview at Coinbase." });
    const followUp = buildInterviewPreparation({
      message: "It's a software engineering internship role.",
      previousAssistantSegment: firstTurn,
    });
    const html = renderToStaticMarkup(<InterviewPreparationCard value={followUp} id="coinbase-follow-up" />);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]!.replaceAll("&amp;", "&"));
    const queries = hrefs.map((href) => new URL(href).searchParams.get("q") ?? "");
    expect(queries).toHaveLength(4);
    expect(queries.filter((query) => query.includes("after:"))).toHaveLength(2);
    expect(queries.every((query) => query.includes('"Coinbase"') && query.includes('"software engineering internship"'))).toBe(true);
  });

  it("does not show searches until the student resolves the company clarification", () => {
    const prep = buildInterviewPreparation({ message: "Help me prepare for an interview." });
    const html = renderToStaticMarkup(<InterviewPreparationCard value={prep} />);
    expect(html).toContain("A quick clarification");
    expect(html).not.toContain("Explore interview experiences");
  });
});
