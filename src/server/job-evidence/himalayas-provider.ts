import "server-only";
import { jobReferenceSchema, type JobEvidenceResult, type JobReference } from "@/contracts/job-evidence";
import { checkEvidenceFreshness } from "@/server/job-evidence/freshness";
import { requireEvidencePermission, type EvidenceUseGrant } from "@/server/job-evidence/permissions";
import type { JobEvidenceProvider, JobEvidenceQuery } from "@/server/job-evidence/provider";
import { canonicalJobSkills } from "@/server/job-evidence/skills";

const endpoint = "https://himalayas.app/jobs/api/search";
const resultLimit = 3;
const perDayLimit = 4;
const minIntervalMs = 60_000;
const requestTimeoutMs = 6_000;
const maxResponseBytes = 2_000_000;
const maxListingAgeMs = 30 * 24 * 60 * 60 * 1_000;
const maxApiRefreshAgeMs = 48 * 60 * 60 * 1_000;

type RequestGate = (now: Date) => number | null;

/** Per-process request safeguard only; production-wide quota needs shared coordination. */
export function createHimalayasRequestGate(): RequestGate {
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

/** API-specific grant covers retrieval and attributed metadata display only. */
export const himalayasMetadataGrant: EvidenceUseGrant = Object.freeze({
  retrieve: "permitted",
  display_metadata: "permitted",
  display_excerpt: "unclear",
  cache: "unclear",
});

export function isHimalayasMetadataEnabled(flag: string | undefined): boolean {
  return flag === "true";
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
  return typeof value === "string" ? value.trim() : "";
}

function parseTimestamp(value: unknown): string | null {
  let epoch: number;
  if (typeof value === "number" && Number.isFinite(value)) epoch = value;
  else {
    const text = asText(value);
    if (!text) return null;
    epoch = Date.parse(text);
  }
  if (!Number.isFinite(epoch) || epoch <= 0) return null;
  try {
    const date = new Date(epoch);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  } catch {
    return null;
  }
}

function canonicalTerm(value: string): string | undefined {
  const sought = value.trim().toLowerCase();
  return canonicalJobSkills.find(({ term, aliases }) =>
    term.toLowerCase() === sought || aliases.some((alias) => alias.toLowerCase() === sought))?.term;
}

function validHimalayasUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (url.hostname === "himalayas.app" || url.hostname === "www.himalayas.app")
      && url.pathname.startsWith("/jobs/")
      && !url.username
      && !url.password
      && !url.port;
  } catch {
    return false;
  }
}

/** Projects only documented metadata; excerpt/description fields are never accessed. */
export function normalizeHimalayasReference(
  value: unknown,
  retrievedAt: string,
  grant: EvidenceUseGrant = himalayasMetadataGrant,
): JobReference | null {
  requireEvidencePermission(grant, "display_metadata");
  const row = asRecord(value);
  const postingId = asText(row.guid);
  const title = asText(row.title);
  const company = asText(row.companyName);
  const sourceUrl = asText(row.applicationLink);
  const publishedAt = parseTimestamp(row.pubDate);
  const expiresAt = parseTimestamp(row.expiryDate);
  if (!postingId || postingId.length > 160 || !title || title.length > 240 || !company || company.length > 200
    || !publishedAt || !expiresAt || !validHimalayasUrl(sourceUrl)) return null;
  const publishedTime = Date.parse(publishedAt);
  const expiryTime = Date.parse(expiresAt);
  const retrievedTime = Date.parse(retrievedAt);
  if (!Number.isFinite(retrievedTime) || expiryTime <= retrievedTime
    || checkEvidenceFreshness(publishedAt, new Date(retrievedTime), maxListingAgeMs) !== "fresh") return null;

  const parsed = jobReferenceSchema.safeParse({
    providerId: "himalayas",
    postingId,
    title,
    company,
    location: null,
    tags: [],
    matchedTags: [],
    sourceName: "Himalayas",
    sourceUrl,
    attributionLabel: "Source: Himalayas",
    attributionUrl: "https://himalayas.app/",
    publishedAt: new Date(publishedTime).toISOString(),
    retrievedAt,
    kind: "metadata_only",
  });
  return parsed.success ? parsed.data : null;
}

function retryAfterSeconds(response: Response): number | null {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isInteger(seconds) && seconds > 0 ? seconds : null;
}

/** One-keyword, one-page API search. No descriptions are projected, stored, or cached. */
export function createHimalayasJobEvidenceProvider(options: ProviderOptions = {}): JobEvidenceProvider {
  const grant = options.grant ?? himalayasMetadataGrant;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const requestGate = options.requestGate ?? createHimalayasRequestGate();

  return {
    async search(query: JobEvidenceQuery, signal?: AbortSignal): Promise<JobEvidenceResult> {
      requireEvidencePermission(grant, "retrieve");
      requireEvidencePermission(grant, "display_metadata");
      const term = query.terms.map((value) => typeof value === "string" ? canonicalTerm(value) : undefined)
        .find((value): value is string => value !== undefined)?.slice(0, 80);
      if (!term) return { status: "no_evidence" };

      const requestTime = now();
      const waitSeconds = requestGate(requestTime);
      if (waitSeconds !== null) return { status: "rate_limited", retryAfterSeconds: waitSeconds };

      const url = new URL(endpoint);
      url.searchParams.set("q", term);
      url.searchParams.set("sort", "recent");
      url.searchParams.set("page", "1");
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
      if (response.status === 429) return { status: "rate_limited", retryAfterSeconds: retryAfterSeconds(response) };
      if (!response.ok) return { status: "failed", retryable: response.status >= 500 };

      let payload: unknown;
      try {
        const text = await response.text();
        if (new TextEncoder().encode(text).byteLength > maxResponseBytes) return { status: "failed", retryable: false };
        payload = JSON.parse(text);
      } catch {
        return { status: "failed", retryable: false };
      }
      const root = asRecord(payload);
      if (!Array.isArray(root.jobs)) return { status: "failed", retryable: false };

      const retrievedTime = now();
      const apiUpdatedAt = parseTimestamp(root.updatedAt);
      if (!apiUpdatedAt || checkEvidenceFreshness(apiUpdatedAt, retrievedTime, maxApiRefreshAgeMs) !== "fresh") {
        return { status: "failed", retryable: true };
      }
      const retrievedAt = retrievedTime.toISOString();
      const seen = new Set<string>();
      const items = root.jobs.slice(0, 20).flatMap((row) => {
        const item = normalizeHimalayasReference(row, retrievedAt, grant);
        if (!item || seen.has(item.postingId)) return [];
        seen.add(item.postingId);
        return [item];
      }).slice(0, resultLimit);
      return items.length > 0 ? { status: "references_only", items } : { status: "no_evidence" };
    },
  };
}
