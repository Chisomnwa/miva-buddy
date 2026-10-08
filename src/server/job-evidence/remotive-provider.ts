import "server-only";
import type { JobEvidenceResult } from "@/contracts/job-evidence";
import type { JobEvidenceProvider, JobEvidenceQuery } from "@/server/job-evidence/provider";
import { buildEvidenceItem } from "@/server/job-evidence/matching";
import { normalizeRemotiveRecord, toMetadataReference } from "@/server/job-evidence/normalizers";
import { requireEvidencePermission, type EvidenceUseGrant } from "@/server/job-evidence/permissions";
import { canonicalJobSkills } from "@/server/job-evidence/skills";

const endpoint = "https://remotive.com/api/remote-jobs";
const perDayLimit = 4;
const minIntervalMs = 30_000;
const resultLimit = 10;
const maxPostingAgeMs = 24 * 60 * 60 * 1_000;

type RequestGate = (now: Date) => number | null;

/** Process-local guard: max four calls/day and no faster than one every 30 seconds. */
export function createRemotiveRequestGate(): RequestGate {
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
    if (used >= perDayLimit) return Math.ceil((Date.parse(`${day}T23:59:59.999Z`) - now.getTime()) / 1_000);
    used += 1;
    lastRequestAt = now.getTime();
    return null;
  };
}

type ProviderOptions = {
  grant: EvidenceUseGrant;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  requestGate?: RequestGate;
};

function aliasesFor(term: string): readonly string[] {
  return canonicalJobSkills.find((skill) => skill.term.toLowerCase() === term.toLowerCase())?.aliases ?? [];
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

function isRemotiveUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "remotive.com" || url.hostname.endsWith(".remotive.com"));
  } catch {
    return false;
  }
}

/**
 * Live Remotive adapter. It makes no persistent cache and is intentionally not
 * wired into the Learn route while the activity grant is unresolved.
 */
export function createRemotiveJobEvidenceProvider(options: ProviderOptions): JobEvidenceProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const requestGate = options.requestGate ?? createRemotiveRequestGate();

  return {
    async search(query: JobEvidenceQuery, signal?: AbortSignal): Promise<JobEvidenceResult> {
      requireEvidencePermission(options.grant, "retrieve");
      requireEvidencePermission(options.grant, "display_metadata");
      const term = query.terms[0]?.trim();
      if (!term || term.length > 80) return { status: "failed", retryable: false };

      const requestTime = now();
      const retryAfterSeconds = requestGate(requestTime);
      if (retryAfterSeconds !== null) return { status: "rate_limited", retryAfterSeconds: Math.max(1, retryAfterSeconds) };

      const url = new URL(endpoint);
      url.searchParams.set("search", term);
      url.searchParams.set("limit", String(resultLimit));
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: "GET",
          headers: { accept: "application/json" },
          cache: "no-store",
          redirect: "error",
          signal: signal ?? AbortSignal.timeout(8_000),
        });
      } catch {
        return { status: "failed", retryable: true };
      }
      if (response.status === 429) {
        const seconds = Number(response.headers.get("retry-after"));
        return { status: "rate_limited", retryAfterSeconds: Number.isInteger(seconds) && seconds > 0 ? seconds : null };
      }
      if (!response.ok) return { status: "failed", retryable: response.status >= 500 };

      let rows: unknown[];
      try {
        const payload = object(await response.json());
        rows = Array.isArray(payload.jobs) ? payload.jobs.slice(0, resultLimit) : [];
      } catch {
        return { status: "failed", retryable: false };
      }

      const retrievedAt = now().toISOString();
      const candidates = rows.flatMap((row) => {
        const listing = normalizeRemotiveRecord(row, retrievedAt);
        return listing && isRemotiveUrl(listing.sourceUrl) ? [listing] : [];
      });

      if (options.grant.display_excerpt === "permitted") {
        const items = candidates.flatMap((listing) => {
          const item = buildEvidenceItem(listing, term, aliasesFor(term), options.grant, now(), maxPostingAgeMs);
          return item ? [item] : [];
        });
        return items.length ? { status: "found", items } : { status: "no_evidence" };
      }

      const items = candidates.map((listing) => toMetadataReference(listing, options.grant));
      return items.length ? { status: "references_only", items } : { status: "no_evidence" };
    },
  };
}
