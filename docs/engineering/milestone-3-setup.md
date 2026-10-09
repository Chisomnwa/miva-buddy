# Milestone 3 setup and dependency record

## Current state

Milestone 3 is Complete. The Session pooler connection in ignored `.env.local` authenticates successfully; the database password's `@` is percent-encoded as `%40`. The private `course-materials` bucket is confirmed. Migrations `0002`–`0004` are applied: all six course/material tables have RLS enabled, `pgvector` 0.8.2 is installed, owner-scoped Storage policies are present, queued pasted notes may be inserted as provenance pages, and page storage supports the documented 500,000-character extraction cap. No URI, project reference, username, host, or secret is recorded here. Only synthetic course text has been sent to Gemini during evaluation.

## Required worker database connection

The Session pooler connection was verified read-only and used successfully by the Drizzle migrations and pg-boss worker. The password's `@` is `%40`; keep the full URI in ignored `.env.local` and never paste it into chat. Use the Session pooler for the worker; do not configure a transaction pooler for session-pinned `LISTEN/NOTIFY`. `npm run worker:dev` starts the separate worker and was verified against hosted PostgreSQL. See [Supabase database connection options](https://supabase.com/docs/guides/database/connecting-to-postgres) and [pg-boss worker connection requirements](https://github.com/timgit/pg-boss/blob/master/docs/api/workers.md).

After authentication succeeds, verify a read-only connection and confirm the bucket is private before applying migrations or creating worker state. Keep the URI server-side and ignored by Git.

## Storage and embeddings

- The `course-materials` bucket is confirmed private. Migration `drizzle/0002_courses_and_materials.sql` installed three owner-scoped `storage.objects` policies for reads, uploads, and deletes. Do not edit Storage's internal metadata tables directly or create a public bucket. Supabase private buckets enforce access through Storage RLS or time-limited signed URLs. See [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) and [private bucket behavior](https://supabase.com/docs/guides/storage/buckets/fundamentals).
- Initial development embeddings use a local Ollama embedding adapter so uploaded course contents stay on the machine. `nomic-embed-text:latest` is installed (274 MB) and selected through `EMBEDDING_PROVIDER=ollama` in ignored `.env.local`. Both a direct local `/api/embed` probe and `npm run test:embeddings:ollama` through the repository adapter passed on two synthetic strings with consistent, finite 768-dimensional vectors. No course or student content was used. `qwen2.5-coder:7b` remains installed as a generation model and is not used for embeddings. See [Ollama `nomic-embed-text`](https://ollama.com/library/nomic-embed-text).
- Gemini remains available for synthetic M3 schema evaluation, but do not send real uploaded course materials to an unpaid hosted tier. Any future hosted embedding option requires a separate model/schema evaluation and review of current data-use terms.

## M3 implementation boundary

The web routes and owner-authenticated server actions support course listing/creation, PDFs and pasted notes, material status, source-backed concepts, and retry for queue/worker failures. The worker is a separate pg-boss process. It receives owner-scoped IDs and, for PDFs, a six-hour signed-URL capability held only in private queue data; that capability is never returned to the browser or logged. Worker SQL explicitly scopes reads/writes by user, course, and material; composite foreign keys bind sources to chunks from the same owner/material. Output replacement is transactional.

Implemented bounds and behavior:

- PDF: maximum 10 MiB, 120 pages, and 500,000 extracted characters; validate `%PDF-` signature and process page by page. Empty, corrupt, image-only/text-empty, too-large, and over-page-limit files fail safely. OCR and other formats are out of scope.
- Pasted notes: maximum 100,000 characters, normalized as page 1 and processed through the same pipeline.
- Chunking: deterministic 1,200-character chunks with 120-character overlap, no cross-page chunks, stable ordinal and page range.
- Embedding: local Ollama `nomic-embed-text:latest`; vectors must be finite and exactly 768 dimensions, stored with model metadata and a PostgreSQL HNSW index. Synthetic adapter integration passed.
- Concepts: up to six structured concepts, each citing unique supplied chunk IDs; the server validates IDs against the current material. One malformed-output retry precedes safe failure.
- Queue: pg-boss on PostgreSQL, retry limit 3 with exponential backoff, 15-minute job expiry, one worker concurrency. Duplicate sends are collapsed by material ID.
- Storage: private `course-materials`, owner-scoped path `{userId}/{courseId}/{materialId}/...`; student actions use Supabase session/RLS. No service-role key is required.

The live synthetic M3 Gemini evaluation passed the concept schema, uniqueness/source-ID checks, and a binary-search-tree relevance assertion (`npm run test:ai-evals -- tests/ai-evals/course-concepts.eval.test.ts`). The hosted synthetic M3 journey passed for notes and PDF; it verified source labels, course RLS owner/deny behavior, mobile/axe checks, and cleanup through Supabase Storage API plus exact test-user deletion. Unit, build, migration, Ollama, and local E2E checks passed. A combined provider rerun had one transient HTTP 503 in an M2 Direct Learn check; this is consistent with the already-documented provider reliability limitation. Do not send real course content to Gemini until the configured service/billing tier's current data-use terms permit it; verification used synthetic excerpts only.

At the time of the original M3 report, two interrupted synthetic `TEST-203` E2E attempts had left two course fixtures and two private PDF objects in the hosted development project. Subsequent user-directed cleanup removed the remaining Storage objects through the Dashboard and removed only the two verified synthetic course records and dependent database data. A later read-only verification reported both course records, dependent records, and Storage paths absent. The two Auth users were deliberately left untouched. This historical cleanup does not establish that any remaining anonymous test identities are disposable; the four identities/conversations noted in the current project status remain a separate controlled-review item.
