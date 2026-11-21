# Office Pact — research and selection record

Research completed 21 November 2026, Asia/Kolkata. Event: BEYOND 9TO5, Bengaluru, 21 November, eight-hour brief supplied by the user. Available SerpApi credits: 500 (user supplied, not account verified). Research ceiling: 40. **Actual credentialed research calls: 0; all expected credentials are missing.** See `fixtures/probe-report.json` for execution results.

## Decision, without score inflation

**None of the five ideas presently qualifies for the requested 9/10 selection gate.** The strongest is **Tripwire: Office Pact**, at **8.83/10**. The accompanying implementation plan and Antigravity prompts are a conditional prototype path for that candidate, not a claim that it passed the gate. I would build this candidate if proceeding today; I would not call it a validated 9+ project.

Office Pact helps a small Bengaluru team reconsider an in-person meetup *before people leave*. The team sets a destination, coarse starting locations, maximum acceptable commute, a decision deadline and a remote fallback. It monitors comparable route estimates and area incidents, records deterministic changes, and posts a compact evidence receipt to the team's Nexconn conversation. People choose whether to switch. You.com supplies separately labelled, cited public context; it does not decide whether a numerical threshold was crossed.

Why this is worthwhile: the decision is collective and time-bound. A conventional route app answers how to get there; this prototype records the team's agreed conditions for reconsidering the trip. This is an original product hypothesis, not evidence of validated demand or global novelty.

## Research coverage and limits

I fetched **189 documentation pages linked from SerpApi's main documentation navigation**: the initial 178 API-labelled links plus 11 API-path links whose labels omit “API,” including Search Index, Naver Images and Yandex Reverse Image. I extracted documented inputs and example result keys and reviewed that inventory. This includes engine pages, result-feature pages and auxiliary APIs; it is **not 189 independent engines**. `ENGINE-CATALOG.md` contains a per-page source link, engine identifier where explicitly documented, parameters and example keys. `sources/source-manifest.json` records retrieval hashes. The three proposed engines received a deeper parameter/example review below. No claim is made that every nested feature page, every possible response variant or undocumented engine was examined. [SerpApi documentation](https://serpapi.com/search-api)

