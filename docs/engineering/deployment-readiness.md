# Deployment readiness

## Current state

The application is a Node.js Next.js server plus a separate PostgreSQL-backed material worker. Development can use hosted Supabase or the guarded local Supabase workflow; Ollama remains an optional local embedding provider. The Gemini embedding endpoint/model has been exercised with synthetic content, including a successful local PDF-to-grounded-Learn smoke test. Migration 0010 and this workflow were verified only on isolated local Supabase. Neither hosted Supabase project has been migrated or verified for these changes. No production host or production Supabase project has been selected or verified, and no deployment was performed.

Remote OK remains a bounded, development-only metadata-and-direct-link pilot. A separate opt-in Himalayas path can return limited, attributed metadata-only related listings under freshness and per-listing validation; it does not inspect job descriptions to verify skill requirements and is not production-approved. Neither path establishes that an employer requires a lecture-derived skill. M8's excerpt-backed acceptance remains blocked; the synthetic preview is clearly labeled, not persisted, and disabled by the server in production. Keep description use, excerpts, caching, persistence, and production job retrieval/display disabled unless the specific permission and operational gates are established.

A private PostgreSQL daily reservation mechanism is implemented for Remote OK as a future safeguard: one atomic reservation per attempted upstream request, capped at four per UTC day across web instances, with fail-closed behavior. On 2026-10-11, the hardened hosted integration suite applied and tested the migration in the separate Miva Buddy Test Supabase project; all six integration tests passed. That project and its reusable test infrastructure are retained. The migration has not been applied to the main Miva Buddy (Website) Supabase project or a production database. The Learn route still requires `NODE_ENV=development` and `REMOTEOK_METADATA_PILOT=true`; this counter does not activate production retrieval or grant source approval. Any future production use requires separate source approval and deployment decisions, applying/verifying the migration in the approved production database, confirming the server-only `DATABASE_URL` role can execute the function while student-facing Supabase roles cannot access the table/function, and completing the relevant production checks. The existing 60-second spacing check remains process-local, not global.

## Runtime topology

Production needs two long-running Node-compatible processes:

