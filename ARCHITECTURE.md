# Miva Buddy Architecture

## Status

This document records the approved architecture and distinguishes implemented capabilities from planned capabilities. M1–M6 are complete. M7 and M8 live-evidence acceptance remain blocked. The M8 development-only synthetic preview is implemented. M9 integration and hardening are in progress; deployment/provider configuration and the intermittent hosted grounded-Learn E2E still require resolution.

As milestones are implemented, this document must evolve from a plan into a concise map of the actual codebase. Planned and implemented details must remain clearly distinguishable.

## Architectural approach

Miva Buddy will be a TypeScript modular monolith with two runtime entry points built from one repository:

- a responsive Next.js web process for the UI, trusted server endpoints, authorization, and lightweight orchestration;
- a worker process for retryable PDF extraction, material preparation, embeddings, and concept extraction.

Both processes share application, persistence, provider, validation, and configuration code. The worker is a second process, not an independently designed microservice. `src/worker.ts` runs the pg-boss queue consumer separately from the Next.js web process.

### Implemented foundation (Milestone 1 complete)

- Next.js 16 App Router, React, TypeScript, and responsive global styling are initialized.
- `src/app` contains onboarding and protected workspace routes; the workspace currently has Learn, Practice, Home, and Profile shells, not their planned feature behavior.
- Supabase anonymous Auth is the approved invisible identity mechanism. Onboarding remains public until submit; its server action creates an anonymous Supabase user only when needed and saves the profile under that user's ID. The existing SSR cookie integration and `src/proxy.ts` maintain the browser session. Hosted verification confirms same-browser persistence and profile editing.
- `src/contracts/profile.ts` validates the profile fields and `src/server/persistence/schema.ts` plus `drizzle/0000_profiles.sql` define the initial profile schema and row-level security policies. The migration is applied; live checks confirm own-profile access and cross-user read/write isolation.
- Unit tests, Playwright onboarding/profile/authorization/accessibility/responsive checks, ESLint, TypeScript, and production build are present. Hosted Auth integration checks are opt-in to avoid consuming the project's anonymous-sign-in rate limit. Their verified state is tracked in `docs/plans/project-status.md`.
- `docs/engineering/milestone-1-supabase-setup.md` records hosted Supabase configuration and the rate-limited integration-test workflow.

### Milestone 2 implementation complete

- `src/app/(workspace)/learn` and `src/components/learn-*` provide direct general explanations, bounded follow-up composition, persisted-conversation views, and recent-conversation links. They do not present course grounding or citations.
- `src/app/api/learn/route.ts` is the trusted, authenticated boundary: it checks same-origin JSON requests, bounds body size and request frequency, verifies conversation ownership using the user's Supabase session, selects bounded recent context, calls the configured adapter, and persists the validated response. The user applied `drizzle/0001_learn_conversations.sql`; hosted tests verify persistence/resume and two-user ownership, while anonymous REST access is denied.
- `src/contracts/learning.ts` owns request, response, and persisted-message validation. `src/server/ai` owns the provider contract, prompt, context selection, deterministic fake adapter, Ollama adapter, Gemini OpenAI-compatible adapter, retained Groq alternate, and one-retry structured-output validation. Gemini is the provisional hosted M2 adapter; both exact candidate IDs passed live synthetic Miva Buddy contract evaluations.
- `src/components/learn-conversation.tsx` safely renders fenced code as keyboard-focusable semantic code blocks. Mobile tests verify long-content wrapping, local code scrolling without page overflow, composer behavior, and accessibility.
- The current route runs within the web process; there is no worker for direct Learn. Both exact Gemini model candidates passed the current synthetic M2 structured-output evaluation; latency and intermittent failure observations are recorded in `docs/engineering/ai-provider-decision.md`.

### Milestone 3 implementation complete

