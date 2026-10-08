# Miva Buddy Agent Guide

## Read before working

Read the documents relevant to the task before changing the repository. For product or implementation work, start with:

1. `docs/product/product_specification.md`
2. `docs/product/user_journeys_and_mvp_scope.md`
3. `docs/product/ux_specifications.md`
4. `docs/product/visual_design_system.md`
5. `docs/architecture/architecture_requirements.md`
6. `docs/architecture/ai_retrieval_safeguards.md`
7. `ARCHITECTURE.md`
8. `docs/plans/mvp-implementation-plan.md`
9. `docs/plans/project-status.md`

For Milestone 3 work, also read `docs/engineering/milestone-3-setup.md` before configuring database, Storage, worker, or embedding services.

For Milestone 4 work, also read `docs/engineering/milestone-4-grounded-learn.md` before changing course retrieval, citation validation, or source inspection.

For Milestone 5 work, also read `docs/engineering/milestone-5-practice.md` and `docs/engineering/practice-catalog.md` before changing Practice metadata, topic mappings, or session lifecycle.

For Milestone 6 work, also read `docs/engineering/milestone-6-practice-coaching.md` before changing Practice policy, coaching contracts, or evaluations.

For M7/M8 work, also read `docs/engineering/milestone-7-job-evidence-source-evaluation.md` and `docs/engineering/milestone-8-industry-evidence.md`. The current source-approval investigation is sufficient for development: do not repeat the same terms analysis, ask for permission decisions, send outreach, or make live job-data requests unless the user explicitly changes this scope or materially new evidence requires review.

For Milestone 9 work, also read `docs/engineering/milestone-9-integration-hardening.md` before changing global error/loading behavior, security headers, telemetry, deployment guidance, or final verification status.

Use `docs/research/research-and-product-decisions.md` for background and rationale.

## Documentation precedence

When documents differ, use this order:

1. Product Specification and User Journeys / MVP Scope for product behavior and scope.
2. UX Specification and Visual Design System for interaction and presentation.
3. Architecture Requirements and AI / Retrieval / Safeguards for trust rules and technical boundaries.
4. `ARCHITECTURE.md` for the approved technical design and the implemented system map.
5. Research documentation for history and rationale.

Do not silently resolve a genuine conflict. Record it and request review when it changes product behavior, scope, security, cost, or an architectural invariant.

## Non-negotiable invariants

- Learn is the center of the product. Industry evidence is contextual inside course-grounded Learn, not a standalone destination or part of Practice.
- Practice is DSA-focused, uses curated LeetCode metadata and original links, and does not copy protected problem content or pretend to observe LeetCode activity.
- AI explains and reasons; retrieval supplies evidence; explicit application state remembers; deterministic server-side software enforces important rules.
- Course-grounded information must be supported by retrieved material and machine-backed provenance. General knowledge must be labelled separately.
- Job evidence must be retrieved from an approved source and directly support the skill or an approved direct alias. No evidence is better than invented evidence.
- Hands Off, Coach, and Tutor are server-enforced behavioral ceilings. Tutor may provide a full answer only when the student explicitly asks.
- Provider credentials and privileged operations stay server-side. The browser is not a trusted enforcement boundary.
- MVP students go directly to onboarding with no visible signup/sign-in; Supabase anonymous Auth supplies a server-verifiable ID, and PostgreSQL RLS isolates all user-owned rows. Same-browser persistence only; clearing browser data may lose the identity.
- AI, embedding, and job-evidence providers remain replaceable behind narrow interfaces.
- Machine-consumed AI outputs are structured and validated. A failed validation may be retried once, then fails safely.
- Persist explicit, bounded state and send providers only the minimum context necessary for the current task.
- Preserve the documented responsive, accessible, calm visual system. Do not introduce generic chatbot styling, unnecessary dashboards, gamification, or infrastructure controls for students.

## Credential and diagnostic safety

