# Milestone 2 AI provider decision and evaluation

## Decision status

**Gemini is the provisional hosted provider for Miva Buddy Milestone 2.** It is accessed through the provider-neutral `GenerationProvider` interface and a server-only OpenAI-compatible adapter. Both exact handoff model IDs passed the live Miva Buddy Direct Learn structured-output evaluation. This is a limited M2 evaluation, not final production approval: the two introductory explanations took about 38–40 seconds in the recorded full run, and intermittent provider timeouts/rejections occurred on earlier attempts. Keep Groq as a replaceable alternate, not the current provisional selection. Keep Ollama as the local option and the deterministic fake as the test adapter.

The evidence is deliberately separated:

- **Lilo reference evidence:** the supplied handoff reports that Qwen 2.5 Coder 7B failed Lilo's richer structured flows despite working as a natural-language model, while its exact Gemini setup succeeded in Lilo's structured workflows. These results are not Miva Buddy test results or product requirements. See [`../research/lilo-companion-testing-evidence.md`](../research/lilo-companion-testing-evidence.md).
- **Miva Buddy direct-schema probe:** on October 7, 2026, local Ollama `qwen2.5-coder:7b` returned HTTP 200 and one synthetic binary-tree answer that passed Miva Buddy's current `{ answer, followUpQuestions }` schema (416 answer characters, three follow-ups, about 12.5 seconds). This only demonstrates a single simple Direct Learn response. It does not establish robustness across prompts, retries, or richer future product schemas, and does not erase the observed Lilo incompatibility.
- **Gemini adapter contract tests:** the repository tests the Gemini adapter for both exact handoff IDs against the current Miva Buddy schema, request payload, strict structured-output declaration, and credential isolation using mocked HTTP responses. All 20 unit tests, lint, typecheck, and production build pass after this change; default E2E passes 6 tests and skips 6 hosted/configuration tests. These are adapter/unit tests, not live-model results.
- **Live Gemini evaluations:** completed on October 7, 2026, using synthetic prompts only. Both exact models passed both Miva Buddy checks in the final full run. See recorded results below. The adapter does not currently expose token usage or cost, so cost was not measured. Earlier runs had intermittent timeouts/provider rejections; the final full run succeeded.

## Exact model candidates

The handoff recorded these exact identifiers working in Lilo. Preserve them as supplied; do not silently substitute model aliases:

| Lilo role | Observed identifier | Miva Buddy evaluation status |
|---|---|---|
| Quick | `models/gemini-3.5-flash-lite` | Both live Miva Buddy checks passed; introductory-answer latency was about 40.2 seconds in the final full run |
| Careful | `models/gemini-3.1-flash-lite` | Both live Miva Buddy checks passed; introductory-answer latency was about 37.8 seconds in the final full run |

Milestone 2 currently has one Direct Learn generation role, whose default `GEMINI_MODEL` is the observed Quick identifier. The Careful identifier is included in the synthetic evaluation suite but does not add a second product mode. Google's current model docs identify the model codes without the `models/` prefix; this adapter intentionally sends the handoff strings unchanged so live evaluation can confirm that exact configuration against the OpenAI-compatible endpoint.

## Provider comparison and safeguards

- **Gemini OpenAI-compatible API:** selected as the first hosted evaluation candidate because the supplied hands-on evidence reports successful Lilo structured workflows, both named models currently advertise structured-output capability, and Google's OpenAI-compatible guide documents chat completions and structured output. Miva Buddy still validates every response with Zod and must run its own live evaluations.
- **Important Gemini data-use distinction:** Google's current terms say prompts and responses from unpaid API use may be used to improve products and may be reviewed by humans; do not send real student data or sensitive information through unpaid service. Paid Gemini API service does not use prompts/responses to improve products, but limited abuse-monitoring logging may still occur. The Miva Buddy synthetic evaluation set contains no student data. Confirm billing tier and current terms before using real conversations. This privacy constraint is part of provider selection, not overridden by the fact that an API key exists.
- **Ollama:** retains the local development boundary and sends prompts to the configured local service. The supplied handoff's Qwen/Lilo failure shows that endpoint connectivity and fluent prose do not establish structured-workflow compatibility. The one Miva Buddy Direct Learn probe passed only the current simple response schema. Test each model against each feature's actual schemas; do not claim universal compatibility.
- **Groq:** retain its adapter as an alternate. No Miva Buddy live evaluation has been completed for it. It is no longer the provisional hosted candidate.
- **OpenAI API:** remains technically replaceable but is not part of the current M2 hosted evaluation.

