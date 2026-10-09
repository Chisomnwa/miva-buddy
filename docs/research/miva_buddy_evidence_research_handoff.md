# Miva Buddy — Job & Interview Evidence Research Handoff

**Prepared:** 2026-10-09
**Research baseline:** Desktop project feasibility investigation dated 2026-10-08
**Audience:** Miva Buddy Web project team / another development conversation
**Status:** Research handoff, **not** approval to integrate or reuse third-party content.

## 1. Where the original research lives

The source research was prepared for the **Miva Buddy Desktop** project, a separate codebase from Miva Buddy Web. Look in the desktop repository:

- `docs/research/evidence-source-feasibility.md` — **primary detailed research**, live API probes, comparisons, rights considerations, and follow-up tests. A later shared copy included the 2026-10-08 addendum; prefer the latest version in the repository.
- `docs/decisions/evidence-decisions.md` — evidence source decision record and approval gates (referenced by the implementation plan and research; verify exact current file contents in the repository).
- `docs/decisions/architecture-decisions.md` — architecture/security constraints.
- `docs/plans/implementation-plan.md` — **M8** industry evidence and **M9** interview evidence requirements, acceptance tests and blockers.
- `docs/research/technical-proposal.md` — broader technical approach, referenced by the feasibility research.

**Important:** This handoff synthesizes the research and implementation plan available in the conversation. It does not replace the full research report or establish new permissions.

## 2. Product goal and evidence principle

Two separate capabilities:

**A. Lecture → industry relevance.** A student uploads a lecture PDF (for example, about SQL indexing or Python). Miva Buddy explains the concept using the lecture and, separately, shows **real job postings** whose actual requirements mention relevant skills. The user should be able to inspect the job title, company, supported requirement text (only when reuse is permitted), source link, and date/freshness information. Do not claim a job posting proves that every employer demands a skill.

**B. Company → interview experiences.** A student asks, for example, “I have an interview at Coinbase; what have other candidates experienced?” Miva Buddy should retrieve **qualifying first-person accounts** for the correct company and role, with source attribution, dates, and clear caveats that experiences are anecdotal. If no qualifying evidence is available, provide honest generic preparation rather than invented company-specific interview details.

Guiding rule from the implementation plan: **Use AI where reasoning is useful, retrieval where truth must come from evidence, explicit state where the application knows something, and deterministic software where a rule must hold.** AI can explain validated evidence but must not invent postings, URLs, excerpts, interview stages, or source identities.

## 3. Executive decisions at the end of the research

| Need | Preferred candidate | Actual decision |
|---|---|---|
| Job postings and requirements | **Arbeitnow Job Board API** | Preferred P0 operational candidate; **conditional** on written clarification of access/reuse, excerpt display, attribution, caching and deletion. |
| Search-targeted job discovery | **Himalayas Remote Jobs API** | Technically verified alternative; more direct keyword search, but similar content-reuse approval questions. |
| First-person interview experiences | **Hacker News through Algolia search API** | Conditional automated-discovery candidate; sample had mixed quality and weak recent-event coverage. Rights and evidence quality remain gating. |
| LeetCode Discuss interview posts | **User-opened external reference only** | Useful recent, detailed posts surfaced via public indexing, but no automated scraping/crawling or caching without written authorization/approved API. |

**No evidence source was approved for production integration at the time of the research.** Publicly accessible JSON and HTTP 200 are not sufficient permission to store or republish text.

## 4. Job evidence — API research

### 4.1 Arbeitnow (preferred initial candidate)

- Endpoint: `GET https://www.arbeitnow.com/api/job-board-api`
- Pagination: `?page=N`.
- Observed access: unauthenticated request returned **HTTP 200**, JSON, **325 job records** in the bounded response tested.
- Observed fields: `title`, `company_name`, `tags`, `location`, `remote`, `job_types`, `url`, `slug`, `created_at`, and full HTML `description`.
- Advantage: directly reachable without a credential in the feasibility test; real descriptions can be checked for literal skills; straightforward paginated feed and local filtering.
- Limitation: no documented keyword-search parameter in the materials examined, so search would require bounded feed retrieval and local matching. `created_at` may represent the aggregator record timestamp, **not** the employer's original job publication date. `url` points to an Arbeitnow listing; it is not necessarily the employer's canonical posting.
- Why preferred: existing evidence decision favored it as the operational P0 candidate, not because its content rights were already cleared.

### 4.2 Himalayas (technically verified searchable alternative)

- General feed: `GET https://himalayas.app/jobs/api`
- Search: `GET https://himalayas.app/jobs/api/search?q=<query>&page=1`
- Official docs describe a public free JSON API without required API credentials.
- **Direct Mac retest on 2026-10-08:**
  - `q=python`: HTTP 200, **19 jobs**.
  - `q=SQL%20database%20indexing`: HTTP 200, **19 jobs**.
  - `q=backend%20engineer`: HTTP 200, **20 jobs**.