- `src/app/(workspace)/courses` and `src/components/course-forms.tsx` provide owner-scoped course creation/listing, PDF upload, pasted notes, material status, concept cards, and page provenance. `src/app/actions/courses.ts` authenticates each action; Supabase RLS owns student-facing writes. PDF upload checks extension, size, and `%PDF-` signature, writes to the private bucket under `{user}/{course}/{material}/`, and enqueues a six-hour signed-URL capability that is never returned to the student or logged. Pasted notes enter the same page/chunk/concept pipeline.
- `src/server/ingestion` extracts PDFs page by page, rejects unreadable or text-empty inputs, chunks with page boundaries, embeds in bounded batches, and validates structured concepts against supplied chunk IDs. Worker SQL explicitly scopes every read/write by `user_id`, `course_id`, and `material_id`; composite foreign keys bind concepts to chunks from the same owner's same material. Material replacement is transactional and repeatable.
- `src/server/queue/material-jobs.ts` and `src/worker.ts` use PostgreSQL-backed pg-boss with bounded concurrency, retry/backoff, safe failure status, and graceful shutdown. Run the worker in a separate terminal with verified `npm run worker:dev`; it requires the Session pooler `DATABASE_URL`, the selected generation provider, and the configured embedding service.
- `drizzle/0002_courses_and_materials.sql` through `0004_expand_material_page_text.sql` add the six RLS-enabled tables, full-text and vector indexes, Storage owner policies, queued-notes provenance insertion, and a 500,000-character page limit matching the processing bound. Hosted migrations and worker startup are verified. The hosted synthetic journey processed notes and a PDF, displayed source-backed concepts, passed course ownership allow/deny checks, and completed cleanup. PDF fixtures, worker retries/failures, embeddings, live concept schema, accessibility/mobile, local build/tests, and migrations pass the M3 gate.
- Local development uses `nomic-embed-text:latest` (768 dimensions). Gemini's concept schema passed live synthetic evaluation; only synthetic content was sent during verification. Before sending real course material to Gemini, confirm the configured service/billing tier's current data-use terms permit it.

### Milestone 4 implementation complete

- `src/app/(workspace)/learn/course/[courseId]/[conceptId]/page.tsx` opens a concept in course context. `src/app/api/learn/grounded/route.ts` is the authenticated trusted boundary; Direct Learn remains deliberately separate and excludes conversations with course context.
- `src/server/retrieval/course-retrieval.ts` combines the M3 local embedding adapter with the hosted PostgreSQL RPC. It searches the selected material first and broadens only within the selected course. `drizzle/0005_grounded_learn.sql` implements full-text/vector reciprocal-rank fusion with `SECURITY INVOKER` and authenticated-only execute permission; owner scoping is enforced through `auth.uid()` and RLS.
- `src/contracts/grounded-learning.ts` and `src/server/ai/grounded-learning.ts` define grounded, additional, and no-support response segments. Citation IDs are checked against the retrieved request set; weak lexical matches are downgraded and specific material questions without grounded support receive a deterministic no-support response. Source titles, excerpt text, and page labels are resolved from owner-scoped database records by `src/app/actions/grounded-source.ts`.
- `src/components/grounded-learn-conversation.tsx` and `grounded-source-inspector.tsx` render distinct answer types and source inspection; the native dialog returns focus to its trigger and is verified at mobile width. Hosted synthetic tests cover answer persistence, exact source provenance, same-browser restoration, other-user denial, accessibility, and responsive layout. Live synthetic Gemini evaluations passed both exact Miva Buddy structured contracts. Detailed evidence and the lexical-check limitation are recorded in `docs/engineering/milestone-4-grounded-learn.md`.

### Milestone 5 implementation complete

- `src/server/practice/catalog.ts` owns the 12-entry metadata-only starter set and topic taxonomy. `src/contracts/practice.ts` strictly rejects extra problem fields and noncanonical external URLs; no statement or test-case content is stored. Official source pages and review scope are recorded in `docs/engineering/practice-catalog.md`.
- `/practice`, `/practice/topic/[topicId]`, and `/practice/session/[sessionId]` provide catalog navigation, session setup/resumption, external LeetCode handoff, mode selection, and manual completion. `src/app/actions/practice.ts` resolves problem IDs from the server-owned catalog and scopes every session operation to the current Supabase user. Coach is default; M6 adds coaching as described below.
- `drizzle/0006_practice_sessions.sql` adds owner-scoped persisted practice state, RLS policies, same-owner optional concept provenance, and one active attempt per user/problem. Home surfaces in-progress sessions. A deterministic allowlist maps eligible Learn concept titles directly to a Practice topic; unmatched concepts have no forced path.
- Hosted production-mode E2E verified direct and contextual entry, session create/resume, mode persistence, manual completion, no false acceptance claim, owner isolation, and mobile accessibility/layout. See `docs/engineering/milestone-5-practice.md`.

