# Milestone 9 — Integration, hardening, and deployment readiness

## Status

In progress. Local application hardening is implemented; M9 is not complete. M7 live-source approval and M8 live-evidence acceptance remain explicit release limitations. Production hosting has not been selected.

## Implemented

- Root/workspace loading, error, global-error, and not-found recovery boundaries; user-facing errors remain safe and do not display provider/database details.
- Central baseline security headers, with HSTS enabled only in production; powered-by header disabled.
- Fixed-dimension safe operation telemetry; no prompts, user IDs, material IDs, URLs, raw errors, or credentials.
- Course material pages refresh while work is queued/processing so completed worker results appear without manual reload.
- Development fake generation now returns contract-shaped responses for concept extraction, grounded Learn, and Practice coaching. Synthetic grounded E2E fixtures use deterministic fake embeddings. Production continues to reject fake providers.
- Development-only synthetic industry preview remains visibly labeled, non-persistent, source-free, and disabled in production.
- Deployment topology, required variable names, Supabase preparation, runtime controls, and open release decisions documented in `deployment-readiness.md`.

## Verification snapshot

- `npm test`: 106 passed; 1 optional Ollama integration test skipped by default.
- `npm run test:embeddings:ollama`: 1 synthetic test passed.
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run check:secrets`, and `git diff --check`: passed after the final implementation/dependency updates.
- `npm audit --omit=dev`: 0 production vulnerabilities. `drizzle-orm` is patched at 0.45.3 for [GHSA-gpj5-g38j-94v9](https://github.com/drizzle-team/drizzle-orm/security/advisories/GHSA-gpj5-g38j-94v9); Vitest/Tinypool is patched at 4.1.11 for [GHSA-82fw-gwwq-j7x9](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9) and the [Tinypool worker advisories](https://github.com/tinylibs/tinypool/security/advisories). Full `npm audit` still reports a high development-only [`braces` advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) with no patched release listed and moderate vulnerable [`esbuild`](https://github.com/advisories/GHSA-67mh-4wv8-2f99) nested under legacy Drizzle Kit tooling. The Next ESLint plugin uses fixed local glob patterns; no runtime request data is passed to these development-only glob APIs. Recheck when upstream packages publish fixes.
- Default Playwright run: 10 passed and 12 hosted-only checks skipped. Security-header/not-found recovery, accessibility, narrow viewport, and onboarding presentation checks passed.
- Hosted Chromium: onboarding/profile persistence and isolation, Practice lifecycle/RLS, and notes/PDF processing, concept provenance, ownership, axe, and mobile-overflow checks passed. The worker processed only synthetic E2E fixtures; no job-data source was contacted.
- Hosted Grounded Learn: the synthetic request returned HTTP 200 and the targeted journey passed citations, source restoration/inspection, cross-user RLS, axe, focus return, responsive layout, and non-persistence of the demonstration preview. Earlier hangs were addressed by propagating the route's bounded abort signal to the PostgREST retrieval RPC. A full hosted suite was not rerun after the final fix; onboarding/profile, Practice, and materials had passed individually in the preceding hosted suite.
- Safe hosted configuration check reported required variable names present/valid and PostgreSQL connected. No values were read or printed. `.env.local` remains ignored.
- No production deployment, production host smoke test, performance budget test, manual keyboard/screen-reader review, backup/restore exercise, or production operations verification has been performed.

## Additional local verification — October 12, 2026

After the synthetic Gemini embedding and local PDF workflow changes, the latest recorded local checks passed: 113 automated tests, TypeScript typecheck, ESLint, secret scan, and `git diff --check`. General Learn Markdown formatting was visually verified in the browser. Course-grounded Markdown still requires a final visual regression check. Migration 0010 and the PDF/Gemini/retrieval smoke test were verified on isolated local Supabase only; neither hosted Supabase project has been migrated or verified for these changes. Production deployment and persistent worker hosting remain unverified.

## Remaining work and release limitations

1. Run the complete hosted E2E suite once after the final grounded-Learn cancellation fix; perform the remaining manual performance/accessibility review and production-like checks from the approved M9 gate.
2. Recheck the full development dependency audit when upstream fixes for `braces` and the nested Drizzle Kit `esbuild` issue are available.
3. Select a deployment provider that supports a Node web process and separately supervised worker; configure a production Supabase project, private Storage, anonymous-auth abuse protection, hosted secrets, and a production-reachable embedding service. Verify backup/recovery and operational monitoring there.
4. Keep M7 source approval and M8 live-evidence acceptance blocked. Do not make source requests or live job-data calls; do not treat metadata/link-only content or synthetic preview as live evidence.

## Local run

From the repository root, configure ignored `.env.local`, run `npm run dev`, and open `http://localhost:3000`. For course uploads, run `npm run worker:dev` in a second terminal with the configured PostgreSQL and embedding services. See the README and deployment guide for safe configuration guidance.
