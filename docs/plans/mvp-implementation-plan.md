# Miva Buddy MVP Implementation Plan

> This plan records the original MVP engineering sequence and acceptance gates. Internal milestone/phase numbering is development history, not a product version. The first public deployment is the V1 release milestone; no V1 release plan is established here.

> **Authentication supersession:** The anonymous-first identity in the original Milestone 1 plan is historical. The approved beta uses Google OAuth via Supabase Auth and migration 0011; see [`google-auth-setup.md`](../engineering/google-auth-setup.md) and current [project status](project-status.md). The original acceptance criteria below are not current Google-auth verification.

## Purpose and workflow

This is the approved implementation plan for the Miva Buddy MVP. Milestones are coherent vertical slices with explicit verification gates. Current progress is maintained in `project-status.md`.

Before Milestone 1 begins, the repository must contain the approved operating instructions, planned architecture, implementation plan, and project status. A milestone becomes complete only when its acceptance criteria, required tests and evaluations, and documentation updates are complete.

## Recommended milestone order

1. Application foundation, identity, and persistent shell
2. Direct Learn and AI-provider boundary
3. Course materials and concept discovery
4. Grounded Learn, retrieval, and source inspection
5. DSA Practice discovery and session lifecycle
6. Deterministically constrained Practice coaching
7. Job-evidence source evaluation
8. Contextual industry evidence
9. MVP integration, hardening, and deployment

Milestone 7 should begin as an investigation after Milestone 1 and may run in parallel with Milestones 2–6. It is a hard dependency for Milestone 8.

Milestone 1 is the first implementation milestone. It establishes frictionless onboarding, invisible anonymous identity, ownership, persistence, responsive navigation, visual tokens, and the trusted server boundary needed by later slices. Supabase anonymous Auth is used instead of a custom app-managed browser session because its signed user sessions and `auth.uid()` integrate directly with RLS. It preserves access only in the same browser; clearing browser data or changing devices may lose access. Email/password authentication, email verification, password reset, SMTP, and cross-device restoration are deferred beyond the MVP.

## Milestone 1 — Application foundation, identity, and persistent shell

### 1. Goal

Establish the approved modular-monolith foundation and deliver the frictionless onboarding, anonymous identity, persistent profile, navigation, and empty Home experience.

### 2. User-visible outcome

A student can open Miva Buddy directly to a short onboarding form, save a profile without entering authentication credentials, reach a responsive Home screen, navigate between Home, Learn, Practice, and Profile, edit profile information, and return in the same browser with state preserved. Home presents useful starting actions rather than analytics or a generic chatbot.

### 3. Major engineering work

- Initialize the TypeScript and Next.js application.
- Configure formatting, linting, type checking, tests, and CI.
- Establish server, domain, infrastructure, feature, and component boundaries.
- Configure Supabase anonymous Auth, PostgreSQL, private access patterns, and Drizzle migrations.
- Implement profile, programme, level, and career-interest persistence.
- Apply ownership columns, grants, and row-level security policies.
- Implement the desktop sidebar and mobile bottom navigation.
- Encode documented colors, typography, spacing, radii, focus states, and responsive breakpoints as design tokens.
- Add typed environment validation and server-only secret handling.
- Establish structured application logging and safe user-facing error handling.

### 4. Dependencies

- Approved architecture and implementation plan.
- Pre-implementation repository knowledge files.
- A hosted development Supabase project; local Supabase and Docker are not required.

### 5. Acceptance criteria

- A first-time browser opens directly to onboarding without a sign-in screen; workspace routes require a valid Supabase anonymous session and completed profile.
- Saving onboarding creates an anonymous Supabase identity only when needed and persists the profile under its UUID.
- A new user completes onboarding on one focused screen.
- A returning user bypasses onboarding and sees persisted profile data.
- One user cannot access another user’s profile through UI or direct requests.
- Desktop and mobile navigation follow the documented information architecture.
- Home contains only appropriate starting and continuation placeholders.
- No AI/provider settings are exposed to students.
- Secrets are unavailable in browser bundles.
- Documented visual tokens are used instead of arbitrary replacements.

