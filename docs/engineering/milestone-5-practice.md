# Milestone 5 — DSA Practice discovery and session lifecycle

## Implemented boundary

- The reviewable metadata-only catalog in `src/server/practice/catalog.ts` contains 12 entries, verified against official LeetCode problem pages on 2026-10-07. The strict contract accepts only number, slug, title, difficulty, canonical URL, official topic tags, and Miva Buddy topic mapping. No statements, examples, hints, solutions, company lists, or test cases are copied. See [catalog curation](practice-catalog.md).
- Practice landing and topic routes browse the curated set. Selecting a problem creates a session before the student is shown the external LeetCode link. An existing in-progress session for the same user/problem resumes; completed attempts remain historical and a later selection may start a new attempt.
- `drizzle/0006_practice_sessions.sql` stores owner, catalog problem identity, topic, optional source concept, mode, status, and timestamps only. It enables RLS with owner-scoped select/insert/update/delete policies, enforces one active session per user/problem, and binds a contextual concept to the same owner. Migration applied to hosted development Supabase.
- Server actions derive `user_id` from the Supabase session, accept problem IDs only by looking up the server-owned catalog, and update sessions with both row ID and owner ID. Coach is default. Mode changes persist but do not invoke a model in M5.
- Concept titles map to Practice topics only through a small deterministic keyword allowlist. Unmapped concepts show no Practice path. The Learn transition passes the source concept ID through to the session; it does not request another topic selection.
- Completion is a manual student check-in. The app explicitly says it does not observe LeetCode submissions or verify acceptance. A completed session offers the next-problem path. Home shows in-progress sessions.
- Practice has no industry evidence, embedded editor, LeetCode API, browser extension, or claim of LeetCode awareness.

## Verification completed

- `npm run typecheck`, `npm run lint`, `npm test` (62 passed, 1 optional local Ollama test skipped), `git diff --check`, and isolated `npm run build` pass.
- Read-only hosted catalog checks confirm the practice table has 11 columns, RLS is enabled, all four owner policies exist, and the active-session unique index exists.
- Hosted production-mode Playwright flow passed direct topic browsing, mobile topic accessibility/overflow, pre-navigation session creation, session resumption, Coach default, safe external link attributes, mode persistence, owner/other-user isolation and forged-write denial, manual completion and next-problem navigation, completed-state honesty, and a synthetic Learn concept → mapped topic → persisted source-concept flow. Axe reported no violations on topic and session screens. Temporary anonymous identities and synthetic rows were deleted by the test.
- Unit tests verify catalog uniqueness, canonical URL and field allowlists, supported topic coverage, and conservative concept mapping. No provider or protected problem content is part of M5.

## Known boundaries

- The starter catalog is deliberately small and is not comprehensive. Re-check official metadata before adding entries.
- The concept-to-topic map uses deterministic title matching, not an AI judgment or a general concept ontology. It should be expanded only with reviewed mappings.
- A session sourced from a course concept has a same-owner composite foreign key. Deleting that concept is currently restricted while its sourced session remains; deletion lifecycle is a later hardening concern.
- Session modes are persisted only. Deterministic coaching behavior belongs to Milestone 6.