### Milestone 6 implementation complete

- `src/app/api/practice/coaching/route.ts` is an authenticated same-origin JSON boundary. It derives the owner and mode from the stored session, rejects completed/foreign sessions, applies bounded request and per-user rate limits, and persists only validated assistant coaching payloads.
- `src/contracts/practice-coaching.ts` defines the typed request and structured response. `src/server/practice/coaching-policy.ts` computes mode ceilings and validates candidate types, answer intent, code form, references, and selected policy cues before output is shown or stored. `src/server/practice/coaching.ts` sends the provider only curated problem title/difficulty/tags, student-supplied content, and bounded accepted history; it makes one stricter retry. Prior assistant history is filtered to the active mode's fields.
- `drizzle/0007_practice_coaching.sql` adds append-only `practice_messages` with a composite session-owner FK, RLS, owner SELECT/INSERT policies, and authenticated-only grants. The migration is applied to hosted development Supabase and catalog checks confirm RLS/policies.
- `src/components/practice-coach.tsx` renders the transcript/composer and persisted mode control. Full-answer requests outside Tutor return a mode limit; Coach offers a deliberate Tutor switch without resubmission. Completed sessions show read-only history. No LeetCode statement, example, hint, test case, editor telemetry, or submission verdict is sent or claimed.
- Local unit tests, live synthetic Gemini evaluation, hosted E2E, owner-isolation, and accessibility verification passed. Deterministic lexical checks are conservative filters, not semantic proof. Evidence and safeguards are in `docs/engineering/milestone-6-practice-coaching.md` and `docs/plans/project-status.md`.

### Identity decision: Supabase anonymous Auth

