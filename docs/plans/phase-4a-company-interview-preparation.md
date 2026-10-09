# Phase 4A — Company Interview Preparation: Architecture and Implementation Plan

**State:** Phase 4A planning and Phase 4B.1 implementation/local verification complete. Phase 4B.2 user-directed external search links are implemented and locally verified. Hosted persistence verification remains opt-in.
**Scope:** A small extension to general Learn for attributable, anecdotal interview evidence and clearly labeled generic preparation. This is not an approval to retrieve or reuse third-party posts.

## Existing Web foundation

- General Learn is the authenticated, owner-scoped `/api/learn` flow. It bounds request/history size and rate, persists conversations, and uses the replaceable server-side generation-provider interface. Its current response contract contains an answer and follow-up questions, but no evidence records or citation validation.
- Grounded Learn is a separate `/api/learn/grounded` flow. It retrieves owner-scoped course/material passages, validates citations against retrieved source IDs, and persists grounded response segments. It must continue to answer course questions independently of interview evidence.
- The job-evidence system provides useful patterns—typed result states, source-specific permissions, normalization, attribution, freshness checks, and server-only adapters—but interview reports need a separate contract. Job tags, matching, flags, and permissions must not be reused as interview proof.
- Existing Learn conversation persistence can host the user’s preparation dialogue. Avoid adding interview evidence to course-grounded messages or changing Practice/coaching.

## Research assessment and source decision

### Hacker News / Algolia

The existing Web audit and Desktop handoff identify Algolia’s HN Search API as the best technical discovery candidate among the sources researched: it supports keyword and date-oriented search over HN stories/comments, requires no API credential, and has a published limit of 10,000 requests per IP per hour. The official HN Firebase API exposes stable item IDs, author, HTML text, and an item creation timestamp. That timestamp is the post/comment creation time, **not** the interview-event date. The bounded Desktop sample was mixed and small; it does not establish current coverage or reliable first-person quality for Web.

This establishes technical suitability for a future bounded evaluation—not reuse permission. The Search API page documents endpoints, response fields, and request limits, but the materials reviewed do not clearly grant Miva Buddy rights to retain, quote, summarize, send user-authored post text to an AI provider, or republish derived account content. Algolia’s general Terms govern use of Algolia Services and reserve rights not expressly granted; they do not clearly settle rights in HN user posts or the public HN search endpoint’s content. HN Guidelines are community-use rules, not a content license. Consequently, **no HN text processing, excerpt display, AI summarization, caching, or persistent storage is approved by this plan**. Do not infer authorization from a public endpoint, attribution, direct linking, or successful responses.

**Recommendation:** Keep HN/Algolia as the preferred *candidate for source review*, but gate all live retrieval and content-derived display on a documented, activity-specific approval. No provider outreach is proposed here. Before that gate clears, the application must return `source_not_approved` without querying the source and may offer generic preparation. LeetCode Discuss remains user-opened external reference only; no automated retrieval, scraping, or caching.

### Evidence quality constraints

An HN hit is only a candidate. Company keywords and interview language do not prove that the author personally interviewed with that employer. Qualifying records need an explicit first-person account, unambiguous company identity, and role context only where the source states it. Exclude hearsay, generic advice, job listings, unrelated mentions, ambiguous company aliases, and duplicate records. A newly published post is not necessarily a recent interview: keep interview-event date (nullable), post/publication date, and retrieval/check date separate. Preserve unknown dates and conflicting accounts; do not infer a company-wide process from a small sample.

## Proposed student experience

1. Add a modest “Prepare for a company interview” entry point within general Learn. The student supplies a company and optionally a role; no new navigation destination is needed.
2. Recognize natural-language interview-preparation requests in general Learn with deterministic intent cues. If the company is absent or ambiguous, ask one short clarification. Role is optional; never infer it. An explicit entry point can prefill these slots and avoid brittle company-name extraction.
3. Keep the existing course-grounded composer and route unchanged. If an interview request is made inside a course conversation, keep the course explanation grounded and offer to continue company preparation in general Learn rather than mixing evidence types.
4. When a qualifying, approved evidence source is available, show a small “Candidate-reported experiences” panel distinct from course citations and generic guidance. Each item links directly to its original source and carries attribution, stated role context, interview-event date if known, publication date, and retrieval/check age as appropriate. Include the number of independent accounts and a persistent note that reports are anecdotal, may conflict, and may not reflect the company’s current process.
5. If no qualifying accounts exist, provide a visibly separate “General preparation—not company-specific” response. Never invent company stages, prompts, or candidate experiences. Keep generic preparation useful without implying retrieval succeeded.
6. If access is not approved, say company-specific accounts are unavailable and continue with generic preparation. A failed permitted search and a successful search with no qualifying records must have different copy.

