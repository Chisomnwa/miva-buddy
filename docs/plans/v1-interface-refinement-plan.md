# V1 interface refinement plan

## Scope and precedence

This is a focused presentation pass after the MVP checkpoint. The current user-approved direction adds **Courses** to primary navigation, superseding the older three-item navigation examples in the UX and visual-design specifications. Product behavior, server-side ownership, retrieval, coaching ceilings, and job-evidence permission gates remain unchanged. This plan does not authorize a V1 release or resolve the M7/M8 release limitations.

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
