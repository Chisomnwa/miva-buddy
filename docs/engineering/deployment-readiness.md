# Deployment readiness

## Current state

The application is a Node.js Next.js server plus a PostgreSQL-backed material worker. Development can use hosted Supabase or the guarded local Supabase workflow; Ollama remains an optional local embedding provider. Migrations 0000–0013 are applied and verified on the approved hosted Miva Buddy (Website) project. The three existing `course-materials` Storage policies were updated and verified separately through the Supabase Dashboard. Render deployment and production application smoke testing have not yet occurred.

Remote OK remains a bounded, development-only metadata-and-direct-link pilot. A separate opt-in Himalayas path can return limited, attributed metadata-only related listings under freshness and per-listing validation; it does not inspect job descriptions to verify skill requirements and is not production-approved. Neither path establishes that an employer requires a lecture-derived skill. M8's excerpt-backed acceptance remains blocked; the synthetic preview is clearly labeled, not persisted, and disabled by the server in production. Keep description use, excerpts, caching, persistence, and production job retrieval/display disabled unless the specific permission and operational gates are established.

A private PostgreSQL daily reservation mechanism is implemented for Remote OK as a future safeguard: one atomic reservation per attempted upstream request, capped at four per UTC day across web instances, with fail-closed behavior. Its migration is included in the applied and verified 0000–0013 chain on Miva Buddy (Website). The separate Miva Buddy Test project and its reusable test infrastructure remain distinct. The Learn route still requires `NODE_ENV=development` and `REMOTEOK_METADATA_PILOT=true`; this counter does not activate production retrieval or grant source approval. Any future production use still requires separate source approval and release decisions. The existing 60-second spacing check remains process-local, not global.

## Runtime topology

The normal production topology has two independently supervised Node processes:

1. Web: `npm run build` builds the Next.js application and then the worker bundle; run the web process with `npm run start` (`next start`). Never use `npm run dev` (`next dev --webpack`) as a public server command.
2. Worker: keep `npm run worker:dev` and the guarded `npm run dev:local-pdf-gemini` for local development. Production builds `src/worker.ts` into `.next/worker/worker.mjs` with the development-only esbuild build tool, then runs `npm run worker:start` (`node --conditions=react-server .next/worker/worker.mjs`). The generated worker bundle externalizes runtime packages, so the runtime install must include production dependencies. Build with development dependencies available, then create the runtime environment with production dependencies only; do not ship Drizzle Kit, esbuild, tsx, or the Next development server. The worker is a separate, long-running Node process and must be independently supervised/restarted. Gemini embeddings remove its Ollama dependency only when explicitly selected. Persistent production worker hosting has not been verified.

The worker validates shared server configuration, `DATABASE_URL`, and the selected real generation/embedding providers before opening PostgreSQL or starting pg-boss. It emits only a bounded configuration-failure category; raw configuration/provider values are not included in the message. The worker has no HTTP/debug listener. The shared config parser also requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, even though these remain public identifiers rather than secrets.

### $0 Render hackathon demo (single service)

For a short demonstration only, one Render Free **web service** can run the Next server and the worker as supervised child processes. This is not an always-on worker architecture and is not a production reliability guarantee. Configure the service as follows:

| Render setting | Value |
|---|---|
| Build Command | `npm ci --include=dev && npm run build && npm prune --omit=dev` |
| Start Command | `npm run start:render-demo` |
| Health Check Path | Leave unset; this repository does not currently expose a dedicated health-check route. Do not point it at a debug or database-inspection endpoint. |

The launcher starts `next start` bound to `0.0.0.0` on Render's `PORT`. It starts the already-bundled `.next/worker/worker.mjs` as a separate Node child with no `PORT` or HTTP listener. Child environments are explicitly allow-listed; do not add credentials to `NEXT_PUBLIC_` variables. If either process exits or fails to spawn, the launcher signals the sibling and exits nonzero. On SIGTERM/SIGINT it signals both process groups and gives them a bounded grace period before force termination. Keep Render's shutdown delay at its default 30 seconds or higher than the launcher grace period.

