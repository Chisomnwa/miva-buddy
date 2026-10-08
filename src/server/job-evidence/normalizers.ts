import type { JobReference } from "@/contracts/job-evidence";
import type { ListingCandidate } from "./matching";
import { requireEvidencePermission, type EvidenceUseGrant } from "./permissions";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" ? value as UnknownRecord : {};
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function nullableText(value: unknown): string | null {
  return text(value) || null;
}

function plainDescription(value: unknown): string {
  const source = text(value);
  return source
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/giu, " ")
    .replace(/<\s*(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/giu, "\n")
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/[ \t\u00a0]+/gu, " ")
    .replace(/\n{2,}/gu, "\n")
    .trim();
}

function date(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function requireFields(candidate: ListingCandidate): ListingCandidate | null {
  if (!candidate.postingId || !candidate.title || !candidate.company || !candidate.description) return null;
  try {
    if (new URL(candidate.sourceUrl).protocol !== "https:") return null;
    if (new URL(candidate.attributionUrl).protocol !== "https:") return null;
  } catch {
    return null;
  }
  return candidate;
}

function attribution(company: string, sourceUrl: string, provider: string): { label: string; url: string } {
  return provider === "remotive"
    ? { label: "Source: Remotive", url: sourceUrl }
    : { label: `Source: ${company}`, url: sourceUrl };
}

function baseCandidate(
  providerId: string,
  postingId: unknown,
  title: unknown,
  company: unknown,
  location: unknown,
  sourceUrl: unknown,
  publishedAt: unknown,
  retrievedAt: string,
  description: unknown,
): ListingCandidate | null {
  const normalizedCompany = text(company);
  const normalizedUrl = text(sourceUrl);
  const credit = attribution(normalizedCompany, normalizedUrl, providerId);
  return requireFields({
    providerId,
    postingId: text(postingId),
    title: text(title),
    company: normalizedCompany,
    location: nullableText(location),
    sourceName: providerId === "remotive" ? "Remotive" : normalizedCompany,
    sourceUrl: normalizedUrl,
    attributionLabel: credit.label,
    attributionUrl: credit.url,
    publishedAt: date(publishedAt),
    retrievedAt,
    description: plainDescription(description),
  });
}

/** Pure shape adapters only: these functions never make requests or persist raw records. */
export function normalizeRemotiveRecord(value: unknown, retrievedAt: string): ListingCandidate | null {
  const row = record(value);
  return baseCandidate("remotive", row.id, row.title, row.company_name, row.candidate_required_location,
    row.url, row.publication_date, retrievedAt, row.description);
}

export function normalizeGreenhouseRecord(value: unknown, retrievedAt: string): ListingCandidate | null {
  const row = record(value);
  const location = record(row.location);
  return baseCandidate("greenhouse", row.id, row.title, row.company_name, location.name,
    row.absolute_url, row.first_published, retrievedAt, row.content);
}

export function normalizeAshbyRecord(value: unknown, retrievedAt: string): ListingCandidate | null {
  const row = record(value);
  // Authenticated Ashby list APIs can include unlisted roles. Never normalize a
  // record explicitly marked unlisted for public rendering.
  if (row.isListed === false || row.isPublic === false) return null;
  return baseCandidate("ashby", row.id, row.title, row.companyName,
    row.location, row.jobUrl, row.publishedAt ?? row.publishedAtIso, retrievedAt,
    row.descriptionPlain ?? row.descriptionHtml);
}

export function normalizeLeverRecord(value: unknown, retrievedAt: string): ListingCandidate | null {
  const row = record(value);
  if (row.state !== undefined && text(row.state).toLowerCase() !== "published") return null;
  const categories = record(row.categories);
  const listText = Array.isArray(row.lists)
    ? row.lists.map((entry) => text(record(entry).content)).filter(Boolean).join("\n")
    : "";
  const description = [text(row.descriptionPlain ?? row.description), listText].filter(Boolean).join("\n");
  return baseCandidate("lever", row.id, row.text ?? row.title, row.companyName ?? row.company,
    categories.location ?? row.location, row.hostedUrl ?? row.url, row.createdAt ?? row.publishedAt,
    retrievedAt, description);
}

export function toMetadataReference(
  listing: ListingCandidate,
  grant: EvidenceUseGrant,
): JobReference {
  if (!requireFields(listing)) throw new Error("Invalid synthetic or source-normalized job reference.");
  requireEvidencePermission(grant, "display_metadata");
  return {
    providerId: listing.providerId,
    postingId: listing.postingId,
    title: listing.title,
    company: listing.company,
    location: listing.location,
    sourceName: listing.sourceName,
    sourceUrl: listing.sourceUrl,
    attributionLabel: listing.attributionLabel,
    attributionUrl: listing.attributionUrl,
    publishedAt: listing.publishedAt,
    retrievedAt: listing.retrievedAt,
    kind: "metadata_only",
  };
}
