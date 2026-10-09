export type InterviewSearchLinks = {
  hackerNews: string;
  leetCodeDiscuss: string;
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

/** Builds user-opened, website-restricted searches; it never calls or fetches result pages. */
export function buildInterviewSearchLinks(company: string | null, roleTitle: string | null): InterviewSearchLinks | null {
  const companyPhrase = normalizedPhrase(company, 120);
  if (!companyPhrase) return null;

  const rolePhrase = normalizedPhrase(roleTitle, 120);
  const terms = [`"${companyPhrase}"`, rolePhrase ? `"${rolePhrase}"` : null].filter(Boolean).join(" ");
  return {
    hackerNews: searchUrl(`site:news.ycombinator.com/item ${terms} interview`),
    leetCodeDiscuss: searchUrl(`site:leetcode.com/discuss ${terms} interview experience`),
  };
}