1. Web: build with `npm run build`, then run `npm run start` (or the host's equivalent Node start command).
2. Worker: local development commands `npm run worker:dev` and the guarded combined launcher `npm run dev:local-pdf-gemini` exist. The standalone worker command uses `tsx` from development dependencies and is not a production start command. Add and verify a production worker build/start command before release; supervise/restart it independently from the web process. Gemini embeddings remove the worker's dependency on Ollama when explicitly selected, but do not remove the separate worker process or its PostgreSQL/pg-boss dependency. Persistent production worker hosting has not been verified.

Do not deploy the worker on an edge runtime. It uses PostgreSQL, pg-boss, PDF extraction, and embeddings. Both processes share PostgreSQL but need independent connection pools and monitoring. Ollama must be reachable only when explicitly selected; Gemini removes that local-service dependency but still requires the worker to run online.

## Environment configuration

Set these in the hosting provider's encrypted environment manager. Never put secret values in the repository, a `NEXT_PUBLIC_` variable, client-side code, build logs, or documentation.

| Variable | Required | Purpose |
|---|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project origin. Public identifier, not a credential. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable key; browser-visible and safe only with the project's RLS/grants. |
| `DATABASE_URL` | Yes for worker and current database-backed actions | PostgreSQL connection for pg-boss and server-side transaction/retry operations. Use a provider-compatible connection pool and keep it server-only. |
| `AI_PROVIDER` | Yes | Production should select an implemented real provider, not `fake`. |
| `GEMINI_API_KEY` | If `AI_PROVIDER=gemini` | Server-side generation credential. |
| `GEMINI_MODEL` | Optional | Defaults to the currently evaluated model ID; re-run Miva Buddy structured evaluations before changing it. |
| `GROQ_API_KEY` | If `AI_PROVIDER=groq` | Server-side alternate generation credential. |
| `GROQ_MODEL` | Optional | Groq adapter model override. |
| `EMBEDDING_PROVIDER` | Yes for course processing | Explicitly choose `gemini` for hosted embeddings, `ollama` for local development, or `fake` only in non-production tests. Production rejects the fake provider and does not fall back when Gemini is selected but unconfigured. |
| `GEMINI_API_KEY` | If `EMBEDDING_PROVIDER=gemini` | Server-side key used by both existing Gemini generation and the Gemini embedding adapter. Confirm account quotas and data-use terms before sending student material. |
| `GEMINI_EMBEDDING_MODEL` | Optional | Defaults to `gemini-embedding-2`; the adapter requests 768 dimensions and uses consistent retrieval task formatting. |
| `OLLAMA_BASE_URL` | If `EMBEDDING_PROVIDER=ollama` | Private/reachable Ollama endpoint for the worker; not needed when Gemini is selected. Never expose it to the browser. |
| `OLLAMA_EMBEDDING_MODEL` | If `EMBEDDING_PROVIDER=ollama` | Local development embedding model; do not mix its vectors with a different provider/model. |

Do not pass a Supabase service-role key to the browser. The current repository does not require one for normal student requests. Keep anonymous Auth enabled; email/password sign-in is not part of the MVP. Configure platform CAPTCHA/abuse protection for anonymous sign-in before allowing unrestricted public traffic.

## Supabase release preparation

- Use a dedicated production Supabase project, separate from development and tests.
- Enable anonymous sign-in and global signup; keep the `course-materials` bucket private.
- Confirm RLS and Storage policies are enabled for every owner-scoped table and object operation.
- Apply reviewed migrations `0000_profiles.sql` through `0010_embedding_model_retrieval_filter.sql` in order when adopting the current code. Migration 0010 changes the grounded retrieval RPC to filter by embedding model/format; it was applied and verified only on the isolated local Supabase database, not on either hosted project. The ordered chain also includes 0009's private budget safeguard, which does not activate Remote OK. Existing materials must be reprocessed with the selected model before they are retrievable under it. For an existing database, first verify migration-history state; do not rerun raw SQL or write a migration baseline blindly. Do not enable Remote OK without separate source approval.
- Configure a PostgreSQL connection compatible with both web requests and the worker's pg-boss session/notification behavior. Validate pool size against the selected host and Supabase plan.
- Test signup, profile persistence, Storage access, migrations, RLS isolation, worker retry, and cleanup using synthetic identities/content before accepting student data.
- Configure backups/PITR and verify recovery before production use.

## Security and operations checklist

- Use HTTPS. Production responses receive baseline browser security headers, including HSTS; verify those headers at the chosen host and ensure all subdomains covered by its HSTS policy are HTTPS-capable.
- Store secrets in host-managed encrypted settings. Restrict production project and key access to least privilege; rotate secrets using documented incident steps.
- Keep web and worker on Node.js runtimes. The PDF, PostgreSQL, pg-boss, and Ollama integrations are not edge-runtime compatible; selecting Gemini removes Ollama from the worker's required runtime services.
- Configure provider quotas/billing alerts, per-user rate limits, worker concurrency, queue age/failure alerts, database connection limits, and request/upload size limits. Current route limits are eight user messages per minute, 16 KiB JSON requests, 10 MiB PDFs, 120 PDF pages, and 100,000 characters for pasted notes. These application controls do not replace edge/WAF abuse controls or provider-side quotas.
- The web application currently reports sanitized operation outcomes and worker reason codes; it does not include a full metrics backend, distributed tracing, or error-reporting vendor. Select/configure one before a public release without capturing prompts, uploads, signed URLs, credentials, or raw provider/database errors.
- The production dependency audit currently reports zero vulnerabilities. The full development dependency audit still flags the `braces` package used through the Next ESLint glob tooling and a moderate `esbuild` advisory under Drizzle Kit's legacy nested loader; re-run `npm audit` after upstream fixes and before release.
- Verify that signed PDF capabilities remain private and short-lived, and that the web server never returns provider credentials or privileged database values.
- Confirm data-retention, user-requested deletion, recovery, and incident-response procedures. Anonymous accounts have no cross-device recovery; account-level deletion requires a deliberate production operations path and is not currently exposed as a student self-service action.
- Keep course-grounded AI use on a service whose data-use terms and billing tier have been approved for the content being sent.

## Release limitations and decisions still needed

The following prevent a fully live public MVP release; no source permission outreach is being requested in this development phase:

1. Remote OK is limited to its development-only metadata/direct-link pilot. Himalayas is a separate opt-in, metadata-only related-listing path with strict feed and listing freshness checks. Neither is production-approved or verifies job-description skill requirements. Do not use descriptions, display excerpts, or cache/persist results. M8's excerpt-backed evidence acceptance remains blocked.
2. A deployment provider and production domain have not been selected. The choice must support a Node.js web server and a separately supervised long-running worker, private environment variables, and outbound PostgreSQL connectivity (plus Ollama only if that provider is explicitly chosen).
3. Local synthetic Gemini document/query embedding and the synthetic PDF ingestion-to-grounded-retrieval journey have passed; they do not establish hosted-database or production readiness. Before production use, review the selected Gemini account's quotas/data-use terms, apply and verify migration 0010 on the separately approved target, reprocess existing material with Gemini as needed, and perform controlled hosted verification. The separate worker still needs an independently hosted, supervised runtime.
4. Production Supabase Auth abuse protection, backups/PITR, provider budgets, monitoring, and retention/deletion operations must be configured and verified.

General company interview preparation and user-directed Hacker News/LeetCode Discuss search links are implemented and intended for the first public release. The recent-only links passed manual browser testing, but broader hosted E2E and release acceptance remain incomplete. The links are external searches, not verified candidate accounts; automated retrieval is unavailable. No public deployment has occurred. Until the release and operational gates above are resolved, describe the app as a development prototype, not a publicly deployed product. Do not report M9 or the MVP as complete solely because the code builds or development Supabase checks pass.

The General Learn Markdown renderer has passed visual browser verification. Course-grounded Learn Markdown still requires its final visual regression check; automated coverage does not substitute for that review.