- Records included job descriptions, company, title, listing URL, and `pubDate`.
- Advantage: targeted keyword query makes it attractive for mapping lecture concepts to live listings.
- Limitations: observed `pubDate` values were Unix-second numbers despite inconsistent documentation; normalize dates carefully. `applicationLink` can lead to a Himalayas application page rather than the employer's original listing. Excerpt and cache permissions still need clarification.
- Earlier access observations were superseded by these successful direct HTTP retests; do **not** describe Himalayas as technically inaccessible.

### 4.3 Why neither was approved outright

The research did not establish permission for all intended product behaviors: saving full descriptions, showing verbatim requirement excerpts, retaining records locally, cache TTL, attribution wording, revocation/deletion, and downstream display in an educational app. Obtain written approval or an unambiguous applicable license/terms decision before building a live adapter or body cache.

## 5. How lecture-to-job evidence should work

1. **Extract actual lecture text** and retain page-level provenance; do not fabricate successful extraction of scanned PDFs.
2. **Identify concepts/skills** with bounded, validated structured output, such as `SQL indexing`, `Python`, or `database performance`. Verify any lecture page reference against extracted text.
3. **Search one approved source** using bounded requests. Arbeitnow requires local matching over an allowed feed; Himalayas offers targeted keyword queries.
4. **Normalize source records** with actual source ID/URL, company, role, source date (if meaningful), retrieval time, description-derived supporting span, and content hash. Validate URL schemes/hosts and record shapes.
5. **Match the skill to real text** with deterministic lexical matching/ranking initially; local SQLite FTS5 was proposed for *approved* retained records. Do not use an LLM to manufacture a requirement quote.
6. **Display source-backed evidence** with company, job title, relevant requirement excerpt only if permitted, link, provenance, and honest freshness label. Keep AI explanation visually distinct from source quotation.
7. **Handle failures truthfully:** no matching jobs is not the same as a failed request or an unapproved source.

Possible example flow (illustrative only, **not a verified posting**):

> Lecture: “Database indexes speed up certain queries.”
> Miva Buddy: explains indexing with a lecture page reference.
> Industry evidence: a validated listing for a backend role contains a matching database-indexing requirement. The app shows the *actual* title/company/source/allowed excerpt and link, then explains the connection.

## 6. Interview experiences — API research

### 6.1 Hacker News / Algolia (conditional candidate)

- HN public item API and Algolia HN Search were investigated; Algolia provides keyword-based discovery of HN stories/comments.
- Search API base: `https://hn.algolia.com/api/v1/search` (also inspect documented `search_by_date` behavior for date-oriented retrieval). Treat the endpoint as a discovery mechanism, not a database of verified interview experiences.
- Research used small bounded requests, including relevance-sorted samples of **10 hits per company**; these were not exhaustive searches.
- Strict first-person and correct-company-linked qualifying results in the sampled ten:

| Company | Qualifying sample | Important caveat |
|---|---:|---|
| Coinbase | **5/10** | Did not establish dependable recent interview-event coverage. |
| Microsoft | **3/10** | Only **2 distinct narratives** after duplicate accounting. |
| Amazon | **2/10** | Historical or unclear interview event dates. |
| JPMorgan Chase | **0/10** | No qualifying first-person account in this sample; **not** proof none exist. |

- **Crucial:** No confirmed recent interview events were established by the bounded sample. HN timestamps are often *post* dates, not interview-event dates. A search hit containing a company and “interview” is not necessarily a first-person interview account.
- HN/Algolia rights for storing user-authored posts, excerpts, attribution, cache duration and removal were not established; seek written clarification from the relevant rights holders.

### 6.2 LeetCode Discuss (useful, but restricted)

- Publicly indexed Discuss pages exposed seemingly relevant, sometimes 2026-dated first-person interview accounts for Microsoft and JPMorgan Chase, including role/round context.
- Example discovery references recorded in the original research:
  - https://leetcode.com/discuss/post/7619101/ — Microsoft interview experience (March 2026 listing).
  - https://leetcode.com/discuss/post/7769548/ — Microsoft SDE 2 interview experience (April 2026 listing).
  - https://leetcode.com/discuss/post/7124593/ — JPMorgan Chase SDE3 experience.
  - https://leetcode.com/discuss/post/8442904/jpmc-bengaluru-java-aws-lead-swe-vp-inte-a84l/ — JPMC experience identifying an August 2026 event.
