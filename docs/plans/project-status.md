# Miva Buddy Web — Current Project Status

**Updated:** 2026-10-10. **Release status:** Development prototype; no public deployment has occurred. The first public deployment is the V1 release milestone. Internal phases and milestones are development stages, not product versions.

## Current snapshot

- Core Learn, Courses, Practice, Home, Profile, and onboarding experiences are implemented. The recent Practice, Learn, interview-preparation, voice-guidance, and Home refinements are recorded in [`interface-refinement-plan.md`](interface-refinement-plan.md) and have passed their documented local checks.
- General company interview preparation and user-directed external searches are implemented and intended for V1, pending final testing. Guidance is general, not verified company-specific information. Hacker News and LeetCode Discuss links open external searches; Miva Buddy does not retrieve or verify candidate accounts.
- Lecture-to-job relevance currently supports only limited metadata-only related listings: a development-only Remote OK pilot and a separately opt-in Himalayas adapter. Neither verifies that an employer requires a course-derived skill. No job descriptions or excerpts are displayed or persisted.
- No public release, production deployment, or production job-evidence activation has occurred.

## Milestone and release gates

| Area | Status | Current limitation / next gate |
|---|---|---|
| M1–M6: foundation, Learn, course materials, grounded retrieval, Practice, coaching | Complete | Historical acceptance and verification are in the corresponding `docs/engineering/milestone-*.md` records. |
| M7: job-evidence source evaluation | Verification | Remote OK and Himalayas are metadata-only in limited scopes; broader source approval, production controls, and verified job-description evidence are unresolved. See [M7](../engineering/milestone-7-job-evidence-source-evaluation.md). |
| M8: contextual industry evidence | Blocked | Requires an approved source and fresh, directly verified evidence from actual job-description content. Metadata listings do not satisfy acceptance. See [M8](../engineering/milestone-8-industry-evidence.md). |
| M9: integration, hardening, deployment readiness | In progress | Hosting, production services, operational controls, and final verification remain. See [M9](../engineering/milestone-9-integration-hardening.md) and [deployment readiness](../engineering/deployment-readiness.md). |
| Company interview evidence | Future / unavailable | No automated retrieval or verified first-person accounts. General preparation remains available; external searches are user-directed. See the [implementation plan](company-interview-preparation-plan.md) and [evidence roadmap](company-interview-evidence-roadmap.md). |

## Verification and known gaps

- Typecheck, lint, unit tests, production builds, and secret scans passed in the recorded local verification for the completed refinements. Detailed counts and scope are retained in the relevant engineering records and refinement plan; these results do not establish hosted end-to-end acceptance.
- Hosted E2E remains incomplete. The hosted interview-link/mobile journey was not rerun to completion, and hosted persistence/ownership behavior for recent interview refinements was not newly certified. Do not report these journeys as passed.
- Four previously created anonymous development test identities remain awaiting a controlled review. Do not inspect or delete them as part of routine verification; any further hosted run that creates identities needs an approved test-data plan.
- Manual review and release checks are distinct from implementation and local automated tests. See the detailed page acceptance notes in the [interface refinement plan](interface-refinement-plan.md).

## Deployment blockers

- Select and verify a Node-compatible web host and a separately supervised worker runtime.
- Configure a dedicated production Supabase project, private Storage, anonymous-auth abuse protection, and managed secrets.
- Select a production-capable embedding topology; the current course worker uses Ollama and requires a reachable service.
- Establish backups/recovery, monitoring, provider budgets/quotas, retention/deletion, and incident-response operations.
- Keep M7/M8 source approval and excerpt-backed evidence gates closed unless their specific permissions and acceptance criteria are satisfied.
- The full development dependency audit has unresolved `braces` (high) and legacy nested `esbuild` (moderate) advisories; production dependency audit was clean in the recorded M9 snapshot. Recheck before release.

## Historical records

- Original milestone plan and acceptance criteria: [`mvp-implementation-plan.md`](mvp-implementation-plan.md).
- Detailed implementation and verification: [`docs/engineering/`](../engineering/) milestone records.
- Job-source research and decision chronology: [`job-and-interview-evidence-integration-audit.md`](../research/job-and-interview-evidence-integration-audit.md), [`job-and-interview-evidence-research-handoff.md`](../research/job-and-interview-evidence-research-handoff.md), and M7/M8 records.
- Interview architecture and future evidence direction: [`company-interview-preparation-plan.md`](company-interview-preparation-plan.md) and [`company-interview-evidence-roadmap.md`](company-interview-evidence-roadmap.md).
- V1 page refinement scope and test/manual-review boundaries: [`interface-refinement-plan.md`](interface-refinement-plan.md).
