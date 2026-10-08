# Miva Buddy

Miva Buddy is a responsive learning companion for Miva Open University Computer Science and Software Engineering students. Students can learn directly or from their course materials, practise curated DSA problems with bounded coaching, and resume their work in the same browser.

## Run locally

Requirements: Node.js 20+, npm, and a configured hosted Supabase development project. Docker is not required. Course-material processing additionally needs the separate worker and an Ollama service with `nomic-embed-text` available.

1. Install the locked dependencies:

   ```sh
   npm ci
   ```

2. Create or update the ignored `.env.local` in the repository root. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the development project. Configure server-only `DATABASE_URL` for PostgreSQL-backed queue work and `AI_PROVIDER`/provider credentials for the desired model. For local embeddings, set `EMBEDDING_PROVIDER=ollama`, `OLLAMA_BASE_URL`, and `OLLAMA_EMBEDDING_MODEL=nomic-embed-text:latest`. See [environment and deployment readiness](docs/engineering/deployment-readiness.md) and [Supabase setup](docs/engineering/milestone-1-supabase-setup.md). Never paste secret values into chat or commit `.env.local`.

3. Start the web application:

   ```sh
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000). First-time students land on onboarding; no email/password sign-in is required.

5. In a second terminal, start the course-processing worker:

   ```sh
   npm run worker:dev
   ```

Without the worker, the web app, direct Learn, and Practice run, but new notes/PDFs remain queued or fail safely until a worker is available. Use only synthetic course content with hosted AI services during development and evaluation.

## Verify

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run check:secrets
```

Hosted Supabase browser tests are opt-in with `RUN_HOSTED_SUPABASE_TESTS=1 npm run test:e2e`; they create temporary anonymous users and synthetic records, so run them intentionally and allow cleanup to finish. The E2E suite starts its own local web server. Check configuration without revealing values with `npm run check:hosted-config`.

## Current release limitations

M7 live-source approval and M8 live-evidence acceptance remain blocked. The development-only industry preview is synthetic, unmistakably labeled, not persisted, and disabled in production. Do not present it as a real job posting. Public release also requires an approved deployment provider, production Supabase and secret configuration, and a production-capable embedding service/worker topology. See [project status](docs/plans/project-status.md) and [deployment readiness](docs/engineering/deployment-readiness.md).

## Project knowledge

- [Agent operating guide](AGENTS.md)
- [Architecture](ARCHITECTURE.md)
- [Approved MVP implementation plan](docs/plans/mvp-implementation-plan.md)
- [Current milestone status](docs/plans/project-status.md)
- Product, UX, and trust requirements in `docs/product/` and `docs/architecture/`