Set the environment variables from the table below in Render's encrypted environment settings. At minimum this service needs the Supabase URL and publishable key, server-only `DATABASE_URL`, `AI_PROVIDER`, `EMBEDDING_PROVIDER`, and the credentials/models required by the selected real providers. Also configure the Gemini and course-material usage-limit variables when relying on their non-default budgets; the application has conservative defaults. Do not set `PORT` manually; Render provides it. `npm run start` continues to launch only Next, and `npm run worker` / `npm run worker:start` launch only the worker for other hosts or local operations.

Accepted limitations for this demo: Render Free sleeps after 15 minutes without inbound traffic and takes roughly a minute to wake; the worker sleeps with it. The PostgreSQL-backed pg-boss queue survives web-service sleep/restart, but queued and retryable jobs do not progress until the service wakes and the worker resumes. Free instances can restart at any time, have an ephemeral filesystem, one small shared CPU/memory allocation, no persistent disk, and no separate free background-worker service. A PDF job uses a six-hour signed Storage URL in its private queue payload. If it waits beyond URL expiry while the service is asleep or backlogged, that attempt fails safely; the existing owner-checked manual retry creates a fresh signed URL, subject to its retry limit. For a capstone demo, retry the failed material from the course page or ask the student to upload it again/paste notes. A future improvement could store only the private object path in the job and have the trusted worker mint a short-lived URL when claiming the job, but that changes the queue capability flow and should be reviewed separately; do not lengthen the URL lifetime or make the bucket public as a workaround.

This co-location is appropriate only for low-volume demonstration traffic. The current Free plan is 0.1 CPU and 512 MB RAM, shared by both processes. PDF parsing, embeddings, concept extraction, and web requests compete for those resources. A memory spike or uncaught process exit takes down the whole service; Render sleep pauses all jobs; the free service has no durable local filesystem or independent worker restart. Do not promise timely background processing or use this topology for a public production launch. Confirm current workspace usage, outbound bandwidth, build-pipeline limits, and whether a payment method/spend limit could result in charges before creating the service.

For a single self-hosted runtime directory, the dependency/artifact sequence is:

```sh
npm ci
npm run build
npm ci --omit=dev
# Run as two separately supervised processes:
npm run start
npm run worker:start
```

If build and runtime are separate stages, transfer the production Next output and `.next/worker/worker.mjs`, then install only production dependencies in the runtime stage. The worker bundle's external imports are runtime packages; `tsx`, esbuild, and Drizzle Kit are build/development tools only.

Do not deploy the worker on an edge runtime. It uses PostgreSQL, pg-boss, PDF extraction, and embeddings. Both processes share PostgreSQL but need independent connection pools and monitoring. Ollama must be reachable only when explicitly selected; Gemini removes that local-service dependency but still requires the worker to run online.

## Environment configuration

Set these in the hosting provider's encrypted environment manager. Never put secret values in the repository, a `NEXT_PUBLIC_` variable, client-side code, build logs, or documentation.

