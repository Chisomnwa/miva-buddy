# Deployment readiness

## Current state

The application builds as a Node.js Next.js server plus a separate PostgreSQL-backed material worker. Development uses hosted Supabase and can use local Ollama. No production host, production Supabase project, or production embedding endpoint has been selected or verified. No deployment was performed.

M7 live-source approval and the live-evidence acceptance criteria in M8 remain blocked release limitations. The synthetic industry preview is development-only, is not persisted or linked to a real source, and is disabled by the server in production. Keep source selection and display permission gates fail-closed.

## Runtime topology

Production needs two long-running Node-compatible processes:

1. Web: build with `npm run build`, then run `npm run start` (or the host's equivalent Node start command).
2. Worker: a local development command, `npm run worker:dev`, exists. It uses `tsx` from development dependencies and is not a production start command. Add and verify a production worker build/start command before release; supervise/restart it independently from the web process.

Do not deploy the worker on an edge runtime. It uses PostgreSQL, pg-boss, PDF extraction, and embeddings. Both processes share PostgreSQL but need independent connection pools and monitoring. The worker's Ollama endpoint must be reachable from its host.

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
| `EMBEDDING_PROVIDER` | Yes for course processing | Current implemented production-capable adapter is `ollama`; no hosted embedding adapter is implemented. |
| `OLLAMA_BASE_URL` | Yes for current embedding adapter | Private/reachable Ollama service endpoint used by the worker; do not expose it to the browser. |
| `OLLAMA_EMBEDDING_MODEL` | Yes for current embedding adapter | Must remain compatible with the existing 768-dimensional stored vectors unless a reviewed re-embedding migration is completed. |

Do not pass a Supabase service-role key to the browser. The current repository does not require one for normal student requests. Keep anonymous Auth enabled; email/password sign-in is not part of the MVP. Configure platform CAPTCHA/abuse protection for anonymous sign-in before allowing unrestricted public traffic.

## Supabase release preparation

- Use a dedicated production Supabase project, separate from development and tests.
- Enable anonymous sign-in and global signup; keep the `course-materials` bucket private.
- Confirm RLS and Storage policies are enabled for every owner-scoped table and object operation.
- Apply the reviewed migrations `0000_profiles.sql` through `0007_practice_coaching.sql` in order. For an existing database, first verify migration-history state; do not rerun raw SQL or write a migration baseline blindly.
- Configure a PostgreSQL connection compatible with both web requests and the worker's pg-boss session/notification behavior. Validate pool size against the selected host and Supabase plan.
- Test signup, profile persistence, Storage access, migrations, RLS isolation, worker retry, and cleanup using synthetic identities/content before accepting student data.
- Configure backups/PITR and verify recovery before production use.

## Security and operations checklist

- Use HTTPS. Production responses receive baseline browser security headers, including HSTS; verify those headers at the chosen host and ensure all subdomains covered by its HSTS policy are HTTPS-capable.
- Store secrets in host-managed encrypted settings. Restrict production project and key access to least privilege; rotate secrets using documented incident steps.
- Keep web and worker on Node.js runtimes. The PDF, PostgreSQL, pg-boss, and Ollama integrations are not edge-runtime compatible.
- Configure provider quotas/billing alerts, per-user rate limits, worker concurrency, queue age/failure alerts, database connection limits, and request/upload size limits. Current route limits are eight user messages per minute, 16 KiB JSON requests, 10 MiB PDFs, 120 PDF pages, and 100,000 characters for pasted notes. These application controls do not replace edge/WAF abuse controls or provider-side quotas.
- The web application currently reports sanitized operation outcomes and worker reason codes; it does not include a full metrics backend, distributed tracing, or error-reporting vendor. Select/configure one before a public release without capturing prompts, uploads, signed URLs, credentials, or raw provider/database errors.
- The production dependency audit currently reports zero vulnerabilities. The full development dependency audit still flags the `braces` package used through the Next ESLint glob tooling and a moderate `esbuild` advisory under Drizzle Kit's legacy nested loader; re-run `npm audit` after upstream fixes and before release.
- Verify that signed PDF capabilities remain private and short-lived, and that the web server never returns provider credentials or privileged database values.
- Confirm data-retention, user-requested deletion, recovery, and incident-response procedures. Anonymous accounts have no cross-device recovery; account-level deletion requires a deliberate production operations path and is not currently exposed as a student self-service action.
- Keep course-grounded AI use on a service whose data-use terms and billing tier have been approved for the content being sent.

## Release limitations and decisions still needed

The following prevent a fully live public MVP release; no source permission outreach is being requested in this development phase:

1. M7 source approval and M8's real-evidence acceptance remain blocked. Do not switch on real job retrieval, metadata/excerpt display, or caching.
2. A deployment provider and production domain have not been selected. The choice must support a Node.js web server and a separately supervised long-running worker, private environment variables, and outbound PostgreSQL/Ollama connectivity.
3. A production-capable embedding topology must be chosen. Today the implemented course-processing path uses Ollama; the worker needs a private service endpoint with `nomic-embed-text` loaded, or a separately designed/evaluated hosted adapter.
4. Production Supabase Auth abuse protection, backups/PITR, provider budgets, monitoring, and retention/deletion operations must be configured and verified.

Until these gates are resolved, describe the app as a development prototype, not a public live MVP. Do not report M9 or the definition of MVP as complete solely because the code builds or the development Supabase checks pass.
