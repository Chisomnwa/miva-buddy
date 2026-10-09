import type { JobEvidenceItem } from "@/contracts/job-evidence";
import { checkEvidenceFreshness } from "./freshness";
import { requireEvidencePermission, type EvidenceUseGrant } from "./permissions";

export type ListingCandidate = {
  providerId: string;
  postingId: string;
  title: string;
  company: string;
  location: string | null;
  tags?: string[];
  sourceName: string;
  sourceUrl: string;
  attributionLabel: string;
  attributionUrl: string;
  publishedAt: string | null;
  retrievedAt: string;
  description: string;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Match whole terms, not substrings such as SQL inside NoSQL or C inside C++. */
export function directlyMentions(text: string, term: string): boolean {
  const trimmed = term.trim();
  if (!trimmed) return false;
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}_+#])${escapeRegex(trimmed)}(?![\\p{L}\\p{N}_+#])`,
    "iu",
  );
  return pattern.test(text);
}

function sentences(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/\n+|(?<=[.!?])\s+/u)
    .map((sentence) => sentence.replace(/^\s*[•*\-]\s*/u, "").trim())
    .filter(Boolean);
}

/**
 * Return only a complete sentence that directly names the term/approved alias.
 * Oversized sentences are rejected instead of being cut into misleading quotes.
 */
export function selectDirectExcerpt(
  description: string,
  term: string,
  approvedAliases: readonly string[] = [],
  maxLength = 1_200,
): string | null {
  const candidates = [term, ...approvedAliases].filter(Boolean);
  if (!Number.isInteger(maxLength) || maxLength < 1) return null;
  return sentences(description).find(
    (sentence) => sentence.length <= maxLength && candidates.some((candidate) => directlyMentions(sentence, candidate)),
  ) ?? null;
}

export function buildEvidenceItem(
  listing: ListingCandidate,
  matchedTerm: string,
  approvedAliases: readonly string[],
  grant: EvidenceUseGrant,
  now: Date,
  maxAgeMs: number,
): JobEvidenceItem | null {
  requireEvidencePermission(grant, "display_metadata");
  requireEvidencePermission(grant, "display_excerpt");
  if (checkEvidenceFreshness(listing.retrievedAt, now, maxAgeMs) !== "fresh") return null;
  const excerpt = selectDirectExcerpt(listing.description, matchedTerm, approvedAliases);
  if (!excerpt) return null;
  return {
    providerId: listing.providerId,
    postingId: listing.postingId,
    title: listing.title,
    company: listing.company,
    location: listing.location,
    matchedTerm,
    excerpt,
    sourceName: listing.sourceName,
    sourceUrl: listing.sourceUrl,
    attributionLabel: listing.attributionLabel,
    attributionUrl: listing.attributionUrl,
    publishedAt: listing.publishedAt,
    retrievedAt: listing.retrievedAt,
  };
}
