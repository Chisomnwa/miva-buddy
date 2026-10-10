export type InterviewSearchLinks = {
  hackerNewsRecent: string;
  hackerNewsAllDates: string;
  leetCodeDiscussRecent: string;
  leetCodeDiscussAllDates: string;
};

function normalizedPhrase(value: string | null, maxLength: number) {
  const phrase = value?.replace(/[\s\u0000-\u001f]+/g, " ").trim().replaceAll('"', "'") ?? "";
  return phrase.length > 0 && phrase.length <= maxLength ? phrase : "";
}

function searchUrl(query: string) {
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", query);
  return url.toString();
}

function cutoffDate(now: Date) {
  const year = now.getUTCFullYear() - 2;
  const month = now.getUTCMonth();
  const day = Math.min(now.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

/** Builds user-opened, website-restricted searches; it never calls or fetches result pages. */
export function buildInterviewSearchLinks(company: string | null, roleTitle: string | null, now = new Date()): InterviewSearchLinks | null {
  const companyPhrase = normalizedPhrase(company, 120);
  if (!companyPhrase) return null;

  const rolePhrase = normalizedPhrase(roleTitle, 120);
  const terms = [`"${companyPhrase}"`, rolePhrase ? `"${rolePhrase}"` : null].filter(Boolean).join(" ");
  const recentDateFilter = `after:${cutoffDate(now)}`;
  return {
    hackerNewsRecent: searchUrl(`site:news.ycombinator.com/item ${terms} interview ${recentDateFilter}`),
    hackerNewsAllDates: searchUrl(`site:news.ycombinator.com/item ${terms} interview`),
    leetCodeDiscussRecent: searchUrl(`site:leetcode.com/discuss ${terms} interview experience ${recentDateFilter}`),
    leetCodeDiscussAllDates: searchUrl(`site:leetcode.com/discuss ${terms} interview experience`),
  };
}
