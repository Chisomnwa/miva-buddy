# Interface refinement plan

## Scope and precedence

This is a focused presentation pass after the MVP checkpoint. The current user-approved direction adds **Courses** to primary navigation, superseding the older three-item navigation examples in the UX and visual-design specifications. Product behavior, server-side ownership, retrieval, coaching ceilings, and job-evidence permission gates remain unchanged. This plan does not authorize a V1 release or resolve the M7/M8 release limitations.

The numbered phases below are internal development stages, not product releases. The first public deployment is the V1 release milestone. This document records completed refinement scope; it is not a V1 release plan.

The supplied `public/brand/miva-logo.png` is the source for the original Miva symbol. Show the symbol unaltered beside the Miva Buddy name; do not imply university endorsement. Keep navy/white as the dominant palette.

## Stages

1. **Shared shell and identity.** Reuse the existing navigation and page shell; add Courses on desktop and mobile, replace the placeholder lettermark with the supplied symbol, and use that asset for the favicon. Confirm keyboard focus and narrow-screen fit.
2. **Learning entry and continuation.** Give Home clear Learn/Courses/Practice routes and compact recent course, learning, and practice sections. Clarify the two Learn routes (general questions versus course-grounded concepts), add useful question starters, and improve transcript/code/citation readability with a copy action. Do not blur grounding labels.
3. **Course and Practice surfaces.** Clarify course/material headings and upload choices without changing ingestion. Use owner-scoped session state to distinguish Start from Resume in topic lists; show manual completion honestly. Make coaching more conversational, explain assistance ceilings, and keep attempt/context optional.
4. **Onboarding and profile.** Use consistent form fields and the shared brand; explain personalization and same-browser identity accurately. Show explicit save feedback on Profile without adding authentication UX.
5. **Verification.** Add focused component/route tests and update affected E2E assertions. Run typecheck, lint, unit tests, relevant E2E, build where practical, secret scan, and a responsive/accessibility review. Preserve unrelated worktree changes and do not commit or push until implementation and verification are complete.

## Acceptance

- Core routes remain navigable and responsive; no new dependency, migration, editor, execution environment, or provider configuration is introduced.
- Original symbol appears beside “Miva Buddy” in the shell and onboarding, and supplies the favicon; branding is explicitly student-focused.
- Home, Learn, Courses, Practice, and Profile improvements reflect actual persisted state and retain existing security/learning boundaries.
- Grounded claims still show their source context; synthetic industry previews remain development-only and clearly labeled.
- Relevant automated checks pass, or any environmental limitation is recorded precisely without calling it a passing test.

## Follow-on Phase 1 — Welcome page visual refinement

This focused phase retains the established onboarding form, fields, anonymous-identity flow, supplied Miva symbol, and navy/white identity. Bundle an original, realistic university-library study photograph locally as an optimized WebP; place a light overlay beneath the existing white card and keep the warm surface as the image-load fallback. Check readability, accessibility, and horizontal fit at desktop and phone widths.

For course titles, apply a presentation-only formatter to long `Title_Case_Word` chains in Home and Courses. Do not rewrite persisted titles, file names, course IDs, links, or ambiguous/punctuated user-entered names. The intentionally conservative rule leaves short or mixed-case underscore names unchanged because the current data has no provenance flag that distinguishes a filename-derived title from deliberate punctuation.

Verify with focused formatter tests, onboarding image/fallback and responsive browser checks, typecheck, lint, full unit suite, production build, and secret scan. This phase does not authorize Learn, Practice, provider, authentication, ingestion, or schema changes; it does not change MVP release gates.

## Follow-on Phase 2 — DSA Practice pattern library

Expand the existing metadata-only catalog into an ordered, NeetCode-informed pattern library. Keep all original problem IDs/slugs/URLs and session topic IDs. Verify numbers, titles, difficulties, official tags, canonical links, and public availability against LeetCode metadata; omit uncertain entries and never copy problem statements or solutions. Use one primary teaching pattern per problem to avoid duplicate cards. Show pattern counts, progression, difficulty, relevant tags, and a simple per-pattern difficulty filter while preserving Continue, Start, Resume, manual completion, and external links. Prefix Sum is a technique, not a standalone displayed pattern; keep those existing problems under Arrays & Hashing without reducing the catalog.

Unlike the original V1 presentation pass, this user-approved catalog phase needs one narrowly additive database constraint migration so new pattern IDs can be stored in `practice_sessions`. It must retain all legacy topic IDs and rows. Do not change coaching modes, authorization, provider behavior, navigation design, or LeetCode verification claims.

Acceptance: selected patterns have useful curated coverage; identifiers and metadata are validated; legacy and new sessions can start/resume; mobile topic and landing pages remain accessible without horizontal overflow; coaching safeguards still pass. Verify with catalog/unit checks, hosted browser integration where available, typecheck, lint, build, and secret scan. Record migration and test results in `project-status.md`; do not commit or push before manual review.

## Follow-on Phase 3 — Practice landing-page pattern disclosures

Replace the two-column Practice cards with a single-column set of native, keyboard-operable `<details>` sections. Each expanded pattern shows its existing curated problem metadata and links to the established topic route for difficulty filters and Start/Resume actions. Use only owner-scoped persisted Practice session states for completion styling; opening a pattern or problem never changes completion. Completed status remains explicitly self-reported and is not presented as LeetCode verification. Keep the Continue section and all 14 patterns / 107 catalog entries unchanged. Verify disclosure markup, explicit completion-state rendering, keyboard expansion, Axe/mobile layout in the hosted browser test, typecheck, lint, unit tests, and production build. Manual browser review remains separate from automated checks.