### 6. Required tests and evaluations

- Unit tests for onboarding and profile validation.
- Integration tests for anonymous identity-to-profile creation.
- Authorization and RLS allow/deny tests.
- End-to-end first-visit onboarding, anonymous identity creation, profile persistence/editing, and same-browser return tests.
- Keyboard-navigation and focus-order checks.
- Automated accessibility scans for onboarding, Home, and Profile.
- Responsive checks at representative phone, tablet, and desktop widths.

### 7. External services or configuration required

- Hosted Supabase development project.
- Anonymous sign-ins enabled in Supabase Auth.
- Profile migration applied by Dashboard SQL Editor, or a local `DATABASE_URL` if using Drizzle CLI.
- No AI or job-source credentials.

### 8. Documentation that should be updated

- `AGENTS.md` with verified setup and test commands.
- `ARCHITECTURE.md` with the actual application boundaries.
- Implementation status and milestone evidence.
- Anonymous identity, authorization, and environment setup notes.
- Any architecture decision record required by final hosting/auth choices.

### 9. Explicitly deferred work

- AI conversations.
- Course creation and materials.
- PDF processing and retrieval.
- DSA content and Practice sessions.
- Industry evidence.
- Voice, dark mode, gamification, and external university integration.

## Milestone 2 — Direct Learn and AI-provider boundary

### 1. Goal

Deliver direct concept learning while proving the replaceable AI boundary, bounded context, structured response handling, and conversation persistence.

### 2. User-visible outcome

A student can enter a concept such as “Teach me binary trees,” receive a clearly labelled general explanation, ask follow-up questions, leave, and resume the conversation later. The interface never implies that direct learning is grounded in uploaded course material.

### 3. Major engineering work

- Define repository-owned generation-provider contracts.
- Implement deterministic fake providers for tests.
- Implement the Ollama development adapter.
- Evaluate hosted providers for free or low-cost availability, structured-output reliability, explanation quality, latency, context limits, data-retention terms, and operational simplicity.
- Select one initial hosted adapter without coupling product logic to it.
- Validate provider responses through Zod contracts.
- Implement one controlled retry for malformed structured output.
- Persist conversations and messages.
- Select bounded recent context for each request.
- Add rate limits, request-size limits, cancellation, and recoverable provider failures.
- Restore recent conversations on Home and Learn.

### 4. Dependencies

- Milestone 1.
- Approved minimum-data disclosure policy.
- At least one viable local or hosted provider for interactive testing.

### 5. Acceptance criteria

- Direct learning works without a course or uploaded material.
- Responses are visibly labelled “General explanation.”
- No course source or citation can appear in this route.
- Conversations survive a same-browser return with the anonymous session intact.
- Only the current concept and bounded relevant history are sent to the provider.
- Switching between fake, Ollama, and hosted adapters requires configuration rather than feature rewrites.
- A malformed provider response is retried once and then fails safely.
- A provider outage does not delete conversation history.
- Students never see API keys, provider names, stack traces, or raw provider errors.

### 6. Required tests and evaluations

- Unit tests for context selection and response schemas.
- Provider contract tests shared by all adapters.
- Integration tests for conversation ownership and persistence.
- End-to-end direct-learning and resume flows.
- AI evaluations for concise introductory explanations, useful follow-ups, refusal to fabricate course grounding, malformed output, and prompt-injection attempts in student text.
- Accessibility tests for the conversation and composer.
- Mobile tests for long prose, code blocks, and composer behavior.

### 7. External services or configuration required

- Ollama for optional local development.
- Candidate hosted-provider credentials during evaluation.
- A selected hosted-provider credential before deployment.
- Usage and cost telemetry configuration.

### 8. Documentation that should be updated

- AI-provider decision record.
- Provider-adapter contract and configuration guide.
- AI-evaluation approach and baseline results.
- Context-minimization and failure-handling documentation.
- Milestone status and verification evidence.

### 9. Explicitly deferred work