Use Supabase `signInAnonymously()` rather than a custom application-managed browser-session token. Supabase supplies a durable user UUID and signed session JWT that work with the existing Auth/Postgres/RLS integration. A custom token would require application-owned token issuance, secure persistence/rotation, and a trusted database authorization path. Neither option presents a sign-in ceremony, but anonymous Auth is the smaller and safer implementation. Anonymous sessions cannot be restored after browser data is cleared or on another device. RLS policies must scope every user-owned operation to `auth.uid()`; never use a service-role key to bypass those policies for routine student requests. Enable anonymous sign-ins in the Supabase project and dynamically render identity-dependent Next.js routes. Refer to [Supabase Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous) and [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

```text
Student browser
      |
      v
Web process: UI + trusted server API
      |
      +----------------------+----------------------+
      |                      |                      |
      v                      v                      v
Domain/application      PostgreSQL              Job queue
rules and use cases     product state           in PostgreSQL
      |                      |                      |
      +-----------+----------+                      v
                  |                              Worker
                  v                                 |
          Infrastructure adapters                  |
          |       |       |       |                 |
          v       v       v       v                 v
        Auth   Storage    AI   Retrieval      Material processing
```

## Trusted server boundary

The browser presents the experience but is not authoritative for identity, ownership, provider credentials, evidence validity, Practice mode, assistance ceilings, or important state transitions. For the MVP, Supabase anonymous Auth supplies the server-verifiable identity without asking the student to sign in.

The trusted server will:

- validate the Supabase session and authorize access to user-owned data;
- keep privileged database, storage, AI, embedding, and evidence-source credentials server-side;
- calculate Practice assistance limits from stored session state;
- validate machine-consumed AI output and source references;
- enforce evidence and grounding rules;
- distinguish successful empty results from retrieval or provider failures.

PostgreSQL row-level security and private object-storage policies will provide defense in depth. They do not replace server-side product policy.

## Planned layers

### Presentation

Next.js routes, layouts, responsive pages, accessible components, loading/empty/error states, and the documented visual system. Presentation code may call application use cases but must not own trust policy or import provider credentials.

### Application

Use-case orchestration such as onboarding a student, processing a material, asking a grounded question, starting a Practice session, requesting coaching, or checking job evidence. This layer coordinates domain rules and infrastructure ports.

### Domain

Framework-independent rules and state transitions, including:

- ownership-sensitive state transitions;
- grounded versus general response rules;
- evidence direct-support policy;
- Hands Off, Coach, and Tutor ceilings;
- explicit full-answer eligibility;
- typed success, no-result, and failure outcomes.

### Infrastructure

Replaceable adapters for PostgreSQL, authentication, private file storage, the PostgreSQL job queue, PDF extraction, AI generation, embeddings, course retrieval, and job-evidence sources.

### Contracts and validation

Shared schemas for HTTP input, environment configuration, provider output, citations, retrieval results, evidence records, and Practice responses. Structured output makes data parseable; separate provenance and policy checks determine whether it may be used.

## Planned platform boundaries

- **Persistence:** PostgreSQL for explicit student, learning, Practice, evidence, and operational state.
- **Identity:** Supabase anonymous Auth for the MVP, with SSR-managed cookie sessions and PostgreSQL RLS ownership policies. No email/password, email verification, password reset, SMTP, or cross-device recovery in the MVP.
- **File storage:** private Supabase Storage for uploaded PDFs; students receive only authorized access.
- **Queue:** pg-boss on the existing PostgreSQL database, avoiding an additional queue datastore.
- **Course retrieval:** implemented in PostgreSQL full-text search plus `pgvector` hybrid ranking, with owner-scoped RPC access and current-course/material ordering.
- **AI provider:** repository-owned generation interface; Ollama is the local adapter, Gemini and Groq adapters are implemented, and Gemini is the provisional hosted M2 evaluation candidate. Production selection remains pending live Miva Buddy evaluation and data-use review.
- **Embedding provider:** independently configurable interface; M3 uses local Ollama `nomic-embed-text:latest` (768 dimensions), and each stored embedding records its model/version so query-time vectors match.
- **Job-evidence provider:** source-neutral contracts and pure Remotive/Greenhouse/Ashby/Lever normalizers are implemented. A server-only Remotive network adapter exists but requires explicit per-activity grants, is not selected or wired to Learn, and has no cache. Synthetic fixtures and the development demo are not production evidence. M7 remains blocked for real-data use; see the source evaluation record.

Exact provider models, a production job source, hosting vendor, database schema, routes, and class/module names remain intentionally undecided until their milestones make the decisions concrete.

## Runtime processes

### Web process

Planned responsibilities:

- render the authenticated responsive application;
- handle anonymous identity, profile, course, Learn, and Practice requests;
- enforce authorization and trusted state transitions;
- perform question-time retrieval and provider orchestration;
- enqueue long-running material-processing work;
- return truthful, student-appropriate failure states.

### Worker process

Planned responsibilities:

- claim idempotent processing jobs;
- extract PDF text page by page or normalize pasted text;
- preserve page/section provenance;
- detect unreadable or image-only material;
- chunk and index material;
- generate embeddings;
- extract and validate grounded concepts;
- update processing status without losing the original upload.

## Major planned flows

### Material processing

```text
Authenticated upload
  -> private storage
  -> queued Material record
  -> worker extraction by page/section
  -> quality checks
  -> provenance-preserving chunks
  -> full-text index + embeddings
  -> structured concept extraction
  -> validated concepts or recoverable failure
```

### Grounded learning

```text
Question + current learning context
  -> ownership check
  -> context-scoped hybrid retrieval
  -> passages + immutable source IDs
  -> candidate grounded/general response segments
  -> schema, retrieved-ID, lexical-support, and policy validation
  -> persisted response
  -> UI resolves source metadata from stored records
```

### Direct learning (Milestone 2 implemented)

```text
Concept + bounded conversation context
  -> AI provider
  -> validated response
  -> persisted General explanation
```

The current Learn route implements this flow with an explicit general-explanation label, bounded recent context, owned conversation persistence, and replaceable provider adapters. Hosted migration, persistence/ownership, live synthetic model evaluations, accessibility, and mobile long-content/code-block/composer checks have passed. Direct learning has no course-grounding sources or citations and does not trigger contextual industry evidence under the approved MVP behavior.

The separate Grounded Learn route implements the course/material/concept context flow. It persists response segments and provenance IDs; citation labels and passage text are resolved from owned rows, not model prose. Material-specific questions with no cited support receive a distinct no-support state, and retrieval failure is separately retryable. The lexical-overlap validator is only a negative filter and is not a proof of semantic entailment.

### Course-material preparation (Milestone 3 complete)

- `src/server/embeddings` defines the independent `EmbeddingProvider` boundary, deterministic fake implementation, and Ollama adapter. Unit tests cover batch inputs, vector shape/finite-value checks, and safe provider failure handling. The local `nomic-embed-text` model is configured in ignored `.env.local`; an opt-in integration test through the adapter passed a synthetic two-text batch check with consistent finite 768-dimensional vectors.
- Course/material schema and migrations, owner-scoped Storage policies, PDF/notes processing, pg-boss queue, and separate worker are implemented and verified. Hosted notes/PDF processing, owner RLS, mobile accessibility, and source provenance pass. See `docs/engineering/milestone-3-setup.md`.

### Practice coaching

```text
Problem metadata + student-supplied attempt/request
  -> authoritative Practice session state
  -> deterministic permitted-help calculation
  -> mode-specific AI contract
  -> candidate response
  -> schema, code-reference, and assistance-ceiling checks
  -> accept and persist OR retry once OR fail safely
```

The application does not claim to observe LeetCode editor state, runs, verdicts, time spent, or completion. Completion is student-confirmed.

### Contextual job evidence (M7 blocked; M8 development preview in progress)

```text
Concrete skill in grounded course material
  -> verify source occurrence
  -> approved provider search
  -> normalized posting snapshot
  -> exact skill/approved-alias validation
  -> evidence found | no credible evidence | retrieval failure
  -> evidence card from stored data
  -> optional AI explanation
```

Nigerian and global postings are both eligible. Geography and career interests may rank already-valid evidence but cannot establish truth.

Implemented M7 building blocks include the source-neutral contract, pure synthetic-tested normalizers for Remotive, Greenhouse, Ashby, and Lever, direct-term/excerpt validation, freshness evaluation, attribution metadata, and an explicit-permission guard. The server-only Remotive adapter can make a single-term, bounded API query only when retrieval and metadata-display grants are explicit; a separate grant gates excerpts. It disables HTTP caching, persists nothing, and enforces only a process-local quota, so it is not safe as production quota enforcement across instances. No grant is configured, the adapter is not wired into Learn, and no job API call was made during the current implementation turn. Published terms do not clearly authorize the intended third-party metadata/excerpt/cache use. Metadata/link-only references have a distinct `references_only` result and cannot make a skill-evidence claim; they are not rendered as if they were evidence and are not automatically permitted.

The actual M8 preview path is `src/app/api/learn/grounded/route.ts` → `src/server/job-evidence/demo.ts` → strict `IndustryDemo` contract → `GroundedLearnExperience`/`IndustryEvidenceCard`. It derives one canonical skill only from retrieved course passages, only returns it outside production, never includes a real posting URL, is not a `JobEvidenceItem`, and is never persisted. It is visibly labeled as a synthetic demonstration, not a real job posting. This is an explicitly user-authorized development exception while M7 remains blocked; it must not appear in production or be counted as completed source integration. Details and verification are in `docs/engineering/milestone-7-job-evidence-source-evaluation.md` and `docs/engineering/milestone-8-industry-evidence.md`.

### Restoration

```text
Authenticated return
  -> profile + recent learning + courses + open Practice sessions
  -> Home continuation view
  -> resume explicit stored context
  -> send providers only bounded task-relevant context
```

### Integration and hardening (Milestone 9 in progress)

- Next.js route-level loading, error, global-error, not-found, and workspace recovery boundaries provide safe navigation without exposing raw provider/database errors. Baseline browser security headers are set centrally in `next.config.ts`; HSTS is production-only.
- `src/server/observability/safe-telemetry.ts` allows only fixed operation/provider/outcome labels and bounded durations. It excludes prompts, user/material IDs, URLs, raw errors, and credentials. Worker failures report bounded reason codes and attempt counts.
- Course detail routes refresh while owned materials are queued/processing so worker results become visible without a manual reload. The worker remains a separately supervised Node process; local commands are documented in the README. A production worker start/runtime configuration has not been selected or verified.
- Playwright covers safe error recovery, response headers, accessibility, phone/tablet layout, and opt-in synthetic hosted journeys. Hosted onboarding/profile, Practice, and material processing checks pass. Grounded Learn's hosted response has been intermittent and remains a verification issue. Deployment is not performed; production host, embedding topology, operations, and backups remain open.

## Trust and enforcement invariants

- AI explains and reasons; retrieval supplies evidence; application state remembers; deterministic software enforces important rules.
- Course-grounded claims must be supported by retrieved passages and machine-backed source IDs.
- General explanation is allowed but must be visibly and structurally distinct from course grounding.
- Source names and page numbers come from stored metadata, not model-generated prose.
- Job evidence is rendered from stored retrieved records and must directly contain the skill or an approved direct alias.
- A source activity (retrieval, metadata display, excerpt display, or caching) must fail closed unless its specific permission is explicitly recorded as permitted; `conditional` or `unclear` is not approval.
- Metadata-only job references are not skill evidence and cannot be promoted to `found` evidence without a directly supporting excerpt or approved structured field.
- Evidence found, no credible evidence, and retrieval failure remain distinct states.
- Automatic no-evidence checks are normally silent; explicit checks may report no evidence.
- Hands Off, Coach, and Tutor are server-known ceilings. Format changes cannot bypass them.
- Tutor may provide a full answer only after an explicit request.
- Structured provider output is validated, retried at most once when specified, and then fails safely.
- Uploaded documents and job postings are untrusted data, never instructions.
- Provider requests contain only the minimum material necessary for the current operation.
- No fixture job evidence may appear in production.

## Repository organization

The repository structure has been established through M8. Existing paths below are implemented; paths labelled planned are not claims that code exists:

```text
src/
  app/                 onboarding, workspace, Learn API/pages, course routes, and server actions
  components/          shared shell, Learn UI, profile form, and course/material forms
  contracts/           profile, Learn, and course/material validation
  lib/                 environment, profile/learning helpers, and Supabase SSR client
  server/persistence/  Drizzle schemas and PostgreSQL pool
  features/            planned feature modules
  server/
    application/       planned use-case orchestration
    domain/            planned deterministic rules and state transitions
    ai/                implemented direct-learning provider contract/adapters; other AI workflows planned
    ingestion/         implemented PDF extraction, chunking, and concept pipeline
    retrieval/         planned course and job retrieval
    storage/           planned private file storage
  proxy.ts             implemented Supabase session refresh
drizzle/                profile, Learn, course/material, and notes-source migrations applied
content/dsa/            planned curated DSA and LeetCode metadata
src/worker.ts           implemented separate pg-boss worker entry point
tests/
  unit/
  integration/
  e2e/
  accessibility/
  retrieval/
  ai-evals/
docs/                   durable product, architecture, and planning knowledge
```

The remaining planned paths are expectations, not claims about current files.

## Testing and evaluation boundaries

- **Unit:** domain policy, schemas, mappings, context limits, and state transitions.
- **Integration:** persistence, RLS/ownership, storage, queue behavior, adapters, retrieval, and citation validity.
- **End to end:** onboarding, direct Learn, course-grounded Learn, source inspection, Practice, coaching, evidence, restoration, and recovery.
- **Accessibility/responsive:** keyboard, focus, semantics, contrast, touch targets, reduced motion, zoom, and representative mobile layouts.
- **Retrieval evaluations:** relevant-passage recall, irrelevant-passage rejection, page correctness, and current-context priority.
- **AI evaluations:** grounded support, concept extraction, malformed output, prompt injection, and coaching-ceiling leakage.
- **Security:** cross-user denial, private file access, secret exposure, unsafe URLs, and untrusted-content handling.

Milestone-specific requirements and completion gates are defined in `docs/plans/mvp-implementation-plan.md`. Current progress is recorded in `docs/plans/project-status.md`.

## Evolution rule

When implementation differs from this plan, update this document in the same milestone. Describe the actual component, its responsibility, and the reason for any material deviation. Do not leave planned modules presented as implemented or allow architecture knowledge to exist only in chat.
