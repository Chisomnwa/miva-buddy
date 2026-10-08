# Milestone 8 — Contextual industry evidence

## Current implementation state

M8 is **Blocked** only on live-evidence acceptance. Its unblocked development-only synthetic-preview work is implemented. The M7 source-approval gate remains **Blocked** for live data; this implementation does not claim M7 is complete and does not use real job records.

The grounded Learn response flow may return a development-only demonstration when retrieved course passages directly mention a skill in the canonical registry. The server derives that skill from retrieved course chunks—not from the student's question or model response. The strict `IndustryDemo` schema is deliberately distinct from `JobEvidenceItem`, contains no source URL, and displays an unmissable “DEMONSTRATION ONLY — NOT A REAL JOB POSTING” label. It is not saved to the database. The server function returns no demo in production.

Real-source building blocks currently include pure Remotive/Greenhouse/Ashby/Lever record normalizers, direct support matching, excerpt bounds, attribution fields, freshness handling, and separate typed metadata-only results. A server-only Remotive adapter now exists behind per-activity explicit permission grants. It is not wired to Learn, has no cache, and has no configured grant. ATS integrations remain pure normalizers; no ATS live requests were made. Full source/rights analysis is in [`milestone-7-job-evidence-source-evaluation.md`](milestone-7-job-evidence-source-evaluation.md).

## Verification completed

- Synthetic UI/contract tests confirm the demo is clearly labeled, has no posting URL, rejects attempts to turn it into source evidence, and cannot be returned in production.
- Course matching is restricted to retrieved material and controlled canonical terms/aliases; e.g. DSA language does not imply a programming skill.
- Remotive adapter tests use mocked fixtures only and cover fail-closed permission checks, metadata-only versus excerpt outcomes, Remotive attribution and listing URL, bounded single-term query, no HTTP cache/redirects, false-positive rejection, and conservative process-local call limits.
- Current full suite: 108 passed, 1 optional local Ollama integration skipped by default (the opt-in synthetic Ollama integration also passes). `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run check:secrets` pass. Default desktop/mobile `npm run test:e2e`: 10 passed, 12 hosted/configuration tests intentionally skipped. The targeted hosted grounded-Learn E2E passes after adding abort-signal propagation to the retrieval RPC; see `docs/engineering/milestone-9-integration-hardening.md`.

## Not implemented / not verified

- No real job source has an activity grant in runtime configuration.
- No real listing was fetched, stored, cached, matched, or displayed in this work.
- No live provider coverage, closure/removal, availability, or manual provenance test was run.
- Metadata-and-link-only output is not shown in Learn; it is not automatically permitted and is not represented as skill evidence.
- The Remotive request limit guard is process-local and is insufficient for a multi-instance public service; do not use it as production quota enforcement.
- Automated live-evidence-found, no-result, source-failure, freshness, and disappearing-posting E2E flows remain gated on M7 source approval.

## Gate and next work

Keep the synthetic Learn preview and source-neutral safeguards as implemented. Do not connect a real source, persist real excerpts, or label a real posting as verified until M7's source gate and controlled source evaluation pass. Do not revisit source terms or conduct outreach in this phase. M8 remains a release limitation, not a completed live-data feature.