- These are **discovery examples**, not authorization to ingest or republish content; link availability and metadata may change.
- The research found LeetCode terms expressly prohibit crawling/scraping/spidering. No automated LeetCode retrieval was performed. Do not build an undocumented endpoint collector, bypass access controls, or store/display posts without explicit permission or an approved API/license.
- Safe fallback: offer **user-directed external search/source links**; the user opens them independently. Do not present uninspected links as verified interview evidence.

### 6.3 What qualifies as interview evidence?

Require, at minimum:

- Unambiguous employer identity (handle aliases carefully, e.g. JPMC/JPMorgan Chase).
- First-person account: the author actually describes their own interview, not hearsay, a job ad, or generic advice.
- Relevant role/level when stated; do not infer missing role details.
- Separate **interview-event date**, **post date**, and **retrieval date**. Mark unknown event dates as unknown; do not call them recent because the post is new.
- Canonical source URL, author when available, stable item ID, and an explicit anecdotal disclaimer.
- Each generated claim must link to one or more qualifying source units; suppress unsupported company-specific claims.
- Duplicate detection and strict relevance/freshness qualification.

For “I have an interview at Coinbase,” the app should return only verified, source-linked candidate experiences if an approved source yields qualifying records. Otherwise say that reliable company-specific accounts could not be established, and offer **generic interview preparation clearly labeled generic** plus user-directed references.

## 7. Shared result states and safeguards

Use distinct typed outcomes:

- `EvidenceFound`: real, validated source records satisfy the request.
- `NoEvidence`: the permitted search succeeded but no qualifying source matched.
- `RetrievalFailure`: network/API/parse/timeout error prevented a reliable search.
- `SourceNotApproved`: access/reuse policy gate is not cleared; do not fetch or present third-party excerpts as though integrated.

Additional requirements:

- Never show fabricated source evidence, fabricated links, fake company names or fixture results in the live product.
- Treat job descriptions, HN posts and any other external text as **untrusted data**, not instructions to the model or app.
- Validate external URLs; sanitize HTML; avoid following arbitrary links or executing source content.
- Keep source date and retrieval time separate; indicate cache/stale status.
- Keep excerpts short and only within approved rights; do not cache full bodies by default.
- Permit independent failure: lecture learning should continue even if job/interview evidence is unavailable.
- Preserve privacy by sending only the task-relevant lecture concepts or employer/role queries to sources; avoid unnecessary student documents or transcript disclosure.

## 8. Approval checklist before implementing a live adapter

**Job evidence (M8):** Choose Arbeitnow or Himalayas; obtain and record written confirmation or sufficiently clear permissions covering API method, metadata, verbatim excerpt display, attribution, allowed storage/cache TTL, removal/revocation, and deletion. Record it in a decision amendment. Then implement/test a single bounded adapter with actual source data and traceable matching.

**Interview evidence (M9):** Confirm HN/Algolia/YC reuse and caching/display terms (or choose another explicitly permitted source), plus minimum first-hand, employer, role and freshness rules. Prove adequate quality with real records; do not lower the bar because searches are noisy. LeetCode remains outbound-only absent authorization.

**For both:** Make sure `NoEvidence`, `RetrievalFailure`, and `SourceNotApproved` are visibly different. Do not mark a disabled capability as an evidence-backed feature completed.

## 9. Transfer notes for the Miva Buddy Web project

The desktop and web products are **separate implementations**. Transfer the **evidence principles, API research, validation rules, permissions gates and result types**, not Electron IPC, Chrome native host, SQLite implementation, or macOS packaging assumptions.

Web-specific choices (backend API routes, caching, credentials, database, rate limits, hosting costs, and CORS behavior) need their own design review. Do not assume that an API reachable from a local Mac is reachable from the web app's server or browser, or that a desktop permission interpretation automatically covers web publication.

**Suggested first step in the other chat:** Read this handoff and the original `evidence-source-feasibility.md`; compare the web project's current implementation against the source-approval gates and evidence-truth rules. Identify what is already implemented and what remains blocked. Do not start scraping or caching unapproved content.

## 10. Original research references

- Desktop `docs/research/evidence-source-feasibility.md` (research checked 2026-10-08; follow-up addendum with direct Himalayas and HN sample).
- Desktop `docs/plans/implementation-plan.md`, especially sections **M8**, **M9**, cross-cutting completion gates and open questions.
- Desktop `docs/decisions/evidence-decisions.md` and `docs/decisions/architecture-decisions.md` (verify latest actual repository versions).
- Arbeitnow API: https://www.arbeitnow.com/api/job-board-api
- Himalayas jobs API: https://himalayas.app/jobs/api and https://himalayas.app/jobs/api/search
- HN Algolia: https://hn.algolia.com/api
- LeetCode terms: https://leetcode.com/terms/

**Research date matters:** All counts and endpoint behaviors above are observations from **2026-10-08**, not a claim of live availability on a later date. Source terms and permissions must be rechecked when implementation is considered.
