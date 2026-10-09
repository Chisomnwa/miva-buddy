import "server-only";
import { jobReferenceSchema, type JobEvidenceResult, type JobReference } from "@/contracts/job-evidence";
import { canonicalJobSkills } from "@/server/job-evidence/skills";
import { checkEvidenceFreshness } from "@/server/job-evidence/freshness";
import { requireEvidencePermission, type EvidenceUseGrant } from "@/server/job-evidence/permissions";
import type { JobEvidenceProvider, JobEvidenceQuery } from "@/server/job-evidence/provider";

const endpoint = "https://remoteok.com/api";
const resultLimit = 3;
const perDayLimit = 4;
const minIntervalMs = 60_000;
const maxRequestAgeMs = 60_000;
const maxListingAgeMs = 30 * 24 * 60 * 60 * 1_000;
const requestTimeoutMs = 6_000;

type RequestGate = (now: Date) => number | null;

/** Conservative process-local pilot cap; intentionally no response cache. */
export function createRemoteOkRequestGate(): RequestGate {
  let day = "";
  let used = 0;
  let lastRequestAt = Number.NEGATIVE_INFINITY;
  return (now) => {
    const currentDay = now.toISOString().slice(0, 10);
    if (currentDay !== day) {
      day = currentDay;
      used = 0;
      lastRequestAt = Number.NEGATIVE_INFINITY;
    }
    const waitMs = minIntervalMs - (now.getTime() - lastRequestAt);
    if (waitMs > 0) return Math.ceil(waitMs / 1_000);
    if (used >= perDayLimit) {
      return Math.max(1, Math.ceil((Date.parse(`${day}T23:59:59.999Z`) - now.getTime()) / 1_000));
    }
    used += 1;
    lastRequestAt = now.getTime();
    return null;
  };
}

export const remoteOkMetadataGrant: EvidenceUseGrant = Object.freeze({
  retrieve: "permitted",
  display_metadata: "permitted",
  display_excerpt: "unclear",
  cache: "unclear",
});

export function isRemoteOkMetadataPilotEnabled(nodeEnvironment: string | undefined, flag: string | undefined): boolean {
  return nodeEnvironment === "development" && flag === "true";
}

type ProviderOptions = {
  grant?: EvidenceUseGrant;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  requestGate?: RequestGate;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asText(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const epoch = value < 100_000_000_000 ? value * 1_000 : value;
    return new Date(epoch).toISOString();
  }
  const raw = asText(value);
  if (!raw) return null;
  if (/^\d{10,13}$/u.test(raw)) {
    const epoch = Number(raw);
    return new Date(raw.length <= 10 ? epoch * 1_000 : epoch).toISOString();
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function normalizedTag(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/gu, " ");
}

function skillForTerm(term: string) {
  const sought = normalizedTag(term);
  return canonicalJobSkills.find(({ term: canonical, aliases }) =>
    [canonical, ...aliases].some((candidate) => normalizedTag(candidate) === sought));
}

function validRemoteOkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "remoteok.com"
      && url.pathname.startsWith("/remote-jobs/")
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

const softwareRolePattern = /\b(?:software|front[ -]?end|back[ -]?end|full[ -]?stack|web (?:application )?(?:developer|engineer)|mobile (?:app )?(?:developer|engineer)|devops|sre|platform engineer|programmer)\b/iu;

/** Maps only documented listing metadata; description fields are never read. */
export function normalizeRemoteOkReference(
  value: unknown,
  retrievedAt: string,
  matchedTerm: string,
  grant: EvidenceUseGrant = remoteOkMetadataGrant,
): JobReference | null {
  requireEvidencePermission(grant, "display_metadata");
  const row = asRecord(value);
  const postingId = asText(row.id) || asText(row.slug);
  const title = asText(row.position);
  const company = asText(row.company);
  const sourceUrl = asText(row.url);
  const location = asText(row.location) || null;
  const skill = skillForTerm(matchedTerm);
  if (!postingId || !title || !company || !skill || !softwareRolePattern.test(title) || !validRemoteOkUrl(sourceUrl)) return null;

  const tags = Array.isArray(row.tags)
    ? [...new Set(row.tags.filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim()).filter((tag) => tag.length > 0 && tag.length <= 80))].slice(0, 20)
    : [];
  const matchingSpellings = new Set([skill.term, ...skill.aliases].map(normalizedTag));
  const matchedTags = tags.filter((tag) => matchingSpellings.has(normalizedTag(tag))).slice(0, 10);
  if (matchedTags.length === 0) return null;

  const parsed = jobReferenceSchema.safeParse({
    providerId: "remoteok",
    postingId,
    title,
    company,
    location,
    tags,
    matchedTags,
    sourceName: "Remote OK",
    sourceUrl,
    attributionLabel: "Source: Remote OK",
    attributionUrl: "https://remoteok.com/",
    publishedAt: parseTimestamp(row.date),
    retrievedAt,
    kind: "metadata_only",
  });
  return parsed.success ? parsed.data : null;
}

function parseRetryAfter(response: Response): number | null {
  const value = Number(response.headers.get("retry-after"));
  return Number.isInteger(value) && value > 0 ? value : null;
}

/** Live metadata-only adapter; no descriptions, persistence, redirects, or cache. */
export function createRemoteOkJobEvidenceProvider(options: ProviderOptions = {}): JobEvidenceProvider {
  const grant = options.grant ?? remoteOkMetadataGrant;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const requestGate = options.requestGate ?? createRemoteOkRequestGate();

  return {
    async search(query: JobEvidenceQuery, signal?: AbortSignal): Promise<JobEvidenceResult> {
      requireEvidencePermission(grant, "retrieve");
      requireEvidencePermission(grant, "display_metadata");
      const skill = query.terms.map(skillForTerm).find((candidate) => candidate !== undefined);
      if (!skill) return { status: "no_evidence" };

      const requestTime = now();
      const retryAfterSeconds = requestGate(requestTime);
      if (retryAfterSeconds !== null) return { status: "rate_limited", retryAfterSeconds };

      const url = new URL(endpoint);
      url.searchParams.set("tags", `dev,${skill.term.toLowerCase()}`);
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "GET",
          headers: { accept: "application/json" },
          cache: "no-store",
          redirect: "error",
          signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(requestTimeoutMs)]) : AbortSignal.timeout(requestTimeoutMs),
        });
      } catch {
        return { status: "failed", retryable: true };
      }
      if (response.status === 429) return { status: "rate_limited", retryAfterSeconds: parseRetryAfter(response) };
      if (!response.ok) return { status: "failed", retryable: response.status >= 500 };

      let rows: unknown[];
      try {
        const payload: unknown = await response.json();
        if (!Array.isArray(payload)) return { status: "failed", retryable: false };
        rows = payload;
      } catch {
        return { status: "failed", retryable: false };
      }

      const retrievedTime = now();
      const requestAgeMs = retrievedTime.getTime() - requestTime.getTime();
      if (requestAgeMs < 0 || requestAgeMs > maxRequestAgeMs) return { status: "failed", retryable: true };
      const retrievedAt = retrievedTime.toISOString();
      const seen = new Set<string>();
      const items = rows.flatMap((row) => {
        const item = normalizeRemoteOkReference(row, retrievedAt, skill.term, grant);
        if (!item || !item.publishedAt
          || checkEvidenceFreshness(item.publishedAt, retrievedTime, maxListingAgeMs) !== "fresh"
          || seen.has(item.postingId)) return [];
        seen.add(item.postingId);
        return [item];
      }).slice(0, resultLimit);

      return items.length ? { status: "references_only", items } : { status: "no_evidence" };
    },
  };
}