- Course uploads and grounded answers.
- Embedding-based retrieval.
- Source citations.
- Practice coaching.
- Industry evidence.
- Automatic multi-provider failover.

## Milestone 3 — Course materials and concept discovery

### 1. Goal

Deliver the complete course → material → processing → concept-discovery vertical slice.

### 2. User-visible outcome

A student can create a course, upload a supported PDF or paste notes, follow understandable processing status, and receive a small set of important concepts grounded in that material. Unreadable PDFs produce a useful recovery path.

### 3. Major engineering work

- Implement course and material ownership models.
- Add course creation, listing, and simple material management.
- Configure private object storage and signed access.
- Validate upload type and conservative size/page limits.
- Add PostgreSQL-backed background jobs and the worker entry point.
- Extract PDF text page by page.
- Preserve page, material, course, and section metadata.
- Detect image-only, empty, corrupt, or very low-quality extraction.
- Support pasted notes through the same normalized pipeline.
- Chunk material without losing source boundaries.
- Add full-text indexing.
- Define and evaluate the embedding-provider boundary.
- Generate versioned embeddings with the same model used at query time.
- Extract concepts through a structured schema.
- Require each concept to reference supporting source IDs.
- Make processing jobs idempotent and safely retryable.

### 4. Dependencies

- Milestone 1.
- The generation-provider boundary from Milestone 2.
- A configured embedding provider, which may be Ollama locally and a selected hosted provider in deployment.
- Private file storage and a worker-capable runtime.

### 5. Acceptance criteria

- Students can create courses and add PDFs or pasted notes.
- Material status distinguishes queued, processing, ready, and failed.
- Extracted page metadata survives chunking.
- Every displayed concept has at least one valid supporting source.
- Reprocessing does not create duplicate chunks or concepts.
- Image-only or unreadable PDFs are not reported as successfully processed.
- Failed processing preserves the original upload and offers retry or paste-text recovery.
- Concept discovery shows a focused set rather than unrelated study tools.
- One user cannot access another user’s courses, materials, extracted text, or files.

### 6. Required tests and evaluations

- Unit tests for file validation, state transitions, chunking, and idempotency.
- Integration tests for private storage and ownership.
- Worker retry and failure-recovery tests.
- PDF fixtures covering normal text, multiple pages, columns, empty pages, malformed files, and image-only PDFs.
- Concept-extraction AI evaluations for source support, importance, duplicates, and malformed output.
- Database tests confirming source metadata remains intact.
- End-to-end PDF and pasted-note journeys.
- Mobile and accessibility tests for upload, progress, errors, and concept cards.

### 7. External services or configuration required

- Supabase private Storage.
- PostgreSQL worker queue.
- Ollama or hosted generation provider for concept extraction.
- Ollama or hosted embedding provider.
- Worker runtime configuration.

### 8. Documentation that should be updated

- Material ingestion and processing architecture.
- Supported document limits and failure behavior.
- Chunking, embedding, and source-metadata decisions.
- Worker operations and retry guidance.
- Concept-extraction schema and evaluation results.
- Milestone status and verification evidence.

### 9. Explicitly deferred work

- OCR.
- Formats other than PDF and pasted text.
- Automatic summaries, flashcards, quizzes, or study plans.
- Grounded question answering.
- Industry evidence.
- Miva dashboard imports.

## Milestone 4 — Grounded Learn, retrieval, and source inspection

### 1. Goal

Turn processed material into a trustworthy grounded learning conversation with visible provenance and clearly separated additional explanation.

### 2. User-visible outcome

A student selects a discovered concept, asks questions, sees which information came from the course material, inspects the relevant passage and page, and receives clearly labelled additional explanation where the material is insufficient.

### 3. Major engineering work

- Implement context-aware hybrid retrieval.
- Search the current concept/material first, then broaden within the current course only when appropriate.
- Define typed outcomes for supporting evidence found, no sufficient support, and retrieval failure.
- Generate structured response segments with citation IDs.
- Resolve source titles and page numbers from stored metadata, never model prose.
- Validate citation existence, ownership, and membership in the retrieved set.
- Reject or downgrade unsupported grounded segments.
- Implement source inspection as a side panel on desktop and a full-height surface or bottom sheet on mobile.
- Persist grounded and general response segments separately.
- Preserve course, material, concept, and conversation context during navigation.
- Add deterministic DSA-topic mapping hooks without yet implementing the full Practice experience.