## Target boundaries and contract

Extend the general Learn orchestration only; leave `/api/learn/grounded`, course retrieval, job evidence, and Practice untouched.

- **UI:** reuse the existing Learn landing/composer, conversation, message-content, and citation-link presentation primitives where appropriate. Add a compact interview-prep entry/slot UI and an evidence panel; do not redesign Learn.
- **Server:** add an interview-preparation orchestration boundary called by general Learn after intent/slot validation. It coordinates source permission, bounded retrieval, deterministic qualification, and an optional constrained explanation. Providers remain server-side.
- **Source-neutral evidence record:** stable source and item IDs; canonical company plus verified alias; optional stated role/level/location; source type; original URL; attribution; `interview_event_at` nullable; `published_at`; `retrieved_at`/`last_checked_at`; freshness/availability; and permission basis. Do not include post body or excerpts in the public contract by default.
- **Result states:** `found` (one or more records passed source and evidence validation), `no_evidence` (an approved search completed but none qualified), `failed` (a permitted retrieval could not be completed or validated), `source_not_approved` (no request made), and `clarification_required` (company missing/ambiguous before retrieval). Generic preparation is a separate answer segment and can accompany the non-found states; it is never relabeled as company evidence.
- **Citation discipline:** every company-specific factual claim must reference one or more validated evidence IDs. Deterministic code validates company match, source eligibility, dates, links, and citation IDs. Generation may explain only the approved evidence passed to it. If evidence-content processing is not approved, do not send post text to a model; present no account-derived summary or claims.

## Trust, privacy, and operational rules

- Send only the normalized company, optional role, and fixed interview-search terms to an approved source. Never send lecture documents, student identity, unrelated chat history, or course passages.
- Treat retrieved posts/comments as untrusted data, never as instructions. Sanitize markup and validate source IDs/URLs and allowed hosts; never follow arbitrary links server-side.
- Keep provider/source permission checks before network calls. Separate approval for retrieval, metadata display, excerpt display, AI processing/summary, caching/persistence, attribution, and direct linking. Any unclear activity fails closed.
- Do not persist third-party post text. Until retention and removal rights are clear, keep any approved search transient and return only permitted fields. If approval is absent, do not query.
- Use a strict application-level request budget far below the published per-IP ceiling, request timeout, result cap, and one bounded search per user intent. Do not crawl comment trees or paginate exhaustively. The Algolia rate cap is an operational limit, not a license.
- LeetCode Discuss remains a user-opened link only. The app does not fetch or inspect it.

## Minimal implementation sequence and acceptance gates

### 4B — General Learn intent, clarification, and honest fallback (no live source)

- Add explicit entry/optional company and role slots; support clear interview-intent cues in general Learn.
- Keep course-grounded Learn behavior unchanged. Missing/ambiguous company produces `clarification_required` without a provider call.
- Add `source_not_approved` and generic-only UI for the interview workflow before any provider is wired.
- Tests: ordinary Learn regression; course questions still use grounded route; company/role extraction and ambiguity cases; no source call when unapproved; user-owned conversation scope; generic advice never labeled company-specific; no job evidence or Practice behavior changes.

#### Phase 4B.1 implementation record