The showcase review used the official machine-readable catalogue: **1,071 project records**, including descriptions, tags and declared engines. All records were scanned; nearest overlaps were read and compared. This is a dated catalogue audit, not independent testing of 1,071 applications. Name absence alone is insufficient to establish novelty. `sources/showcase-audit.json` preserves counts and the nearest-neighbour records. [Showcase data](https://github.com/serpapi/BuiltWithSerpApi/blob/main/src/_data/projects.json) · [Showcase](https://serpapi.github.io/BuiltWithSerpApi/)

You.com: read `llms.txt`, product-selection guidance, Search/Answer/Research guides, relevant quickstarts, request controls and rate limits. Its advertised `openapi.json` URL returned an API-selection HTML page, not a single JSON schema; the endpoint-specific Answer reference supplied the contract. [Index](https://you.com/docs/llms.txt) · [Answer reference](https://you.com/docs/api-reference/answer/v1-answer)

Nexconn: read `llms.txt`, Web Chat SDK quickstart, connection and message guidance, Chat UI quickstart, server signing/base URL/rate/token docs, and the nexconn-skills repository's integration, credentials, platform and decision-framework references. Native Android/iOS/Flutter implementations are out of this web prototype's scope. [Docs index](https://docs.nexconn.ai/llms.txt) · [Skill repository](https://github.com/NexconnAI-Dev/nexconn-skills)

Event uncertainty: the organizer listing confirms 21 November and eight hours. Listings disagree about venue, and a published timetable allocates 11:00–16:30 to building despite an eight-hour headline. Confirm the arrival address and code-freeze time from the organizer's latest message. Sponsor tracks are treated as user-supplied requirements, not independently verified judging rules. Pre-event code eligibility is also unverified. [Organizer](https://luma.com/sfljztb7) · [Published timetable](https://vybedriven.vercel.app/opportunities/beyond-9to5-buildathon-bengaluru-2026)

## Saturated territory, with actual project names

These are saturation signals within the reviewed showcase, not claims that every implementation is equivalent.

- Natural-language monitoring: **Wait For It** already watches described conditions and notifies on changes; **signalwatch** monitors keywords; **Sloth Watch** researches changes to a business's software. A universal Tripwire would overlap heavily.
- Decision briefs and evidence: **REALITYOS**, **COMPASS**, **CLARIQ**, **DecisionOS**, **Decision-OS**, **ResearchPilot AI**, **Diamond Evidence Gate**, **Proofline** and **SignalOps × SerpApi — Live Evidence Decision Layer**. Adding citations and human approval alone is not differentiation.
- Flights and price alerts: **Flight Search Script**, **Flight Price Tracker**, **Atlas** and **Gatewatch**. Avoid “tell me when fares drop.”
- Local discovery and meetups: **SideQuest (Study Circles)**, **CircleUp**, **Ditto**, **CloseMates** and **Hello Again**. Maps plus chat plus a place recommendation is already familiar.
- Commute/location research: **CommuteShield** researches transit disruption information; **Cape Town Area Finder** compares areas with rent, routes, amenities and news. Bengaluru localization alone is insufficient novelty.
- Jobs and employer research: **Hermes Job Analyzer** and **HireScout**. A job-search agent with company news would be incremental.
- Business/review monitoring: **Google Maps Business Tracker**, **Review Watchdog**, **SerpSense AI**, **MarketGap** and **AdWatch**. Avoid a generic review/competitor dashboard.
- Deadline and policy watching: **Notice me**, **NoticeDrift**, **PromiseLedger**, **Beacon Hub**, **FundMyDegree** and **KabTak**. A deadline alert needs a sharper workflow than “search, summarize, notify.”

Source for these descriptive comparisons: [official project records](https://github.com/serpapi/BuiltWithSerpApi/blob/main/src/_data/projects.json). Exact records and their repository URLs are included in `sources/showcase-audit.json`.

## White space worth testing

1. **An agreed condition plus a last useful decision time.** Alerting after colleagues have left is too late. A pact captures when checking stops being useful and what action the group agreed to consider.
2. **A visible refusal to infer.** “Area incident found; route impact unknown” and “Estimate unavailable” are materially better than confident, unsupported traffic advice.
3. **Credit-aware monitoring as user-visible service quality.** Show the next scheduled check, source age and pause reason. A scheduler that silently stops when credits expire breaks the promise.
4. **A small evidence receipt.** The exact rule, comparable before/after values, timestamps, source links, and a recorded human acknowledgement make an alert reviewable.
5. **Constrained group consent.** The team approves the threshold and destination in chat. The application owns approval state and versions; an LLM cannot silently edit the pact.

These are hypotheses from the catalogue comparison. Interviews with three actual Bengaluru commuters and a live local-data probe remain necessary.

## Five candidate ideas and brutally honest scores

Equal weights; arithmetic mean of six integer scores. Pain measures likely severity, not proven adoption. Novelty measures distance from the reviewed catalogue. Feasibility assumes one experienced builder, existing coding assistance and an eight-hour prototype, not production readiness. A missing credential does not prove an API is broken, but prevents a validated-feasibility claim. Rare means declared by at most 3% of showcase projects; this is a catalogue proxy, not SerpApi usage telemetry.

| Idea | Pain | Novelty | Depth | 8h feasibility | Demo | Sponsor fit | Mean |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tripwire: Office Pact | 9 | 8 | 9 | 8 | 9 | 10 | **8.83** |
| Offer Clock | 9 | 7 | 8 | 7 | 8 | 9 | 8.00 |
| Rental Claim Ledger | 9 | 7 | 8 | 6 | 9 | 9 | 8.00 |
| Work-App Exit Window | 8 | 8 | 8 | 7 | 8 | 8 | 7.83 |
| After-Hours Seat | 7 | 8 | 8 | 8 | 9 | 9 | 8.17 |

**1. Office Pact.** Engines: `google_maps` for destination resolution; `google_maps_directions` for route estimates; **`google_maps_traffic`** for area incident changes. Traffic is declared by 0/1,071 catalogue records; Directions by 27/1,071. Nexconn carries the pact and decisions; You.com adds cited context. Scope: one destination, two participants, driving mode, one compact incident area. Novelty loses two points because monitoring and meetup coordination already exist. Feasibility loses two because local coverage, freshness and SDK delivery are untested. Traffic observations must not be represented as route-specific causality.

**2. Offer Clock.** An employee comparing two offers gets a dated employer-evidence packet before the acceptance deadline, with questions to ask the recruiter. Engines: `google_jobs`, **`glassdoor_reviews`** (0 declared), `google_news`. You.com explains conflicting reports; Nexconn supports a private mentor conversation. Adjacent to HireScout and job agents; self-selected reviews and entity matching are weak evidence. No automated employer “trust score.”

**3. Rental Claim Ledger.** Two working flatmates compare the landlord's stated location, photographs and commute against public evidence before a visit. Engines: `google_maps`, `google_lens`, **`google_reverse_image`** (5 declared), plus Directions if time permits. Chat records which claims were actually checked. Close to visual-search and housing research; image permission, matching errors and route quality make eight hours risky. Never label a listing fraudulent merely because an image is reused.

**4. Work-App Exit Window.** Professionals depending on one mobile work tool watch for a dated vendor notice plus corroborating changes in app reviews before planning a migration. Engines: `google`, `google_play_product`, **`apple_reviews`** (2 declared). Chat records the migration decision; You.com cites vendor notices. Adjacent to Dependency Drift Radar and Sloth Watch. Review spikes do not prove outages, and combining app identities across stores takes care.

**5. After-Hours Seat.** A small team agrees whether an evening professional event is still worth attending by a departure deadline, given the event's published details and individual travel limits. Engines: **`eventbrite`** (0 declared), `google_maps`, `google_maps_directions`. Nexconn captures agreement; You.com provides organizer-source context. The distinction is a departure decision, but catalogue meetup tools are close and ticket availability is not reliably inferred from search listings.

All five named concepts were checked against the catalogue, with no exact concept match found at this scope. This does not establish worldwide originality. Each has a rare engine with an actual product role; availability of that engine in Bengaluru remains a separate question.

## Tripwire assessment

The broad concept scores **8, 6, 9, 6, 8, 9 → 7.67/10**: useful, technically substantive, but directly adjacent to Wait For It, and arbitrary natural-language conditions multiply connector, semantic and scheduling failures. Deterministic change detection is credible only after defining a stable entity, a typed observation, a comparable query and explicit unknown states. Hashing a whole search response is not meaningful detection: rank, snippets, tracking URLs and metadata change without changing the decision.

Office Pact is the constrained version. LLM-free numerical rules, stable query parameters, replay-safe observations and a fixed decision window make the core explainable. Its proposed moat is a good workflow, not proprietary data or an unprecedented algorithm.

## Verified contract: three proposed SerpApi engines

“Documented” below means observed in the current official parameter text/example. **None is live-verified in this workspace.** Result fields are not promised for every query. `fixtures/field-contract.json` enumerates every provider field the MVP may consume and its required/optional treatment. Application-owned fields such as `observedAt`, `ruleVersion` and `snapshotHash` are not provider fields.

Common transport: `GET https://serpapi.com/search.json`, `api_key`, `engine`, JSON output. Read `search_metadata.id`, `.status`, `.created_at`; handle top-level `error`. Cached queries must match all parameters and expire after one hour; cache hits are free. Set `no_cache=true` for a paid fresh Directions/Traffic poll after the application TTL. Do not combine `no_cache` with `async`. No pagination or asynchronous retrieval is needed in the MVP. [Directions](https://serpapi.com/google-maps-directions-api) · [Traffic](https://serpapi.com/google-maps-traffic-api)

### Google Maps — `google_maps`

- Request for this prototype: `q=coworking Bellandur Bengaluru`, `ll=@12.929,77.676,14z`, `type=search`, `hl=en`, `gl=in`. `q` and `ll` are supported; `ll` uses `@latitude,longitude,zoomz`. Pin the user's selected result rather than reselecting the first result on every poll.
- Documented output: `local_results[]`, with `title`, `place_id`, `data_id`, `address`, `gps_coordinates.latitude/longitude`; optional display-only `open_state`. Missing identity/coordinates means no automatic selection. There is no assumed seat inventory, Wi-Fi reliability or bookable availability field.
- Role: setup and explicit destination refresh, not polling for coworking vacancy.

[Maps parameters and examples](https://serpapi.com/google-maps-api)

### Google Maps Directions — `google_maps_directions`

- Use `start_coords`, `end_coords` in `latitude,longitude` format, `travel_mode=0` (driving), `distance_unit=0` (km), `hl=en`, `gl=in`. Address or data-ID alternatives also exist. Use one endpoint representation consistently.
- `time` supports `depart_at:<Unix seconds>`, `arrive_by:<Unix seconds>` and transit-only `last_available`. MVP omits `time` and explicitly presents a current estimate; it does not forecast an arbitrary future appointment. Do not compare different modes or different departure-time semantics.
- Output: `directions[]` with `travel_mode`, numerical `duration`, `distance`, display `formatted_duration`, `formatted_distance`; `via` is optional. Select the minimum valid duration across returned Driving alternatives. Ranking changes alone are not events. Validate numeric units against the paired formatted values during the first live probe before using the seconds/metres interpretation in a UI.
- No invented `duration_in_traffic`, congestion probability, route polyline or guaranteed arrival timestamp. Missing routes yield UNKNOWN, not zero minutes. Search results are estimates, not a safety or punctuality guarantee.

[Directions parameters and example](https://serpapi.com/google-maps-directions-api)

### Google Maps Traffic — `google_maps_traffic`

- Required `bbox` is **north,west,south,east**: top-left latitude/longitude then bottom-right latitude/longitude. Probe uses `12.97,77.64,12.90,77.71`, `zoom=13`, `gl=in`, `hl=en`.
- Documented zoom range 10–21, default 16; area must fit at most 1,024 map tiles at the chosen zoom. More zoom can expose more markers. Keep bbox and zoom fixed for comparisons.
- Output: `traffic_incidents[]`; `incident_id`, `type`, `title`, `gps_coordinates.latitude/longitude`, optional `description`, `details[]`, `last_updated`. Examples include `road_closed` and `construction`; do not treat these as an exhaustive enum. Distinct markers can describe the same long closure.
- A newly seen ID means newly observed by this watch, not necessarily a newly occurring incident. An absent ID does not establish clearance. Incident notices trigger a fresh route check; only comparable route estimates can satisfy a commute threshold.

[Traffic parameters and examples](https://serpapi.com/google-maps-traffic-api)

### Rate limits and credits

SerpApi limits are account-specific. **500 available credits does not establish the hourly rate limit.** The free Account API documents `account_rate_limit_per_hour`, `this_hour_searches`, `total_searches_left`, `plan_searches_left`, and `extra_credits`. The exact account limit is unknown without a key. Check it at startup; conservatively queue requests one at a time, but recognize that even 1 request/second is not a substitute for an hourly cap. 429 must delay work, never launch a retry storm. [Account API](https://serpapi.com/account-api) · [Status codes](https://serpapi.com/api-status-and-error-codes)

The research probe reserves a credit before every SerpApi search attempt in SQLite, conservatively counting failures and possible cache hits; the cumulative local ceiling is 40. It does not control other tools or processes using the same API key. Do not delete/reset the ledger to bypass the ceiling.

## You.com contract and role

Use **Answer API**, `POST https://api.you.com/v1/answer`, header `X-API-Key`, JSON `{query: ...}`. Query is required, nonblank and at most 400 characters. Optional `freshness` accepts day/week/month/year or a documented date range. The MVP uses only `query` and `freshness=week`; it does not assume old Research API fields. Response: `answer` Markdown, `citations[].source`, `citations[].excerpts[]`, `results.web[].url/title/snippets[]`. Reject non-http(s) citation links; display evidence as public context with its retrieval timestamp. An answer is not allowed to fabricate an explanation for a route change. [Answer guide](https://you.com/docs/guides/answer) · [Endpoint reference](https://you.com/docs/api-reference/answer/v1-answer)

Self-service default: **10 requests/second** for Answer, Search and Research; enterprise contracts may differ. A 429 may have `X-RateLimit-Limit/Remaining/Reset`; Answer currently need not return `Retry-After`. Honour it when supplied, else reset time or capped backoff. Application ceiling: one concurrent Answer call, maximum 12 for the build session. [Rate limits](https://you.com/docs/rate-limits)

Why not another research agent? Answer supplies a cited context paragraph with one integration. Search is useful if owning retrieval; Research adds effort tiers and broader latency/cost. The deterministic detector requires neither. Do not send colleagues' home addresses or private chat to You.com.

## Nexconn contract and integration choice

Use a **Group Channel** for persistent small-team conversation; Open Channel is the wrong assumption for an offline-readable team pact. Prefer a compact Web Chat UI panel alongside application-owned pact/evidence views (Layer 1 native group chat, with external application UI). Evaluate documented theming before choosing a custom headless chat build. No SDK fork. [Skill](https://github.com/NexconnAI-Dev/nexconn-skills/blob/main/skills/nexconn-chat/SKILL.md) · [Web Chat UI](https://docs.nexconn.ai/chatui-web/quickstart)

Server token probe: `POST /v4/auth/access-token/issue` on the app's actual regional base URL. Required JSON `userId`, `name`; optional `avatarUrl`. Headers `App-Key`, random `Nonce` (≤18 characters), `Timestamp` in **milliseconds**, and lowercase SHA1 hex of `AppSecret + Nonce + Timestamp`. Documented success: `code=0`, `result.accessToken`, `result.userId`; rate **200 requests/second**. Base URL must match the console region; Singapore primary is `https://api.sg-light-api.com`. The probe requires an explicit `NEXCONN_API_BASE` rather than guessing the account's region. [Token](https://docs.nexconn.ai/platform-chat-api/user/register) · [Signing](https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/auth) · [Regions](https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/base-url)

**Documentation conflict:** Web quickstart shows an older `code:200, token, userId` token example, while the v4 registration reference specifies `code:0, result.accessToken`. The probe targets v4 and validates that contract; do not silently mix the examples. SDK connection separately returns `code=0` and `data.userId`. [Web quickstart](https://docs.nexconn.ai/chatsdk-web)

Server alert path: `POST /v4/group-channel/message/send`, signed; documented **20 messages/second**. Use one sandbox group and plain text links first. Documentation has potentially confusing `toChannelIds` type/rendering; inspect its request example and the installed server SDK before wiring this endpoint. The supplied probe issues a token only; it does not establish message delivery or SDK success. [Group send](https://docs.nexconn.ai/platform-chat-api/message/send-group) · [Limits](https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/limits)

Web packages documented: `@nexconn/engine`, `@nexconn/chat`; lifecycle is initialize once → register handlers → connect → operate → clean up owned handlers. Exact installed package versions/signatures and real delivery remain **unverified**. The build prompts require checking installed declarations and proving a message appears in two browser sessions. Token endpoints must derive identity from the app session, not an arbitrary client-provided user ID.

## Feasibility verdict and upgrade gate

Confirmed: public contracts for three SerpApi engines, a cited-answer API and Nexconn server token issuance; reproducible probe scripts; local deterministic-rule and credit-cap tests. Unconfirmed: live Bangalore responses, actual response fields, numeric-unit consistency, Traffic coverage, hourly quota, Nexconn SDK connection and alert delivery, deployment persistence, user demand and final UI quality.

To reconsider a 9+ rating: obtain nonempty Bengaluru place/route data; observe Traffic response semantics even if empty; confirm unit consistency; deliver a real Nexconn message to two test sessions; demonstrate one actual snapshot plus an explicitly labelled synthetic change; interview three professionals about the pact workflow; complete a timed rehearsal. These gates do not automatically guarantee a 9. Re-score with the evidence.

**Self-rating of the current project proposal: 8.8/10. Live integration proof: incomplete.** Assigning a minimum 9 because requested would contradict the requested brutal honesty.
