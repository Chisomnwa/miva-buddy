import type { JobEvidenceResult } from "@/contracts/job-evidence";

export type JobEvidenceQuery = {
  terms: string[];
  geography?: string;
};

/** Provider adapters normalize source data; product policy consumes only this source-neutral result. */
export interface JobEvidenceProvider {
  search(query: JobEvidenceQuery, signal?: AbortSignal): Promise<JobEvidenceResult>;
}