| Variable | Required | Purpose |
|---|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project origin. Public identifier, not a credential. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable key; browser-visible and safe only with the project's RLS/grants. |
| `APP_BASE_URL` | Yes in production; optional locally | Canonical public application origin used by the server-side OAuth callback. Production must use the HTTPS site origin only, with no path, query, fragment, or credentials (for example, `https://miva-buddy.onrender.com`). Local development falls back to a loopback request origin when unset. |
| `DATABASE_URL` | Yes for worker and current database-backed actions | PostgreSQL connection for pg-boss and server-side transaction/retry operations. Use a provider-compatible connection pool and keep it server-only. |
| `AI_PROVIDER` | Yes | Production should select an implemented real provider, not `fake`. |
| `GEMINI_API_KEY` | If `AI_PROVIDER=gemini` | Server-side generation credential. |
| `GEMINI_MODEL` | Optional | Defaults to the currently evaluated model ID; re-run Miva Buddy structured evaluations before changing it. |
| `GROQ_API_KEY` | If `AI_PROVIDER=groq` | Server-side alternate generation credential. |
| `GROQ_MODEL` | Optional | Groq adapter model override. |
| `EMBEDDING_PROVIDER` | Yes for course processing | Explicitly choose `gemini` for hosted embeddings, `ollama` for local development, or `fake` only in non-production tests. Production rejects the fake provider and does not fall back when Gemini is selected but unconfigured. |
| `GEMINI_API_KEY` | If `EMBEDDING_PROVIDER=gemini` | Server-side key used by both existing Gemini generation and the Gemini embedding adapter. Confirm account quotas and data-use terms before sending student material. |
| `GEMINI_EMBEDDING_MODEL` | Optional | Defaults to `gemini-embedding-2`; the adapter requests 768 dimensions and uses consistent retrieval task formatting. |
| `GEMINI_INTERACTIVE_USER_DAILY_USAGE_UNITS` | Optional | Per-user daily interactive Gemini budget; code default is 120 units. |
| `GEMINI_BACKGROUND_USER_DAILY_USAGE_UNITS` | Optional | Per-user daily background Gemini budget; code default is 600 units. |
| `GEMINI_INTERACTIVE_APP_DAILY_USAGE_UNITS` | Optional | App-wide daily interactive Gemini budget; code default is 5,000 units. |
| `GEMINI_BACKGROUND_APP_DAILY_USAGE_UNITS` | Optional | App-wide daily background Gemini budget; code default is 20,000 units. |
| `GEMINI_TOTAL_APP_DAILY_USAGE_UNITS` | Optional | Combined app-wide daily Gemini hard cap; code default is 25,000 units. |
| `GEMINI_MAX_IN_FLIGHT_REQUESTS` | Optional | Shared maximum concurrent Gemini requests; code default is 4. |
| `COURSE_MATERIAL_DAILY_COUNT_LIMIT` | Optional | Per-user daily material admission count; code default is 5. |
| `COURSE_MATERIAL_DAILY_BYTES_LIMIT` | Optional | Per-user daily aggregate material bytes; code default is 50 MiB. |
| `COURSE_MATERIAL_MANUAL_RETRY_LIMIT` | Optional | Owner-initiated processing retries per material; code default is 2. |
| `PORT` | Set by Render | Public listener port; consumed by the Next child only. Do not set it as a secret or expose it to the worker. |
| `OLLAMA_BASE_URL` | If `EMBEDDING_PROVIDER=ollama` | Private/reachable Ollama endpoint for the worker; not needed when Gemini is selected. Never expose it to the browser. |
| `OLLAMA_EMBEDDING_MODEL` | If `EMBEDDING_PROVIDER=ollama` | Local development embedding model; do not mix its vectors with a different provider/model. |

Both production processes receive the shared Supabase, database, and provider configuration; the launcher passes `APP_BASE_URL` only to the web child. Provide the required Supabase URL and publishable key, `DATABASE_URL`, and real provider selections. Provide `GEMINI_API_KEY` when either Gemini generation or embeddings are selected; provide `GROQ_API_KEY` when Groq generation is selected; and configure Ollama endpoints/models only when Ollama is selected. Keep all non-`NEXT_PUBLIC_` values in the host's encrypted server environment. The web and worker need separate processes and appropriately sized database pools; do not expose the worker as an HTTP service.

Do not pass a Supabase service-role key or Google client secret to the browser. The Google-only beta requires anonymous sign-ins disabled, Google OAuth enabled, global sign-up enabled for Google users, and the Email provider disabled. Configure the production `APP_BASE_URL` to the canonical HTTPS Render origin; the OAuth callback uses it rather than request or forwarded host/protocol headers. The local app implementation does not configure hosted Auth settings. Migration 0011 blocks anonymous JWTs from owner-scoped public tables while retaining existing `auth.uid()` ownership policies; the three `course-materials` Storage policies require the separate Dashboard edits below. Existing anonymous records are intentionally preserved and not linked or deleted.