### 4. Dependencies

- Milestones 2 and 3.
- Retrieval-evaluation fixtures.
- Stable source metadata and embeddings.

### 5. Acceptance criteria

- Grounded responses cite only sources actually retrieved for that request.
- Page and material labels come from stored metadata.
- General explanation is visually and structurally distinct.
- A question about what the material specifically says does not substitute unsupported general knowledge.
- An unknown or invalid citation ID is never rendered.
- Retrieval failure and insufficient supporting material have different behavior.
- Source inspection preserves the learning position when opened and closed.
- Conversation restoration retains provenance.
- The interface remains a focused learning workspace rather than a generic chat screen.

### 6. Required tests and evaluations

- Unit tests for retrieval scoping, citation validation, and result-state unions.
- Integration tests for retrieval over known course fixtures.
- Retrieval evaluations measuring relevant-passage recall, irrelevant-passage rejection, page correctness, and current-material prioritization.
- AI evaluations for grounded claim support, grounded/general separation, fabricated source attempts, insufficient evidence, and hostile instructions embedded in material.
- End-to-end upload → concept → question → source-inspection flow.
- Authorization tests for source endpoints.
- Accessibility and responsive tests for source inspection and conversation layout.

### 7. External services or configuration required

- Configured generation provider.
- Configured embedding provider.
- PostgreSQL full-text search and pgvector.
- No job-posting source.

### 8. Documentation that should be updated

- Course retrieval and ranking behavior.
- Grounded response and citation contracts.
- Source-inspection behavior.
- Retrieval-evaluation dataset and baseline.
- Failure-state documentation.
- Milestone status and verification evidence.

### 9. Explicitly deferred work

- Industry evidence.
- Cross-course search unless later justified.
- OCR.
- General web retrieval for learning.
- Advanced conversation summarization.
- Practice coaching.

## Milestone 5 — DSA Practice discovery and session lifecycle

### 1. Goal

Deliver useful Practice navigation and explicit Practice state before introducing AI coaching.

### 2. User-visible outcome

A student can browse curated DSA topics, choose a LeetCode problem, open the original problem, return to an already-created Practice session, select an assistance mode, manually mark the problem complete, and continue later. A grounded Learn concept with a valid DSA mapping enters the correct Practice topic directly.

### 3. Major engineering work

- Create a curated, reviewable DSA topic and LeetCode metadata dataset.
- Store only title, difficulty, URL, tags, topic mappings, and other permitted metadata.
- Implement Practice landing, topic, problem-list, and session screens.
- Create the Practice session before sending the student to LeetCode.
- Persist selected mode, with Coach as the default.
- Preserve the Learn-to-Practice topic transition.
- Implement manual completion and next-problem navigation.
- Surface open Practice sessions on Home.
- Validate and allowlist external LeetCode URLs.
- Keep Practice free of industry evidence.

### 4. Dependencies

- Milestone 1.
- Milestone 4 for the contextual Learn transition.
- A reviewed initial DSA problem set.

### 5. Acceptance criteria

- Direct and contextual Practice entry routes both work.
- Contextual entry does not ask the student to choose the same topic again.
- Only curated metadata is stored; no copied statements or test cases exist.
- Selecting a problem creates or resumes the correct session.
- Coach is selected for a new session.
- Mode changes persist but do not yet generate coaching.
- Completion is manual and never presented as verified LeetCode acceptance.
- Returning students can resume in-progress sessions.
- Practice screens contain no industry evidence or embedded IDE.

### 6. Required tests and evaluations

- Unit tests for mappings, session transitions, completion, and URL validation.
- Dataset validation for unique IDs, valid URLs, supported difficulties, and topic mappings.
- Integration tests for ownership and resumption.
- End-to-end direct Practice and Learn-to-Practice flows.
- Tests confirming no LeetCode protected content is stored.
- Accessibility tests for topic lists, mode selection, and completion.
- Mobile tests for problem lists, navigation, and external-link behavior.

