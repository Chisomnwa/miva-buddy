---
name: gemini-usage-protections
description: Implement, review, or test Miva Buddy safeguards around Gemini generation and embedding costs, quotas, reservations, timeouts, and safe diagnostics. Use whenever changing a Gemini call path or its usage controls.
---

# Miva Buddy Gemini usage safeguards

Use this skill for Gemini provider calls, budget enforcement, reservation logic, and related diagnostics. Follow `AGENTS.md` and preserve its trust, privacy, and verification requirements.

## Read the implementation first

- Read `docs/engineering/gemini-usage-protections.md` and the Gemini section of `ARCHITECTURE.md`.
- Inspect `src/server/ai/gemini-usage-formula.ts`, `src/server/ai/gemini-usage-reservations.ts`, `src/server/ai/gemini-usage-protected-providers.ts`, `src/lib/config.ts`, `drizzle/0012_gemini_usage_reservations.sql`, and `src/server/persistence/schema.ts` as relevant.
- Trace the actual call path and owner assignment before editing. Existing call sites include Learn/grounded generation, flashcards, Practice coaching, grounded-question query embeddings, and background material embeddings/concept extraction. Search for all provider construction and `.generate`/`.embed` calls; do not assume this list is exhaustive.
- Focused regression coverage is in `tests/unit/gemini-usage-protection.test.ts`; inspect adjacent route/provider tests for behavior-specific coverage.

## Required invariants

- Route every Gemini generation and embedding request, including worker/background requests and retries, through the existing server-only protected provider/reservation path. Preserve the category boundary: interactive learning, flashcards, coaching, and grounded-query embeddings are `interactive`; document processing, material embeddings, and concept extraction are `background`.
- Treat `gemini-usage-formula.ts` and the engineering document as the source of truth for deterministic units. Do not duplicate or silently change the formula, defaults, environment setting names, UTC accounting, combined app cap, or shared in-flight limit.
- Reservations are atomic in PostgreSQL migration 0012, fail closed when unavailable, and use expiring leases with heartbeat/release. Preserve user identity, ownership, source grounding, citation validation, route limits, and existing provider timeouts/retry behavior.
- Keep provider keys and privileged database access server-side. Never log or return keys, prompts, lecture passages, raw provider/database errors, stack traces, or sensitive environment values. Translate failures to bounded, student-safe categories/messages.
- Do not add provider calls, persistence, migrations, or new dependencies beyond the request's approved scope. A source-only migration is not permission to apply it.

## Verification and external effects

- Add focused tests for changed estimates, category selection, concurrent/denied reservations, expiry/release, and safe error handling as applicable. Run the focused tests plus `npm run typecheck`, `npm run lint`, and `git diff --check` for implementation changes.
- `npm run test:ai-evals` makes live synthetic Gemini API requests and requires a configured key. Do not run it, make any live provider request, or change provider/account settings unless the user explicitly authorizes that external usage.
- Do not apply migration 0012 to a local or hosted database without separate explicit approval. If database validation is approved, follow `.agents/skills/supabase-migration-validation/SKILL.md`.
- Stop and report if a safe owner identity/category cannot be established, a call bypasses reservations, database access is unavailable, or a requested limit/provider change would alter approved budget behavior. Preserve unrelated user changes and do not stage, commit, push, or deploy unless explicitly requested.