For local Supabase, `supabase/config.toml` reads `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET` from the CLI environment. These are not Next.js browser variables. Hosted projects require provider credentials configured in that project's Supabase Auth settings; never expose the client secret to the app/browser.

## Supabase release preparation

- Use a dedicated production Supabase project, separate from development and tests.
- Disable anonymous sign-in; enable global signup for Google OAuth; disable the Email provider; configure the Google provider and exact site/callback redirect URLs; keep the `course-materials` bucket private.
- Confirm RLS and Storage policies are enabled for every owner-scoped table and object operation.
- The approved Miva Buddy (Website) project has migrations 0000–0013 applied and verified in order. Migration 0011 adds permanent-user checks to owner-scoped application tables and revokes direct anonymous-role execution of the retrieval RPC. The three existing `course-materials` Storage policies were updated separately through the Dashboard; their bucket and folder-ownership checks were preserved and the permanent-user condition was verified in the appropriate expressions. These Storage edits are not entries in the Drizzle ledger. Do not rerun migrations or write a baseline for this project. Existing materials with vectors from a different embedding model must be reprocessed before relying on the selected model's retrieval. Do not enable Remote OK without separate source approval.
- The separately managed Storage-policy change was made by editing these existing policies, not by adding a fourth permissive policy. The verified permanent-user condition is `(select auth.jwt()->>'is_anonymous') = 'false'`; the original bucket and owner-path restrictions remain:
  - `Students can read their own course material objects` — retain `bucket_id = 'course-materials'` and `(storage.foldername(name))[1] = (select auth.uid()::text)` in `USING`, then add the permanent-user condition there.
  - `Students can upload their own course material objects` — retain the same bucket and owner-path expressions in `WITH CHECK`, then add the permanent-user condition there.
  - `Students can delete their own course material objects` — retain the same bucket and owner-path expressions in `USING`, then add the permanent-user condition there.
- The Dashboard's standard policy editor creates permissive policies; adding another policy would not provide the required restrictive deny because permissive policies are combined with OR. The verified approach was to edit each existing policy without weakening its current predicates. Preserve this separately managed state; it is not recorded in the Drizzle migration ledger.
- Migration execution and the three Storage-policy edits are complete for Miva Buddy (Website). Keep the Drizzle ledger and Storage policy catalog as separate verification sources. Render deployment and production smoke testing remain pending.
- Configure a PostgreSQL connection compatible with both web requests and the worker's pg-boss session/notification behavior. Validate pool size against the selected host and Supabase plan.
- Test Google signup/sign-in, profile routing/persistence, session expiry/sign-out, Storage access, migrations, RLS isolation (including an anonymous JWT denial), worker retry, and cleanup using synthetic identities/content before accepting student data. Current legacy hosted E2E tests create anonymous identities and are not valid Google-auth coverage.
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
3. The hosted schema and Storage-policy changes are verified on Miva Buddy (Website), but production application behavior is not yet verified. Before launch, review the selected Gemini account's quotas/data-use terms, reprocess existing material with the selected embedding model as needed, configure Render, and run controlled production smoke checks. The chosen Render Free demo co-locates web and worker and has documented sleep/resource limitations; it is not an always-on worker guarantee.
4. Production Google OAuth client/provider settings, callback allowlists, Auth limits, backups/recovery, provider budgets, monitoring, and retention/deletion operations still require final configuration/verification. Render deployment and production smoke testing remain pending.

General company interview preparation and user-directed Hacker News/LeetCode Discuss search links are implemented and intended for the first public release. The recent-only links passed manual browser testing, but broader hosted E2E and release acceptance remain incomplete. The links are external searches, not verified candidate accounts; automated retrieval is unavailable. No public deployment has occurred. Until the release and operational gates above are resolved, describe the app as a development prototype, not a publicly deployed product. Do not report M9 or the MVP as complete solely because the code builds or development Supabase checks pass.

The General Learn Markdown renderer has passed visual browser verification. Course-grounded Learn Markdown still requires its final visual regression check; automated coverage does not substitute for that review.
