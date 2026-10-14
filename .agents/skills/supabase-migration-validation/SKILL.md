---
name: supabase-migration-validation
description: Review or validate Miva Buddy Supabase/PostgreSQL migrations, schema compatibility, grants, RLS, or disposable-database behavior. Use before proposing or testing database changes; this skill does not authorize applying a migration to an existing database.
---

# Miva Buddy migration validation

Use this skill for migration, Postgres schema/permission, and migration-validation work in this repository. Follow the root `AGENTS.md`; this skill adds the Miva Buddy workflow, not a replacement for repository policy.

## Read the relevant sources

- Read `AGENTS.md` and `ARCHITECTURE.md` first.
- For Gemini usage reservations, also read `docs/engineering/gemini-usage-protections.md`, the target `drizzle/*.sql`, `drizzle/meta/_journal.json`, `src/server/persistence/schema.ts`, and focused tests such as `tests/unit/gemini-usage-protection.test.ts`.
- For other features, inspect their domain-specific engineering documentation, migration, schema definitions, and tests before making recommendations.
- The guarded local migration entry point is `npm run db:migrate:local` (`scripts/migrate-local-supabase.mjs` and `scripts/local-supabase-migration-guard.mjs`). It verifies the local project identity, Docker identity, and loopback database endpoint before invoking Drizzle.

## Safe workflow

1. Start with read-only inspection. Check migration ordering, SQL/schema alignment, role grants, RLS, transaction/concurrency behavior, and focused tests. Never print `.env` contents, connection strings, credentials, provider data, or raw errors.
2. Validate risky SQL only against a uniquely identified disposable local database when the user explicitly authorizes starting disposable resources. Before creating it, establish that the existing `miva-buddy` stack is identifiable and separate; inspect container identities, ports, mounts, and volumes read-only. Use isolated temporary storage, no existing development volumes, no hosted credentials, and no hosted endpoint. If any identity, port, storage, or authorization check is ambiguous, stop.
3. Apply only the prerequisite schema needed for the target migration, then test the migration's relevant behavior (for example quotas, concurrency, leases, RLS, and role permissions). Compare catalog metadata with Drizzle definitions. Do not use `npm run test:auth:isolation` as a migration-validation shortcut; that is a separate, deferred authentication harness.
4. Clean up only the exact disposable resources created for the approved test. Verify cleanup and confirm the existing development stack's identities and resources remain unchanged. If scoped cleanup is uncertain or fails, stop and report it; never force cleanup.
5. Applying migrations to the existing local stack requires explicit user authorization and must use `npm run db:migrate:local`. Hosted migrations require separate explicit approval for the named target and a reviewed deployment procedure. Never infer authorization from a request to review or validate SQL.

## Verification and stop conditions

- Run relevant migration/schema unit tests and static checks (`npm run typecheck`, `npm run lint`, `git diff --check`) when implementation work is authorized. Report exactly which checks ran; do not imply a database test passed unless it actually ran.
- Stop before service startup or SQL execution if the target is not clearly disposable, any port/resource overlaps, hosted credentials or endpoints would be used, the migration chain is inconsistent, or the user has not authorized that level of mutation.
- Preserve unrelated dirty files. Do not stage, commit, push, deploy, or alter databases unless specifically authorized.
