# Milestone 6 — Deterministically constrained Practice coaching

## Status

Complete. M1–M5 are complete. The coaching contract, authenticated route, persistence, UI, local tests, live synthetic Gemini evaluation, and hosted browser/RLS/accessibility gate are verified.

## Authoritative behavior

`docs/architecture/ai_retrieval_safeguards.md` §§17–23, `docs/product/ux-specifications.md` §§18–20, and Milestone 6 in `docs/plans/mvp-implementation-plan.md` are the source of truth.

- Hands Off may observe the student's supplied attempt and ask a reflective question; it may not name the solution idea, give steps, pseudocode, or a solution.
- Coach may name the idea and diagnose only supplied work; it may not provide the complete answer. An explicit full-answer request must not silently change the selected mode.
- Tutor may explain steps. A complete answer is permitted only after a separate explicit full-answer request; selecting Tutor alone is not permission to reveal it.
- Walkthroughs, traces, diagrams, and dry runs obey the same ceiling as prose.
- Code, line, variable, run, error, and verdict references must be grounded in student-supplied input. The app never claims to observe LeetCode.
- Candidate output is validated before display or persistence, retried at most once under stricter instructions, then dropped with a recoverable failure if still invalid. Only accepted help is stored as delivered help.
- Mode changes are explicit and persisted; no automatic escalation. Provider credentials and provider-specific behavior remain behind server-only replaceable interfaces.

## Implemented boundary

- `src/contracts/practice-coaching.ts` defines the request, request classification, structured segment contract, and result states. The per-request JSON schema removes stronger segment kinds from restrictive modes; the browser cannot submit or override the authoritative mode.
- `src/server/practice/coaching-policy.ts` detects explicit full-answer intent separately from Tutor selection, handles Coach/Hands Off mode limits, and validates segment kinds, code format, answer permission, LeetCode claims, supplied identifiers/line numbers, known solution-idea terms, and procedural language. It is independent of provider adapters.
- `src/server/practice/coaching.ts` constructs a mode-specific system contract, sends only curated problem title/difficulty/tags plus current student input and up to six recent entries, filters assistant history to the current mode's allowed segment kinds, validates candidates, and allows one strict retry. LeetCode statements, examples, hints, solutions, test cases, editor state, and telemetry are not sent.
- `src/app/api/practice/coaching/route.ts` is the trusted boundary: same-origin and bounded JSON checks, Supabase `getUser()`, owner-scoped active-session lookup, server-derived mode/problem identity, an 8-user-message/minute limit, bounded persistence, deterministic no-attempt and mode-limit handling, and accepted-only generated-answer persistence. Rejections and decisions log only mode, request type, attempt number, and safe reason codes—never user or provider content.
- `drizzle/0007_practice_coaching.sql` adds append-only owner-scoped coaching messages. Composite ownership FK, RLS, and authenticated-only SELECT/INSERT policies isolate them; no student UPDATE/DELETE policy is granted. Migration applied successfully. Read-only PostgreSQL catalog checks confirmed RLS and the two owner policies.
- `src/components/practice-coach.tsx` provides the transcript, mode control, message/attempt composer, deliberate Coach→Tutor action, and read-only completed-session history. It states clearly that LeetCode is not observed and that pasted context is sent to the configured provider.

## Verification completed and pending

