# Milestone 4 — Grounded Learn, retrieval, and source inspection

## Implemented boundaries

- `drizzle/0005_grounded_learn.sql` adds optional all-or-none course/material/concept context to Learn conversations, response segments and grounding state to messages, composite ownership foreign keys, and `search_course_material_chunks`.
- The retrieval RPC is PostgreSQL full-text plus `pgvector` reciprocal-rank fusion. It is `SECURITY INVOKER`, filters by `auth.uid()`, requires ready material, and is executable by `authenticated` but not `anon`. No service-role key is used.
- `src/server/retrieval/course-retrieval.ts` embeds the bounded question with the configured embedding adapter, searches the current material first, and broadens only to the same course. It prioritizes current-material evidence, returns at most eight chunks, and distinguishes evidence, insufficient support, and retrieval failure.
- `src/app/api/learn/grounded/route.ts` validates the anonymous Supabase identity, ownership of course/material/concept/conversation, same-origin JSON, request size, and rate. It stores the question, performs retrieval, validates structured response/citation IDs, and stores response segments and grounding status. Direct, ungrounded Learn remains a separate route and cannot open a grounded conversation.
- `src/server/ai/grounded-learning.ts` has an independent structured response contract. Citations must be IDs in the retrieved set. A deterministic lexical-overlap guard strips citations and downgrades a grounded segment if it has no meaningful term overlap with the cited passage. Material-specific questions that receive no cited support become a distinct `no_support` response instead of a general-knowledge substitute. Malformed structured output gets one retry.
- `src/app/actions/grounded-source.ts` resolves excerpt text, title, and page from owner-scoped stored records. `GroundedSourceInspector` opens a native dialog, returns keyboard focus to its trigger on close, and adapts to a mobile bottom sheet. The model never supplies rendered source metadata.

The lexical-overlap check is a deterministic negative filter, not a formal semantic entailment proof. Keep the synthetic claim-grounding evaluations and source inspection as regression gates; do not describe overlap alone as proof that every generated clause is entailed.

## M4 verification record — October 7, 2026

- Hosted migration 0005 applied successfully. Read-only catalog checks confirmed all five new context/response columns and the retrieval function's invoker security and authenticated-only execute grant.
- Unit/integration suite: `npm test` — 49 passed, 1 optional Ollama integration check skipped. Grounded tests cover schema/citation validation and retry, no-support behavior, retrieval failure/state distinction, course-only broadening, current-material priority, and irrelevant-passage rejection.
- `npm run typecheck`, `npm run lint`, `git diff --check`, and isolated production `npm run build` passed.
- Live Gemini Miva Buddy M4 evaluation: 4/4 passed across the exact configured candidates `models/gemini-3.5-flash-lite` and `models/gemini-3.1-flash-lite`, using synthetic excerpts only. It checks cited evidence, a hostile-instruction/fabricated-citation attempt, and the no-evidence material-specific contract. During evaluation the models sometimes drafted uncited general explanations for a material-specific question; server policy deterministically replaced those with `no_support`.
- Hosted synthetic browser flow passed: authenticated course context, Ollama query embedding, PostgreSQL hybrid retrieval, Gemini answer, retrieved-source citation, exact title/page/passage inspection, conversation restoration, cross-user RLS denial for conversation/chunk/RPC, dialog focus return, axe, and 390px overflow check.
- The default local E2E suite passed its onboarding/accessibility/responsive checks; hosted integration remains opt-in. M4's focused hosted browser check ran against an isolated local app copy so the user's existing server was not restarted. The temporary copy and generated browser trace were removed.
- Test-created `TEST-M4` identities and course data were removed. Two older synthetic `TEST-203` fixtures from prior interrupted Milestone 3 tests remain in the hosted development project, as already recorded in `milestone-3-setup.md`; no student data is involved.

## Intentionally unchanged / replaceable

- Query embedding and answer generation remain independent provider interfaces. Gemini is an adapter; local Ollama `nomic-embed-text` remains the embedding option.
- No cross-course or global search, web retrieval, job evidence, OCR, or Practice coaching was introduced.
- Ranking weights, thresholds, database function shape, model IDs, and presentation components can evolve behind the documented contracts and safeguards.