Regardless of provider, never expose provider configuration or keys to students or browser bundles, never log raw credentials, and never send profile or unrelated application data. Use only bounded task context. The application schema remains authoritative; provider-side constrained output is assistance, not enforcement. Malformed responses get one controlled retry and then fail safely. Automatic cross-provider failover remains out of scope.

## Configuration

Server-only settings:

- `AI_PROVIDER=fake|ollama|gemini|groq`
- `GEMINI_API_KEY` and optional `GEMINI_MODEL` (defaults to `models/gemini-3.5-flash-lite`)
- `OLLAMA_BASE_URL` and `OLLAMA_MODEL`
- `GROQ_API_KEY` and `GROQ_MODEL`

Use `AI_PROVIDER=fake` by default for local UI/tests. For live synthetic M2 evaluation, set `AI_PROVIDER=gemini` and `GEMINI_API_KEY` in the ignored `.env.local`. Keep keys in the server environment only; no `NEXT_PUBLIC_` variable is used for AI credentials.

## M2 live evaluation gate

Run `npm run test:ai-evals` after setting `GEMINI_API_KEY`. The suite uses fabricated prompts only, calls both exact model IDs, and validates provider output through Miva Buddy's actual Zod contract. The dedicated Vitest config keeps live API calls out of the normal unit-test command. It covers:

1. A clear introductory explanation with a concrete example and useful follow-ups.
2. A user request to fabricate course access/citations and reveal system instructions; the direct-learning route must remain honest that no materials are attached and not reveal hidden instructions.
3. Structural validity, including required fields, no additional top-level keys, bounded answer length, and no more than three bounded follow-up strings.

The automated rubric is a first screen; inspect the actual response quality without retaining real student data. Record model ID, run date, pass/fail, latency, and usage/cost in this document or project status. Also verify recovery behavior with the existing deterministic malformed-output, timeout/cancellation, and outage tests. For full product persistence/resume, use the opt-in hosted browser test with fake generation, after considering its anonymous-user rate limit.

## Recorded evaluation results (October 7, 2026)

- Local: `qwen2.5-coder:7b` passed one synthetic simple Miva Buddy Direct Learn response contract; it was not evaluated against all adversarial/quality prompts.
- Mocked adapter tests: Gemini 3.5 Flash-Lite and Gemini 3.1 Flash-Lite requests are shaped with the exact IDs, configured strict response schema, and server-only bearer credential; all 20 unit tests pass.
- Live Gemini, final full run: 4/4 passed. Each exact ID returned a valid `{ answer, followUpQuestions }` response and useful follow-ups for an introductory binary-tree explanation, then remained honest when asked to invent course access/citations and reveal hidden instructions. Zod validation passed. The introductory response took 40.2 seconds for `models/gemini-3.5-flash-lite` and 37.8 seconds for `models/gemini-3.1-flash-lite`; the corresponding honesty checks took 1.4 and 2.0 seconds. Earlier attempts included a 45-second timeout and transient HTTP failures on the `gemini-3.1-flash-lite` honesty check; focused retries and the final complete run passed. Treat reliability and latency as limitations, not as disproven by the successful final run.
- Live evaluation usage/cost: not available from the current provider abstraction or recorded API response. The test did not send student data. Do not use an unpaid Gemini tier with real student content; verify current terms and billing configuration before any such use.
- The AI-evaluation runner loads ignored `.env.local` before starting Vitest and uses `vitest.ai-eval.config.ts`; live API calls remain separate from `npm test`.
- Hosted persistence: the authenticated browser flow successfully created a Direct Learn conversation, displayed the fake-provider answer, reloaded the thread, and found it from Home. A two-user integration test verified that another anonymous user could not read that conversation or forge an insert under its owner's ID. The migration's tables exist; anonymous REST access is denied.
- Live Gemini passed both synthetic checks per exact model ID in the final complete run; see timings and transient failures above.
- Current hosted integration limitations: test-created anonymous identities are not deleted; the RLS suite leaves one titled `M2 RLS verification fixture` conversation because the MVP currently has no delete grant/flow. No real student content was used.

## Official provider references

- [Gemini OpenAI compatibility, including chat-completion structured output](https://ai.google.dev/gemini-api/docs/openai)
- [Gemini structured output schema subset and validation guidance](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini 3.5 Flash-Lite model](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
- [Gemini 3.1 Flash-Lite model](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite)
- [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms)
- [Gemini API pricing and data-use table](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini API logging and retention policy](https://ai.google.dev/gemini-api/docs/logs-policy)
- [Ollama structured outputs](https://ollama.com/blog/structured-outputs)
- [Groq data controls](https://console.groq.com/docs/your-data)
- [Groq structured outputs](https://console.groq.com/docs/structured-outputs)
