# Gemini usage protections — Phase 1

## Scope and defaults

Every Gemini generation and embedding request reserves shared PostgreSQL-backed usage before contacting Google. Interactive learning and background material preparation have separate daily allowances, with a combined app-wide ceiling and shared concurrency cap:

| Limit | Default per UTC day |
| --- | ---: |
| Interactive, per authenticated user | 120 units |
| Background processing, per authenticated user | 600 units |
| Interactive, app-wide | 5,000 units |
| Background processing, app-wide | 20,000 units |
| Combined app-wide hard cap | 25,000 units |
| Gemini requests in flight, shared across web and worker | 4 |

Interactive includes general Learn, grounded answers and their query embeddings, flashcard generation, and DSA coaching. Background includes document embeddings and concept extraction during material processing. Existing per-route request limits, ownership checks, and timeouts remain additional controls.

The limits are configurable through `GEMINI_INTERACTIVE_USER_DAILY_USAGE_UNITS`, `GEMINI_BACKGROUND_USER_DAILY_USAGE_UNITS`, `GEMINI_INTERACTIVE_APP_DAILY_USAGE_UNITS`, `GEMINI_BACKGROUND_APP_DAILY_USAGE_UNITS`, `GEMINI_TOTAL_APP_DAILY_USAGE_UNITS`, and `GEMINI_MAX_IN_FLIGHT_REQUESTS`. Missing settings use the defaults above. Invalid settings fail server configuration validation rather than silently changing limits.

## Deterministic usage-unit formula

One usage unit represents up to 1,000 estimated tokens. To estimate tokens, the application divides UTF-16 JavaScript string length by three and rounds up. This intentionally assumes fewer characters per token than a typical English sentence, so the estimate errs toward reserving more units.

- **Generation:** `max(1, ceil((ceil(JSON.stringify({messages, responseSchema}).length / 3) + max output tokens) / 1000))`. The output allowance is the complete configured `maxTokens` ceiling (900 when omitted), not observed output. A retry is a separate provider request and reserves again.
- **Embeddings:** `max(1, ceil(sum(text characters + 32 characters of per-text task/title overhead) / 3 / 1000))`. Each submitted batch is accounted separately; small batches still reserve at least one unit.
- The estimate uses only request structure and character counts. It stores neither prompts nor passage text. The owner UUID is accounting metadata and is not included in the provider payload.
- Units are charged when the reservation is accepted, before the network call, and are not refunded on provider failure or cancellation. This is deliberately conservative and prevents repeated failures from being free retries.

Examples (approximate input character counts are shown so the calculation remains reproducible):

| Request | Calculation | Reserved units |
| --- | --- | ---: |
| Short chat question, 1,200 serialized input/schema characters, 900-token output cap | `ceil((ceil(1200/3) + 900)/1000)` | 2 |
| Grounded question with history and retrieved excerpts, 20,000 characters, plus one 1,200-character query embedding | Generation `ceil((ceil(20000/3)+900)/1000)=8`; query embedding `ceil((1200+32)/3/1000)=1` | 9 total |
| Flashcard generation with selected excerpts, 28,000 serialized characters and 2,400-token cap | `ceil((ceil(28000/3)+2400)/1000)` | 12 |
| 500,000-character PDF material, split into roughly 1,200-character chunks and batches of 24 | Embeddings reserve per batch using actual text lengths plus per-text overhead (roughly 195–205 units); selected concept-extraction evidence up to 16,000 characters plus schema overhead and 900 output tokens is about 7 more | roughly 202–212 |

The PDF example is intentionally not a fixed charge: actual page normalization, chunk boundaries, final batch sizes, and selected evidence determine the exact sum. Code applies the formula to each exact request before it is sent.

## Reservation and failure behavior

Migration `0012_gemini_usage_reservations.sql` adds private, RLS-enabled counters by UTC date, category, and scope, plus expiring in-flight reservations. Every accepted reservation increments the user's category counter, the app's category counter, and the combined app counter in the same transaction. A transaction-scoped advisory lock serializes admission across all app instances, including the combined cap and global in-flight count. Browser roles and `service_role` receive no access to the tables or functions; the direct trusted `DATABASE_URL` connection must use the database owner/privileged server role that owns these objects (the normal Supabase `postgres` database role), not a browser/PostgREST role. Keep this credential server-side and verify the role in the separately approved disposable-database validation.

The provider wrapper reserves before every Gemini request, renews its lease while the request is active, and releases the in-flight slot in `finally`. A crashed process cannot hold a slot forever: expired leases are removed during the next reservation attempt. The daily charge remains. A missing owner, invalid response, or database error fails closed without calling Gemini. Limit responses are safe and do not disclose database/provider details.

Gemini adapters classify HTTP 429 as a provider usage/rate limit, request deadlines as timeouts, network/5xx failures as temporary, 401/403 as configuration failures, and other 4xx responses as rejected requests. The provider adapters enforce a 45-second deadline even when called from the background worker; caller cancellation remains distinct. Routes return bounded safe error codes/messages and never surface provider response bodies. The worker retries recognized transient failures with its existing three-retry exponential backoff; provider 429 receives at most one retry, while application usage-limit denials and permanent configuration/request/output failures are marked terminal. Unknown worker failures are not blindly retried. Logs include only the allow-listed failure category and attempt number, not material identifiers or raw errors.

Course material intake has separate protections documented in `material-admission-protections.md`: default five materials and 50 MiB combined per user/UTC day, plus two manual retries per material. These controls complement Gemini unit reservations; they do not replace the existing per-file, page, notes, or extracted-text limits. Migration 0013 remains unapplied until separately validated and approved.

These protections do not change Gemini account-level quotas, model choice, or other providers. Separate allowances prevent background ingestion from consuming the student's interactive-study allowance, while the combined app-wide cap remains a final application safeguard. The unit estimate is an application budget proxy, not a billable-token meter; provider pricing and quota are still governed by Google's account. Every Gemini attempt independently reserves against the appropriate category.

## Migration and verification

Migration source is present locally but must be reviewed and separately approved before applying to any local or hosted database. No migration is applied as part of this implementation. Verification should include focused mocked/unit tests, the repository test suite, typecheck, lint, secret scan, and `git diff --check`; a future isolated local PostgreSQL database test should validate category isolation, combined limits, concurrent reservations, lease behavior, and the required direct database role before enabling this migration in a shared environment. Do not use or disturb the existing development stack for that validation.