- General `/api/learn` recognizes explicit interview-preparation requests. Company, role, and interview stage are extracted only from wording supplied by the student. A missing or ambiguous company produces a persisted clarification; answering that clarification resumes the same owner-scoped Learn conversation.
- A separate interview evidence contract defines `found`, `no_evidence`, `failed`, and `source_not_approved`. The current result is `source_not_approved`; it is stored with the preparation response in the existing `response_segments` column, so no database migration or provider adapter was added.
- The Learn card provides role-aware deterministic technical topics, coding practice, behavioral prompts, and a short study plan. It labels all advice as general, separates it from candidate evidence, and says no external source was queried. Interview turns do not call the general AI provider; ordinary general Learn continues using its existing provider contract. Grounded Learn and Practice are unchanged.
- Verification: full unit suite passed (181 passed, 2 skipped; 25 files passed, 1 skipped); typecheck, lint, production build, secret scan, and `git diff --check` passed. Default Chromium desktop/mobile Playwright passed (16 passed, 16 hosted/configuration-dependent skips). The hosted-auth journey is opt-in and was not run, so live Supabase persistence/ownership for this new flow was not newly revalidated; the feature uses the existing owner-scoped conversation and `response_segments` persistence path without schema changes. The initial sandbox attempt could not bind localhost; rerunning with loopback access completed the browser suite.

#### Phase 4B.2 source-use review — metadata discovery remains blocked