### 7. External services or configuration required

- No LeetCode API.
- No browser extension.
- No code-execution service.
- No new provider credentials.

### 8. Documentation that should be updated

- DSA curation guidelines and metadata provenance.
- Practice session lifecycle.
- Learn-to-Practice mapping rules.
- Copyright and external-link constraints.
- Milestone status and verification evidence.

### 9. Explicitly deferred work

- AI coaching responses.
- Automatic editor or submission inspection.
- Code execution.
- Browser extension.
- AI-generated problems.
- Industry evidence in Practice.

## Milestone 6 — Deterministically constrained Practice coaching

### 1. Goal

Add useful AI coaching while enforcing the documented Hands Off, Coach, and Tutor ceilings through trusted server-side policy and validation.

### 2. User-visible outcome

A student can paste an attempt, reasoning, error, or failed-test description and receive help within the selected mode. Requests that exceed the current mode are handled clearly, and Tutor gives a complete answer only when explicitly asked.

### 3. Major engineering work

- Implement the Practice policy engine as deterministic domain logic.
- Model permitted behavior by mode and request type.
- Detect explicit full-answer requests separately from Tutor selection.
- Store student-supplied attempts and relevant coaching history.
- Define mode-specific structured response contracts.
- Exclude stronger response fields from restrictive modes.
- Check code/identifier references against student-supplied content.
- Reject forbidden code, pseudocode, steps, or answer classifications as appropriate.
- Apply the same ceiling to walkthroughs, traces, diagrams, and dry runs.
- Retry one rejected response under stricter instructions, then drop it.
- Persist only accepted coaching responses as delivered help.
- Provide one-click Coach-to-Tutor switching without automatic escalation.
- Record policy decisions and rejection reasons for debugging without exposing them to students.

### 4. Dependencies

- Milestones 2 and 5.
- Stable provider abstraction.
- Approved Practice policy documentation.
- A representative coaching-evaluation set.

### 5. Acceptance criteria

- Hands Off volunteers observations and reflective questions only.
- Hands Off does not name the solution idea, provide steps, pseudocode, or solutions.
- Coach may name the idea and diagnose the student’s supplied work.
- Coach does not provide a complete solution.
- Tutor may provide steps.
- Tutor provides a complete answer only after an explicit request.
- Mode changes are deliberate and persisted.
- Walkthroughs cannot bypass the selected ceiling.
- Responses cannot refer to lines, variables, code, runs, or verdicts not supplied by the student.
- Two failed policy checks produce a recoverable failure, not an over-helpful response.
- The system never claims to observe LeetCode state.

### 6. Required tests and evaluations

- Exhaustive unit-test matrix across modes, request types, and session states.
- Tests for explicit-answer detection and mode switching.
- Tests for invalid code and identifier references.
- Integration tests for policy computation, generation, rejection, retry, and persistence.
- AI red-team evaluations covering “ignore Coach mode” requests, disguised requests for full code, walkthrough and dry-run bypasses, common well-known LeetCode solutions, nonexistent variables and line numbers, missing student context, and repeated requests.
- End-to-end coaching flows for every mode.
- Accessibility tests for shortcuts, mode descriptions, failures, and long code.
- Manual pedagogical review of a representative response set.

### 7. External services or configuration required

- Configured generation provider.
- Usage limits appropriate for repeated coaching.
- No code runner or LeetCode integration.

### 8. Documentation that should be updated

- Authoritative Practice-policy representation.
- Structured coaching contracts.
- Validation and retry behavior.
- AI coaching evaluation suite and known limitations.
- Operational guidance for reviewing rejected responses.
- Milestone status and verification evidence.

### 9. Explicitly deferred work

- Browser telemetry.
- Automatic LeetCode verdicts.
- Code execution.
- Numerical hint ladders.
- Timed escalation.
- Automatic mode switching.
- Interview-preparation modes.

## Milestone 7 — Job-evidence source evaluation