## Follow-on Phase 4 — Practice accordion progress and direct problem entry

Refine the existing single-column Practice accordions without changing the 14-pattern / 107-problem catalog. Pattern headers show self-reported completed/total counts and a proportional, accessible green progress bar (140–180px on desktop, constrained responsively on mobile), aligned with the right-side expand control. Derive completion only from persisted `completed` session state; `in_progress` must remain distinct, and unavailable progress must not be presented as zero. In expanded patterns, use compact responsive problem rows showing status, title, difficulty, and a clear full-row action. Keep a stable four-column layout (status, flexible problem title, difficulty, right-aligned open affordance) and ensure its header and clickable rows use matching column sizing. Active sessions resume their existing route; otherwise the row submits the established server-side session-start action and navigates to the same practice session workflow. Remove the redundant topic-page footer but keep topic routes and their difficulty filters available. Preserve Continue, coaching modes, session ownership, and the explicit disclosure that LeetCode submissions are not verified.

The Continue section preserves its existing session-activity ordering, initially shows the three most recently updated active sessions, and offers an accessible expand/collapse control only when more than three entries exist. Do not synthesize recency if timestamps are unavailable; retain the existing order.

Acceptance: component tests cover zero, partial, full, and unavailable progress plus started/completed distinctions and resume-list sizes 0, 1, 3, and greater than 3; browser tests cover keyboard expansion, direct Start/Resume, explicit completion, four-column non-overlap/alignment, progress-track sizing, resume-list expand/collapse, accessibility, and mobile overflow. Run local verification but do not run opt-in hosted tests that create anonymous identities without approval. Do not commit or push before manual review.

## Follow-on Phase 5 — Learn landing-page refinement

Keep the course-grounded route and general Learn composer separate. Let the Learn introduction use the same content width as its course-learning card; subtly clarify interview preparation as a general-composer use without implying external candidate accounts have been verified. Place the complete general-question heading, privacy note, suggestions, voice-enabled composer, and send controls inside one restrained card while avoiding nested card borders. On Learn only, show the three most recently updated general conversations first and provide an accessible native disclosure for the remaining conversations returned by the existing six-item query. Preserve Home's existing recent-learning presentation and conversation ordering.

Acceptance: focused UI tests cover zero, one, three, and more-than-three conversations; Learn-only disclosure rendering, ordering, links, and collapsed/expanded affordances; and the non-collapsible default used at that time by Home. Home was intentionally outside this phase; the subsequent Home refinement below opts it into the reusable disclosure. Verify typecheck, lint, unit suite, build, and diff. Do not run hosted tests that create anonymous identities or change grounded Learn, persistence, Courses, Practice, Home, or Profile as part of this phase.

## Follow-on Phase 6 — Interview preparation context and response card

Improve interview-intent recognition for first-person interview statements and conversational company questions. Carry explicit company, role, and interview-stage details across follow-ups and recover them from existing saved user messages when older assistant turns lack reliable structured context. Normalize presentation without hardcoding specific companies or corrupting legitimate multiword names.

Present the existing general interview preparation in an initially expanded, keyboard-operable card with company/role/stage metadata and grouped guidance. Keep guidance clearly labeled general, not verified company information. Retain the user-directed Hacker News and LeetCode Discuss search links, with safe company/role query construction; these links are searches, not retrieved or verified candidate accounts. Preserve `source_not_approved`; do not scrape, add an adapter, or claim company-specific interview facts without qualifying evidence.

Acceptance: unit/render tests cover intent, company/role/stage extraction, follow-up and saved-conversation recovery, multiword names, external-link context, evidence labels, and accessible expand/collapse. Run typecheck, lint, focused tests, production build, diff and secret checks. Hosted identity-dependent E2E is optional and must not create additional anonymous identities without an approved test-data plan.

## Follow-on Phase 7 — Speech-recognition permission guidance

Refine only the error messages for the existing browser-native SpeechRecognition flow. Distinguish browser/OS microphone permission denial (`not-allowed`) from speech-recognition service denial (`service-not-allowed`) and give actionable, accurate guidance. Preserve optional voice input, editable transcripts, typed-text preservation, manual submission, unsupported-browser handling, and the no-audio-storage boundary. Do not add providers or APIs.

Acceptance: focused helper tests cover distinct permission/service errors and existing microphone, no-speech, network, and generic errors. Run typecheck, lint, focused voice tests, build, diff and secret checks. No hosted identity-dependent tests are required for copy-only changes.

## Follow-on Phase 8 — Home activity-list expansion

Keep the approved Home design and make Continue Practice and Recent Learning compact by default. Continue Practice retrieves at most 10 owner-scoped active sessions ordered newest-first by `updated_at`; show three first and use the shared accessible Practice resume disclosure for the remainder, preserving metadata, links, and All Topics navigation. Recent Learning retrieves at most six conversations, shows the first three newest-first, and uses the reusable accessible Recent Learning disclosure for the remainder. “Show X more” counts only retrieved entries. Do not add pagination or alter persistence. This phase supersedes the earlier Phase 5 boundary that left Home's recent-learning presentation unchanged.

Acceptance: Home unit tests verify bounded limits, ordering, existing links and metadata, and expansion counts. Run typecheck, lint, Home tests, production build, diff and secret checks. Do not run hosted E2E if it creates anonymous identities without approval.