- Reviewed the current [HN Search API documentation](https://hn.algolia.com/api), [Hacker News API documentation](https://github.com/HackerNews/API), [Algolia Terms of Service](https://www.algolia.com/policies/terms), [Algolia Acceptable Use Policy](https://www.algolia.com/policies/acceptable-use/), and [Hacker News Guidelines](https://news.ycombinator.com/newsguidelines.html) on 2026-10-09.
- **Technical capability:** the HN Search API documents unauthenticated programmatic search and response metadata including item IDs, titles where present, URLs, and `created_at` timestamps. It documents a 10,000-request-per-IP-per-hour ceiling. `created_at` is the HN item/post timestamp, not an interview-event date. A bounded, low-rate metadata-only adapter is technically feasible; the rate ceiling is not permission to redistribute results.
- **Permission finding:** the HN Search API documentation describes endpoints, fields, and operational limits but does not state a license or explicit grant for displaying/re-publishing HN item metadata in a third-party student product. Algolia's current Terms govern Algolia's Services and constrain use of those Services, but do not clearly grant downstream rights to HN-authored records or resolve the terms applicable to this public HN search instance. The HN API documentation and community guidelines likewise do not establish the requested third-party metadata-display license. Titles, URLs, IDs, and timestamps are not treated as automatically unrestricted merely because they are public or factual.
- **Decision:** do not implement or call an Algolia/HN adapter, even in opt-in development mode, until the metadata retrieval-and-display use has a clear applicable permission basis. Keep the existing `source_not_approved` response and generic preparation. No API request was made, no provider was contacted, and no external records were fetched, cached, persisted, or displayed. This is an implementation blocker for Phase 4B.2, not a failure of the current preparation flow.
- If the source gate is later cleared, the smallest implementation remains a server-only adapter that sends only company and optional role, uses one bounded query, strict timeout/result limits and HTTPS HN links, projects only expressly permitted fields, keeps publication time distinct from interview-event time, deduplicates by stable item ID, and returns **discovery references only**. It must not set `EvidenceFound`; deterministic first-person/company/role qualification remains a separate later step. No post body, comments, excerpts, summaries, caching, or AI processing are included in this metadata-only phase.
- The existing Phase 4B.1 local checks remain relevant but do not count as discovery-adapter verification. After approval, add adapter tests for query construction, URL allowlisting/canonicalization, timestamp parsing, deduplication, limits, rate-limit/error handling, zero body-field projection, result/evidence separation, feature gating, and owner-scoped Learn persistence/UI. Then run local Chromium and, only with the existing hosted-test opt-in, owner/persistence browser coverage.

#### Phase 4B.2 user-directed external searches

- The Learn preparation card now provides two browser-opened Google search links: one restricted to Hacker News item discussions and one restricted to LeetCode Discuss. Queries are constructed from the already parsed company and optional role using `URL`/`URLSearchParams`; missing-company clarification does not display them.
- This is outbound navigation only. Miva Buddy does not issue a search/API request, retrieve result pages or post bodies, cache/persist third-party records, or call an AI provider with search results. The links are explicitly labeled external searches, not verified candidate experiences; the general preparation remains visible and labeled separately.
- No HN or LeetCode API adapter has been added. No fabricated individual-post URLs are generated. External search results are user-reviewed and are not converted to `found` evidence.
- Verification: focused interview/link/render tests passed (16); full unit suite passed (186 passed, 2 skipped; 26 files passed, 1 skipped); typecheck, lint, production build, secret scan, and `git diff --check` passed. Default Chromium desktop/mobile E2E passed (16 passed, 16 skipped). Unit coverage verifies company-only and company-plus-role query construction, encoded characters, missing/invalid company, external-link attributes, no fabricated post URL, and preservation of generic preparation. The hosted Learn E2E includes outbound-link and mobile accessibility assertions, but it was skipped because hosted Auth is opt-in; therefore those feature-specific browser/axe checks were not executed in this run.

### 4C — Source-neutral qualification and evidence UI using synthetic fixtures only

- Add the separate interview evidence contract and deterministic qualification/normalization helpers.
- Tests: exact/alias company matching, role non-inference, first-person vs hearsay/generic false positives, publication/event/retrieval date separation, duplicate handling, invalid URL/source, deleted/dead records if supplied, freshness state, unsupported claim/citation rejection, failed/no-evidence/source-not-approved states, accessible desktop/mobile panel.
- Fixtures must be marked synthetic and must never render as real evidence outside test/development previews.

### 4D — Optional bounded HN/Algolia adapter, only after source-use approval

- Record the specific authorized activities and limits before enabling requests. Start with one bounded search, small result cap, no persistence, and direct HN links.
- A link/metadata-only mode may be considered only if the approval basis covers those fields and display; it is not automatically authorized or equivalent to verified experience evidence.
- Add mocked adapter tests first, then only a controlled live evaluation within the recorded cap. Verify actual first-person qualification, citations, dates, attribution, source-link behavior, rate limits, timeout/failure, and no logging or persistence of post text.
- Do not send post content to an AI provider or show excerpts/summaries unless that processing/display is separately approved. If approval is unavailable, retain `source_not_approved` and generic preparation; do not block ordinary Learn.

Phase 4B.2's metadata-only review did not clear this gate. User-directed search-engine links are an independent fallback and do not query or display API results. Any future automated metadata discovery must have a separate result contract/UI and must never be represented as qualifying first-person interview evidence.

## Risks and unresolved blockers

- **Primary blocker:** current HN/Algolia published material reviewed does not clearly authorize even the proposed metadata retrieval/display in Miva Buddy, and does not authorize the more expansive processing or public display of HN user-authored interview accounts. Technical search access and rate limits are not sufficient. Phase 4B.2 adapter work and Phase 4D evidence retrieval stay blocked until the exact activities have a clear basis; no outreach is authorized or required in this phase.
- **Evidence quality:** HN search is noisy and the prior sample was not exhaustive or recent enough to promise useful coverage. Some posts omit role or interview-event date. The feature must gracefully fall back rather than lower qualification standards.
- **Company resolution:** aliases and subsidiaries can collide. Use a small explicit alias registry with tests; require clarification rather than fuzzy acceptance when identity is uncertain.
- **Anecdotal bias and privacy:** reports are self-selected and may contain personal/confidential details. Avoid usernames and unnecessary details in summaries; preserve dissenting accounts instead of synthesizing consensus.
- **No first-party submission scope:** user-contributed experiences require separate product approval for consent, privacy, moderation, withdrawal, and retention; not included here.
- **No voice input:** intentionally out of scope.

## Reviewed source material

- Existing Web research: `docs/research/miva_buddy_evidence_research_handoff.md`, `docs/research/job-and-interview-evidence-integration-audit.md`, and `docs/plans/v2-company-interview-preparation-roadmap.md`.
- [Hacker News Search API](https://hn.algolia.com/api) documents search endpoints and a per-IP request limit; this does not grant rights to reuse indexed posts.
- [Official Hacker News API](https://github.com/HackerNews/API) defines item IDs, author, HTML text, and creation timestamp; the timestamp is item creation, not an interview date.
- [Hacker News Guidelines](https://news.ycombinator.com/newsguidelines.html) are community rules, not a content reuse license.
- [Algolia Terms of Service](https://www.algolia.com/policies/terms) govern Algolia Services and reserve rights not expressly granted; they do not resolve underlying HN user-content reuse for this use case.