### 1. Goal

Select an approved, legally and technically suitable job-evidence source before building the real evidence adapter.

### 2. User-visible outcome

There is intentionally no production student feature in this milestone. Its outcome is confidence that later evidence cards can be supported by a legitimate, reliable source. Deterministic fixture data may be used only in development and tests and must never be represented as live evidence.

### 3. Major engineering work

- Define the source-independent job-evidence provider contract.
- Define normalized success, no-evidence, failure, and rate-limit outcomes.
- Build deterministic fixtures for later feature development.
- Evaluate candidate APIs or feeds for terms of use and permitted display/storage, access to exact posting text or excerpts, original source URLs, Nigerian and global coverage, freshness and closure behavior, stable identifiers, rate limits, free-tier or low-cost viability, reliability, and operational complexity.
- Test whether each source permits the direct-evidence rule.
- Document disallowed scraping approaches.
- Select a source, approve a constrained source combination, or explicitly conclude that no suitable source has yet been found.

### 4. Dependencies

- Milestone 1 for configuration conventions.
- The approved geographic and cost decisions.
- No dependency on completion of Milestones 2–6.

### 5. Acceptance criteria

- The provider contract does not expose source-specific assumptions to product logic.
- At least the most plausible candidates have been evaluated consistently.
- Legal/terms concerns and technical constraints are recorded.
- Nigerian and global coverage are measured separately but neither is treated as a truth requirement.
- Direct excerpts and original links are available from the selected approach.
- Cost and rate limits are compatible with the prototype.
- No unapproved job-board scraping is introduced.
- A clear go/no-go decision exists before Milestone 8.
- Fixtures are visibly and technically isolated from production evidence.

### 6. Required tests and evaluations

- Contract tests using deterministic fixtures.
- Candidate-source connectivity and normalization spikes.
- Tests for found, empty, failed, rate-limited, stale, and removed results.
- Direct-term availability checks across representative technologies.
- URL stability and duplicate-posting evaluation.
- Manual review of source-attribution requirements.
- Cost and quota estimates for expected prototype usage.

### 7. External services or configuration required

- Temporary candidate API credentials where required.
- Access to candidate terms and developer documentation.
- No production credential until a source is approved.

### 8. Documentation that should be updated

- Job-source evaluation report.
- Selected-source decision record or documented blocker.
- Evidence-provider contract.
- Permitted storage, display, and freshness behavior.
- Cost and quota assumptions.
- Milestone status and supporting evidence.

### 9. Explicitly deferred work

- Production evidence cards.
- Automatic job monitoring.
- Job search.
- Apply flows.
- Salary data.
- Recommendation feeds.
- Scraping any unapproved board.

## Milestone 8 — Contextual industry evidence

### 1. Goal

Deliver verified job evidence inside course-grounded Learn using the approved provider and strict direct-support rules.

### 2. User-visible outcome

When uploaded course material directly mentions a concrete skill and credible evidence exists, the student may see a small evidence card containing the skill, role, company, exact supporting excerpt, original source, and retrieval date. Automatic no-evidence results remain silent. Explicit checks can report no credible evidence. Technical failures are distinguishable and retryable.

### 3. Major engineering work

- Identify structured candidate skills from grounded course content.
- Verify that each candidate appears in the source material.
- Maintain a canonical skill registry with narrowly approved direct aliases.
- Integrate the approved evidence provider.
- Normalize and store immutable posting snapshots.
- Require direct term or approved-alias support in the displayed excerpt.
- Represent evidence independently from optional AI explanation.
- Rank already-valid Nigerian and global evidence using career interests and optional geography signals.
- Preserve source URL, provider, retrieval time, and availability state.
- Implement automatic and explicit evidence-check behavior.
- Add source-detail UI and safe outbound links.
- Prevent posting content from acting as model instructions.
- Exclude evidence entirely from Practice and direct-learning routes.

### 4. Dependencies

- Milestone 4.
- Milestone 7 with an approved source.
- Milestone 2 if optional AI explanation is included.

### 5. Acceptance criteria

