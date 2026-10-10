# Company Interview Evidence Roadmap

**Status:** Future work; automated interview-evidence retrieval is not implemented or approved. General interview preparation and user-directed external search links are implemented and intended for the first public release, pending final testing.
**Research reviewed:** October 8, 2026.
**Scope:** A possible future capability for verified, attributable first-hand interview accounts. This roadmap is not a product release/version plan and does not authorize retrieval or reuse of third-party content.

## Product intent

Help a student prepare for a particular company and role by surfacing dated, attributed evidence from people who personally participated in those interviews. This is an evidence-browsing and study aid—not a promise of what a company will ask, an official company guide, or a job board.

## Evidence and source policy

Potential public evidence includes interview reviews on [Glassdoor](https://www.glassdoor.com/Interview/index.htm) and first-person interview discussions on [Reddit](https://www.reddit.com/r/). These are useful discovery references, not blanket licenses to ingest or republish their content. Glassdoor's [Terms of Use](https://www.glassdoor.com/about/terms-2020-09-03/) prohibit scraping/mining and reuse of its content without express written permission, and provide only a limited personal-use license to ordinary users. Reddit's current [Public Content Policy](https://support.reddithelp.com/hc/en-us/articles/26410290525844-Public-Content-Policy) distinguishes non-commercial uses from commercial purposes; its [Developer Terms](https://redditinc.com/policies/developer-terms) allow display through an app only where the applicable developer service and documentation permit it, reserve third-party content rights, restrict commercial use without approval, and prohibit using/caching data for model training without permission. Do not scrape, persist, quote, summarize at scale, or feed either source to an AI model without an approved access path and rights review.

Preferred pilot source: voluntary, first-person submissions from Miva Buddy users, collected with explicit, revocable consent that separately covers private storage, de-identified display, short quotations, and AI-assisted transformation. Make private-by-default the baseline; never publish a submission merely because it was shared with the product. A submitter must be able to choose attribution level, edit or withdraw an account, and exclude confidential interview material. If consent or rights are unclear, retain no public-facing evidence.

Every evidence item should distinguish:

- **First-hand account:** the submitter says they personally participated; record interview date, role/seniority, geography, and submission date where safely available.
- **Secondary reference:** a link to someone else's report, not verified by Miva Buddy. Keep it as a citation-only pointer unless that source's terms explicitly authorize further reuse.
- **Official employer material:** company-published process information, shown as official only when linked to a current employer-controlled source. Do not blend it with candidate accounts.

## Evidence model and display rules

Each claim should be traceable to one or more evidence records containing a canonical company and role family, interview date (or an explicit unknown), source URL or consented internal record ID, source type, last verification date, permission basis, and removal/expiry state. Store only fields required for matching and display. Do not retain full third-party text unless the rights basis expressly permits it.

Display evidence as dated reports, not predictions. A card should identify the company, role/level and region when known; label the source as candidate-reported or official; show the interview date and report count; link directly to the original source where public; and mark any paraphrase as a summary. Quote only within an approved permission basis and a reviewed excerpt limit. Do not display usernames, identifying details, confidential questions, or inferred personal attributes.

Rules for all company-specific output:

1. No evidence, no company-specific claim. Never let a language model fill gaps with common interview lore or invented company practices.
2. Attach citations to each factual statement, with the source and interview date visible. “A report says…” is not “the company always asks…”.
3. Separate exact reported prompts from broad topic labels. Do not turn a single account into a predicted question or claim that a question is current.
4. Show sample size and age. A single account is anecdotal; conflicting reports remain visible as variation rather than being averaged into certainty.
5. Keep interview evidence distinct from Miva Buddy's educational exercises. Practice questions generated for learning must be labeled as practice—not as real company questions.

## Freshness and validation

- Record `interview_date`, `submitted_at`/`published_at`, `last_checked_at`, and `last_seen_at` independently; never treat a page's current crawl date as its interview date.
- Recheck public source links only through an authorized API/feed or a source-permitted method. No unrestricted scraping, anti-bot workarounds, or repeated probes.
- Propose a 180-day freshness review for company-process summaries. After the review date, mark evidence **older / not recently verified**; do not silently present it as current. An expired or removed source is hidden from active results while its permitted audit record is retained only as policy allows.
- Revalidate company identity, role family, and source URL deterministically. Keep distinct reports distinct; deduplicate only when the same source record is demonstrably duplicated.
- When evidence is sparse or conflicting, reduce the scope of the summary or show the reports separately. Never infer a company-wide pattern from a small sample.

## Proposed delivery sequence

1. **Rights, consent, and privacy gate:** approve the submission consent language, retention/deletion policy, moderation and takedown path, third-party source rules, and the meaning of public versus private submissions.
2. **Evidence catalog:** implement company/role normalization, evidence provenance and permission fields, freshness state, direct citations, consent withdrawal, and synthetic-fixture tests. No external imports by default.
3. **First-party pilot:** allow a small opt-in cohort to contribute their own interview experiences. Keep contributions private unless the contributor separately chooses de-identified sharing. Add review/moderation before publication.
4. **Learn integration:** add a company/role evidence panel that explains what is supported, by which dated accounts, and what remains unknown. Retrieval returns evidence records; generation may summarize only those records, and deterministic validation rejects uncited or overconfident claims.
5. **Licensed-source expansion:** evaluate each public source independently. Enable only its expressly permitted retrieval, storage, excerpt, transformation, attribution, and cache behaviors. Keep all other fields and actions disabled.
6. **Pilot evaluation:** measure citation coverage, stale-link rate, correction/takedown time, unsupported-claim rate (target zero), and student usefulness. Expand only after privacy, security, source-rights, and quality review.

## Release gates and non-goals

This roadmap is not an MVP acceptance criterion. Before implementation, product approval is needed for the user-submission model and privacy/consent behavior. A source-specific rights decision is needed before importing third-party interview accounts. Any source without explicit reuse authorization remains link-out-only or excluded. Do not collect private forums, bypass logins, infer identities, train/fine-tune models on interview accounts, or promise interview outcomes.

This roadmap is informed by the fact that established services publish candidate interview reviews (for example, [Glassdoor's interview-experience index](https://www.glassdoor.com/Interview/index.htm)) and by their applicable data-use constraints. It does not reproduce or assert any company-specific interview question or process claim.
