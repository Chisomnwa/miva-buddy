# Draft permission request — Remotive public API

**Status: Draft only. Not sent. User approval required before sending.**

**Subject:** Permission clarification: attributed job-evidence cards in an educational product

Hello Remotive team,

We are building Miva Buddy, an educational learning product that helps university students understand course material and connect concrete skills to real-world examples. We are evaluating the Remotive public API for a small, contextual evidence card inside a course-grounded Learn conversation. Miva Buddy would not be a job-search destination, application service, job directory, lead-generation flow, or competing job board.

When a course material directly mentions a technology and a relevant active posting is found, the card would show only the role title, company, location if supplied, and a short verbatim excerpt directly supporting that technology. It would identify Remotive as the source and link to the exact Remotive listing. If the API provides or permits an employer-original listing URL, we would like to link to that as well without removing the required Remotive attribution/link. We would not display full listings, accept applications, or require sign-up to reveal a card.

Could you please confirm in writing:

1. Whether this educational, in-context use is permitted under the public API terms and whether it is considered a “third-party job site.”
2. The maximum permitted excerpt length and required source attribution/link treatment; whether an employer-original URL may also be shown.
3. Whether we may cache the returned title/company/location, listing URLs, publication/update metadata, and short excerpt; any retention period and process for removing closed or deleted listings; and whether caching only until the next daily refresh is acceptable.
4. Whether the public API's sharing terms operate as permission for this use notwithstanding the general website Terms of Use, which restrict redistribution of site content without written permission.
5. The applicable request quota and cost for a low-volume student prototype. We would schedule refreshes no more frequently than the public guidance allows and avoid per-page repeated polling; we have not yet fixed a pilot user count.

We will keep provider credentials server-side, use only the documented API, respect the published request cadence, and avoid sending student data to the API. Please let us know whether this use is allowed, whether a paid API or separate licence is required, and any conditions we should implement before testing.

Thank you,

Miva Buddy team