- Evidence appears only for concrete skills found in uploaded course material.
- The exact term or an approved direct alias appears in the supporting excerpt.
- Broad semantic similarity cannot establish direct support.
- Career interests and geography affect ranking only.
- Nigerian and global postings are both eligible.
- Evidence cards are rendered from stored records, not generated prose.
- Automatic no-evidence results show no card or error.
- Explicit checks may show the documented no-evidence message.
- Retrieval failure never appears as no evidence.
- Historical evidence shows retrieval date and does not imply current availability unless reverified.
- Industry evidence never appears in Practice or unsupported direct learning.

### 6. Required tests and evaluations

- Unit tests for canonical skills, aliases, exact support, ranking, and state distinctions.
- Negative tests such as `databases` not proving `SQL`, `data structures and algorithms` not proving `hash maps`, and AI explanation being unable to modify company, role, excerpt, or URL.
- Provider contract and normalization integration tests.
- Prompt-injection tests using hostile posting text.
- End-to-end evidence-found, silent-no-result, explicit-no-result, and retrieval-failure flows.
- Freshness and disappearing-posting tests.
- Accessibility and mobile tests for cards and evidence details.
- Manual provenance review against original postings.

### 7. External services or configuration required

- Approved job-evidence source credential.
- Configured provider quotas and rate limits.
- Generation provider only if optional explanatory prose is included.

### 8. Documentation that should be updated

- Selected job-source integration.
- Skill and alias governance.
- Direct-support validation.
- Freshness and historical-evidence behavior.
- Ranking rules.
- Evidence evaluation results.
- Milestone status and verification evidence.

### 9. Explicitly deferred work

- General job search.
- Application tracking.
- Salary widgets.
- Apply buttons.
- Scheduled broad job monitoring.
- Claims inferred from generic postings.
- Industry content in Practice.
- Unapproved scraping.

## Milestone 9 — MVP integration, hardening, and deployment

### 1. Goal

Turn the completed vertical slices into one reliable, coherent, accessible, low-cost deployed MVP.

### 2. User-visible outcome

A student can complete the full product journey:

```text
Open application
  -> complete lightweight onboarding
  -> establish anonymous browser identity on save
  -> create course
  -> add material
  -> discover a concept
  -> learn with grounded sources
  -> see valid industry evidence when available
  -> move to relevant DSA Practice
  -> open LeetCode
  -> return for bounded coaching
  -> leave and resume later
```

Direct learning and direct Practice also work independently.

### 3. Major engineering work

- Connect Home continuation data across Learn and Practice.
- Complete all loading, empty, success, failure, and recovery states.
- Audit navigation and back behavior.
- Optimize mobile layouts and low-bandwidth behavior.
- Add upload, request, provider, and user-level rate limits.
- Review database grants, RLS, signed URLs, and secret boundaries.
- Add safe logging, provider-usage metrics, queue monitoring, and failure diagnostics.
- Establish conservative context and token budgets.
- Add data deletion and cleanup behavior appropriate for the prototype.
- Optimize indexes, retrieval latency, and page performance.
- Deploy web and worker processes with managed database and storage.
- Run release migrations and backup/restore checks.
- Complete manual design-system and accessibility review.

### 4. Dependencies

- Milestones 1–8.
- Approved deployment provider.
- Production Supabase project.
- Hosted generation and embedding providers.
- Approved production job-evidence source.

### 5. Acceptance criteria

- Every documented MVP journey works in the deployed environment.
- Returning-state continuity works in the same browser while its anonymous session remains available. Cross-device continuity is not required.
- Trust labels and evidence provenance remain accurate throughout.
- Cross-user access tests pass.
- Queue and provider failures preserve student data.
- Mobile layouts require no page-level horizontal scrolling.
- Keyboard and screen-reader-critical paths are usable.
- Initial loading and common interactions are reasonable on constrained connections.
- Provider usage is bounded and observable.
- No fixture evidence can appear in production.
- No high-severity security, authorization, provenance, or coaching-policy defect remains open.
- Repository knowledge accurately describes the implemented system.

### 6. Required tests and evaluations