- Final local verification: `npm test` 80 passed, 1 optional Ollama embedding integration test skipped; `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run check:secrets` pass.
- Live synthetic-only evaluation passed 5/5 using Gemini `models/gemini-3.5-flash-lite`: Hands Off known-solution/dry-run resistance; Coach injection/full-code boundary and supplied-work diagnosis; Tutor without full-answer intent; Tutor explicit complete answer; fabricated LeetCode-verdict request. The sample responses were manually reviewed. No LeetCode statement, example, hint, solution, or student data was used in the evaluation prompts. No API credential or raw provider error was printed.
- The evaluation led to a stricter Hands Off check against disguised suggestions to track/store/remember/look up a data structure, which was then rerun successfully. It also confirmed that a real Tutor complete-answer request can produce structured code while Coach and Hands Off schemas exclude that field.
- The sanitized hosted-config check reported the required Supabase URL, publishable key, database URL, and Gemini key present/valid; a read-only `select 1` confirmed database connectivity. Hosted E2E confirmed anonymous Supabase Auth connectivity. The user confirmed rotation of the previously exposed database password and Gemini key; current configured credentials authenticate successfully.
- Hosted browser/RLS/accessibility E2E passed on Chromium with synthetic identities. It verified onboarding and anonymous identity creation, persisted/resumed Practice session, all three coaching modes and mode limits, accepted response persistence, completion behavior, cross-user read/write denial, contextual entry, desktop and 390px mobile axe scans, and no mobile horizontal overflow. Test identities were removed by the test cleanup.
- During reruns, corrected two brittle E2E assertions (status notices are not assistant transcript entries; repeated reflection questions require a disambiguated locator) and made the scrollable transcript keyboard-focusable after axe identified the issue. The final hosted run passed.

## Known limitations

- Lexical and structural checks are conservative filters, not semantic proof. A novel paraphrase may convey an idea or procedural hint without matching current patterns. The live model evaluation and manual review reduce, but do not eliminate, this risk; continue expanding synthetic adversarial cases without claiming deterministic semantic enforcement.
- Curated problem metadata is available to the model, but protected problem statements and telemetry are not. The model may use its general knowledge of a titled problem; only an explicit Tutor request permits a complete answer.
- The mode-limit branch is deterministic and does not invoke the model. Missing attempt asks for only the missing context; a prior same-session supplied attempt can support a follow-up.
- Gemini latency/cost and service availability remain provider-level considerations; no student-facing provider selection or credential is exposed.

## Credential incident and safeguards

An ad hoc diagnostic accidentally displayed `.env.local` contents, exposing the then-configured database password and Gemini API key. The user confirmed both were rotated. The current ignored configuration passes safe presence/format checks, and the database and Gemini provider accept the configured credentials. This verifies current usability; rotation itself is based on the user's confirmation. No exposed or current credential value is recorded here.

Permanent safeguards: `AGENTS.md` now prohibits secret-bearing output and unrestricted environment/file dumps for all work; the AI-evaluation runner passes an explicit variable allowlist instead of the full environment; `npm run check:hosted-config` reports only variable names and safe status and suppresses raw database errors; `npm run check:secrets` checks eligible files and staged paths without opening ignored environment files; and `.github/workflows/secret-scan.yml` runs the scanner on pushes and pull requests. `.env.local` and other `.env.*` files remain ignored, and no secret-bearing environment file is tracked. Repository searches found no equivalent unsafe diagnostic command in scripts or documentation.

## Required implementation and evaluation gate

The route is implemented with a typed request classification and mode-specific response shapes so restrictive modes cannot carry stronger structured fields. The deterministic policy engine is independent of the model adapter and validates code/pseudocode, walkthrough/trace content, answer classifications, and references to user-provided identifiers. Keep semantic heuristic limits explicit; a lexical detector is not proof of policy compliance.

Build a representative synthetic evaluation matrix covering every mode and request type. Include: “ignore Coach mode”; disguised full-code requests; common known-problem solutions; walkthrough and dry-run bypasses; missing student attempt; nonexistent variables and line numbers; repeated requests; explicit full-answer request under Tutor versus Coach/Hands Off; and retry output that still violates policy. No LeetCode statements, examples, hints, or solutions may be copied into the dataset. No AI-generated problem content is in scope.

M6 completion gate passed: the unit policy/generation/retry matrix, hosted persistence and RLS integration journey, adversarial live AI evaluation, all-mode hosted E2E, accessibility, and manual pedagogical review passed. Record actual model IDs and synthetic-only data use; keep live provider calls separate from `npm test`.