- Treat `.env`, `.env.*` (including `.env.local`), credentials, tokens, connection strings, private keys, and secret-bearing logs as confidential. Never print, display, dump, log, quote, or copy their contents into tool output, documentation, commits, or reports. This applies to every milestone, test, debug session, CI workflow, and provider evaluation.
- Never use commands that expose environment contents or secret-bearing files, including `cat .env.local`, `printenv`, unrestricted `env`, shell tracing around credentials, or broad file dumps/searches that may include secrets.
- For configuration diagnostics, report only variable names and safe status such as present/missing, valid/invalid, or connected/not connected. Do not report values, substrings, hosts, usernames, passwords, tokens, or raw connection errors. Suppress or sanitize provider and database errors before logging.
- Prefer narrow checks and explicit environment-variable allowlists when starting child processes. Never pass or log the full process environment when a smaller set will do.
- Keep local environment files out of Git. Before staging/committing, verify sensitive paths remain ignored and run `npm run check:secrets`. Never force-add a secret-bearing file. Do not commit credentials, private keys, generated secret-bearing logs, or local environment files.
- The secret scan is a practical accidental-leak guard, not proof that a commit is safe. Review staged file names and diffs without exposing secrets; use the repository secret-scan check before commits and rely on its CI check before merge.
- The prior incident was caused by an ad hoc diagnostic that exposed `.env.local` contents. Do not repeat it. Use targeted presence/format checks and sanitized connectivity/evaluation checks instead. No exposed value is reproduced in repository records.

## Milestone workflow

- Work through the approved order in `docs/plans/mvp-implementation-plan.md`, one milestone at a time.
- Do not begin a dependent milestone until all its required dependencies are `Complete`.
- Scoped user-approved exception (2026-10-08): M8 may continue only as a development-only synthetic Learn preview while M7 source approval is blocked. This does not mark M7 complete, approve real-data retrieval/display/cache, waive M7 for M8 release acceptance, or authorize outreach. Keep synthetic examples unmistakably labeled and out of production.
- Scoped user-approved exception (2026-10-08): proceed with all M9 integration, hardening, verification, and deployment-readiness work that does not require live job evidence or a deployment provider decision. Keep M7 live-source approval and M8 live-evidence acceptance blocked and record these as release limitations; do not mark M7–M9 or the MVP complete while their applicable gates remain unmet.
- A milestone may move from `In progress` to `Verification` only after its engineering work is implemented. It may move from `Verification` to `Complete` only after its acceptance criteria, required tests/evaluations, and documentation updates pass.
- After a milestone legitimately completes, update `project-status.md`, `ARCHITECTURE.md`, `AGENTS.md`, and other relevant repository knowledge, then continue to the next eligible milestone without routine user authorization.
- Never mark a milestone complete merely to continue. If verification fails, fix the failure and rerun relevant checks.
- If a genuine product decision, architectural conflict, unavailable required credential/service, legal/source-approval issue, security concern, or other user decision blocks work, mark the milestone `Blocked` and stop with the exact decision or action needed. Do not silently change locked behavior, scope, trust boundaries, or architectural invariants to unblock work.
- Preserve unrelated user changes.

## Verification and documentation

- Run the milestone's relevant unit, integration, end-to-end, accessibility, retrieval, security, and AI-evaluation checks.
- Record completed verification, blockers, decisions, and the next action in `docs/plans/project-status.md`.
- Update `ARCHITECTURE.md` when implementation changes component ownership, runtime topology, boundaries, flows, or replaceable decisions.
- Update deeper documentation when product behavior or an approved technical decision changes; do not leave important decisions only in chat.
- Add commands here only after they exist and have been run successfully.

## Verified project commands

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:embeddings:ollama` (live synthetic local Ollama embedding check; requires `EMBEDDING_PROVIDER=ollama` and the configured model available locally)
- `npm run build`
- `npm run test:e2e` (local onboarding/accessibility/responsive checks; hosted anonymous-user checks are opt-in with `RUN_HOSTED_SUPABASE_TESTS=1` to avoid consuming Supabase Auth rate limits)
- `npm run test:ai-evals` (live synthetic Gemini evaluations; requires `GEMINI_API_KEY` in ignored `.env.local` and makes hosted API requests)
- `npm run worker:dev` (separate material worker; requires hosted PostgreSQL `DATABASE_URL`, a configured generation provider, and the embedding service)
- `npm run check:secrets` (scans eligible repository files and staged paths for common credential patterns and accidentally staged secret-bearing files; never reads ignored local environment files)
- `npm run check:hosted-config` (reports only required variable names and safe validity/connectivity statuses; never prints values or raw errors; database check is read-only)

Update this list only when a command or its behavior changes and the new command has been verified.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