- Complete unit and integration suite.
- Full end-to-end journey suite against a production-like environment.
- Database and Storage authorization tests.
- AI and retrieval regression evaluations.
- Practice-policy red-team suite.
- Job-evidence provenance audit.
- Automated accessibility scans plus manual keyboard and mobile review.
- Visual regression checks for key desktop and mobile screens.
- Performance tests for Home, course listing, Learn restoration, retrieval, and Practice restoration.
- Upload-abuse and request-rate tests.
- Worker crash/retry and provider-outage exercises.
- Smoke tests against the deployed release.

### 7. External services or configuration required

- Production hosting for web and worker processes.
- Production Supabase PostgreSQL, Auth, and Storage.
- Selected hosted generation and embedding credentials.
- Approved job-evidence credential.
- Deployment-secret management.
- Basic monitoring and error reporting.

### 8. Documentation that should be updated

- Final `ARCHITECTURE.md`.
- Deployment and operations guide.
- Environment-variable reference without secret values.
- Backup, recovery, queue, and incident notes.
- Final testing and evaluation report.
- Known limitations and deferred roadmap.
- README setup and product overview.
- Milestone status marked complete with verification evidence.

### 9. Explicitly deferred work

- Native mobile or desktop applications.
- Browser extension.
- Embedded code execution or LeetCode replacement.
- OCR unless validated demand justifies it.
- Voice interaction.
- Dark mode.
- Broad multilingual support.
- Automatic provider failover.
- General job search and application tools.
- Miva dashboard integration.
- Gamification, streaks, XP, or analytics dashboards.

## Definition of MVP complete

The MVP is complete only when:

- Milestones 1–9 meet their acceptance criteria.
- Anonymous identity, ownership, private storage, and server-side secret boundaries are verified. User-facing email/password authentication is not required for the MVP.
- Direct and course-grounded Learn both work.
- Grounded responses use machine-backed citations and source inspection.
- Additional explanation is visibly distinct.
- PDF and pasted-note processing have truthful success and failure behavior.
- DSA Practice uses curated LeetCode metadata without copying protected content.
- Hands Off, Coach, and Tutor pass the approved policy-evaluation suite.
- No fake LeetCode awareness exists.
- A legitimate job-evidence source has been approved and integrated.
- Nigerian and global evidence are supported under the same direct-evidence rule.
- Evidence found, no evidence, and retrieval failure remain distinct.
- Persistent state restores for returning students in the same browser while the anonymous session remains available.
- Core journeys pass desktop and mobile end-to-end tests.
- Accessibility review covers the core journeys.
- The deployed prototype has bounded, observable operating costs.
- `AGENTS.md`, `ARCHITECTURE.md`, README, implementation status, evaluation results, and deployment guidance match the implemented system.
- No critical trust, provenance, authorization, data-loss, or coaching-policy defect remains unresolved.

If no legally and technically suitable job source is found, fixtures must not be treated as MVP completion. That situation requires an explicit product-scope review.

## Dependency diagram

```text
Architecture + plan approval
            |
            v
Pre-implementation repository knowledge
            |
            v
M1 Foundation, anonymous identity, profile, shell
       |             |              |
       v             v              +--------------------+
M2 Direct Learn   M3 Materials                           |
       |             |                                  |
       +------v------+                                  |
              M4 Grounded Learn                         |
                    |                                   |
                    +----------v                        |
                              M5 Practice core          |
                                    |                   |
                         M2 + M5 ---+                   |
                                    v                   |
                              M6 Coaching               |
                                                        |
M1 ----> M7 Job-source evaluation ---------------------+
                    |                                   |
                    +----------+                        |
                               v                        |
                         M4 + M7 + M2                   |
                               |                        |
                               v                        |
                    M8 Industry evidence                |
                               |                        |
             +-----------------+------------------------+
             |
             v
M9 Integration, hardening, deployment
             |
             v
         MVP complete
```

Milestone 7 can proceed alongside Milestones 2–6, but Milestone 8 must not begin real source integration until Milestone 7 reaches an approved go decision.
