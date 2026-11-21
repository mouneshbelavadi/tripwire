# ASTRA — complete project context and Antigravity build prompts

## Read this first

You are building **Tripwire: Office Pact**, a conditional buildathon prototype for Bengaluru working professionals. This document is intended to travel with the repository into Antigravity IDE. Read it completely before generating code. Work one phase at a time, preserve working code, and report the actual checks run after each phase.

The event is BEYOND 9TO5, Bengaluru, **21 November 2026**. The user supplied an eight-hour constraint, SerpApi / You.com / Nexconn sponsor tracks and 500 SerpApi credits. Research may use **at most 40 credits**. Current research spend: **0**. Do not confuse total credits with hourly throughput. Confirm the actual event timetable and whether preparatory code is allowed. Organizer listings conflict about address and building time; use the latest organizer instructions. [Organizer listing](https://luma.com/sfljztb7)

The user explicitly wants a professional, deliberate interface. They rejected a prior generic AI-looking design. Avoid oversized hero copy, decorative gradients, glass panels, glowing cards, fake live indicators, invented metrics and an empty chatbot shell. Deliver a useful work surface with a clear decision, evidence and discussion.

### Honest selection status

**No researched candidate currently passes 9/10.** Office Pact is the best of five at **8.83/10**: pain 9, novelty 8, depth 9, eight-hour feasibility 8, demo strength 9, sponsor fit 10. This is the candidate to prototype if proceeding, not an evidence-backed winner or guaranteed 9+ project. Do not raise the number to satisfy a requested minimum. Full scoring and alternatives are in `RESEARCH.md`.

The generic Tripwire concept scored 7.67. The showcase already contains **Wait For It**, which watches natural-language conditions and notifies on changes. It also contains **signalwatch**, **DecisionOS**, **REALITYOS**, **COMPASS**, **SideQuest (Study Circles)**, **Ditto** and many other adjacent tools. Office Pact's proposed distinction is a shared, versioned condition plus the last useful decision time, with deterministic evidence and explicit uncertainty. It is not “the world's first monitoring agent.” [Showcase catalogue](https://github.com/serpapi/BuiltWithSerpApi/blob/main/src/_data/projects.json)

### What has actually been done

- Audited SerpApi's engine/API navigation, including inputs and example result keys; see `ENGINE-CATALOG.md` and `sources/source-manifest.json` for exact scope.
- Scanned 1,071 showcase records and compared the closest concepts. Traffic engine declarations: 0; Maps Directions: 27. This is a showcase proxy for rarity, not worldwide API usage.
- Read You.com's `llms.txt`, selected endpoint documentation, and Nexconn's docs and skills repository.
- Wrote standard-library Python probes for Maps, Directions, Traffic, You Answer and Nexconn v4 token issuance.
- Executed probes: all credentialed requests **SKIPPED** because environment keys were absent. No real provider response fixtures exist yet. Web SDK connection/delivery is also unverified.
- Wrote a local deterministic rule kernel and 15 passing unit tests. This is not a deployed product, complete scheduler, frontend or production-ready service.

### Package map

- `RESEARCH.md`: evidence, overlap analysis, five ideas, score rationale, verified documentation contracts, live gaps.
- `ENGINE-CATALOG.md`: engine-document coverage inventory and official links.
- `BUILDPLAN.md`: architecture, schema, eight-hour schedule, credit allocations, cache policy, risks and three-minute demo.
- `fixtures/field-contract.json`: allowed provider fields and documented provenance.
- `fixtures/probe-report.json`: actual execution report; do not convert skipped checks into passes.
- `scripts/probe_apis.py`: guarded real-call probes, skip when keys are absent, preserve response bytes.
- `scripts/tripwire_core.py`: local rule proof; use as a specification when porting to TypeScript.
- `scripts/test_core.py`: invariant tests; all synthetic, not live traffic evidence.
- `.env.example`: variable names only. Real secrets must remain out of version control.

## Product in one concrete story

Maya and Arjun work in Bengaluru and plan a Bellandur office meetup. They start near Indiranagar and HSR Layout. Before the meeting they agree: “If either person's fastest returned driving estimate exceeds 60 minutes on two fresh checks, alert us before 09:00. We will decide whether to switch to remote.”

Office Pact records that agreement, resolves the selected destination, monitors comparable estimates, notices area incident changes and presents a receipt when the agreed condition is met. The participants decide together in a persistent Nexconn conversation. The product does not track their live movement, book desks, update calendars or decide that roads are safe.

These names, places and thresholds are illustrative demo setup. Do not present example commute times as actual current conditions. If no live results exist, show an explicit simulation mode.

The primary user opens the application shortly before leaving home. They need to answer three questions in seconds: **What did we agree? Is the evidence current? Do we need to reconsider?** The interface should feel like a calm operational notebook, not a trading terminal or a conversational toy.

## The smallest complete experience

1. Open the team's existing Nexconn conversation.
2. Select **Create pact** (or a supported `/pact` command that opens the same form).
3. Enter destination, two coarse starting areas, per-person commute limits, a dated decision deadline and a plain-text remote fallback.
4. Resolve a Maps place, explicitly select it, and show the structured rule for review.
5. Both participants approve the same version. Only then arm the watch. Editing any rule or destination creates a new version and clears approvals.
6. Show comparable source observations, current validity and next scheduled check. Use Traffic only as area context and a bounded reason to refresh routes.
7. On two fresh breaches, create one alert receipt, attempt cited public context, and deliver through Nexconn. Do not wait indefinitely for context to deliver a factual numerical alert.
8. A participant chooses **Keep the plan**, **Switch to remote**, or **Discuss**. Record the decision in application data. Stop monitoring at the deadline or when the pact is closed.

## Stack and boundaries

Use React + TypeScript with a lightweight local dev bundler, a TypeScript HTTP server, SQLite and one persistent worker. Prefer the team's familiar supported framework versions, inspect current official setup docs, and commit a lockfile. Do not add Redis, a vector database, agent framework or microservices. If the project already has a working equivalent stack, preserve it.

The backend owns authenticated sessions, team membership, token issuance, provider requests, field validation, query normalization, state transitions, budget reservations and delivery outbox. The frontend owns accessible forms, navigation, evidence display and integration with the documented Nexconn Web Chat UI.

Do not use browser timers as the durable scheduler. A single server process may host the worker for this demo, but it needs a DB lease and persisted next-run times. SQLite needs a persistent disk. If deployment would require a new database/service, prefer a reliable local demo first.

Chat UI decision: use native Group Channel chat in a compact panel and render the pact/evidence as application-owned UI next to it. This is the Nexconn skill's Layer 1 path; evaluate documented theming before any headless custom chat. Do not fork SDK source. Do not hide a mocked local message array behind Nexconn branding. [Nexconn skill](https://github.com/NexconnAI-Dev/nexconn-skills/blob/main/skills/nexconn-chat/SKILL.md) · [Chat UI quickstart](https://docs.nexconn.ai/chatui-web/quickstart)

## API contracts you must preserve

### SerpApi

All three use `GET https://serpapi.com/search.json` with server-side `api_key` and `engine`.

- `google_maps`: `q`, `ll=@lat,lon,14z`, `type=search`, `hl=en`, `gl=in`. Use `local_results[].title/place_id/gps_coordinates`; optional address/open state for display. No desk availability field.
- `google_maps_directions`: `start_coords`, `end_coords`, `travel_mode=0`, `distance_unit=0`, `gl=in`, `hl=en`. Omit `time` for the MVP's current estimate. Use valid Driving entries in `directions[]`, minimum numeric `duration`, formatted duration for display and unit validation. No `duration_in_traffic`, invented route ID, polyline or probability.
- `google_maps_traffic`: fixed `bbox=north,west,south,east`, `zoom=13`, `gl=in`, `hl=en`. Use `traffic_incidents[].incident_id/type/title`; optional description/details/last_updated. Area markers are not route geometry. Zoom 10–21; area limit 1,024 tiles. Keep bbox and zoom fixed.
- All responses: require successful `search_metadata.status`, record `search_metadata.id/created_at`, handle top-level error. Missing fields yield UNKNOWN. Source time and local receipt time are different.

Documented cache lasts one hour. Fresh due route/traffic checks need `no_cache=true`; no `async` combination. App TTL is five minutes for routes and fifteen for traffic. Account throughput is unknown until the free Account API is checked. [Maps](https://serpapi.com/google-maps-api) · [Directions](https://serpapi.com/google-maps-directions-api) · [Traffic](https://serpapi.com/google-maps-traffic-api) · [Account](https://serpapi.com/account-api)

### You.com

Use `POST https://api.you.com/v1/answer`, `X-API-Key`, JSON `query` (maximum 400 characters), optional `freshness=week`. Consume `answer`, `citations[].source/excerpts`, optional `results.web[].url/title/snippets`. Only accept http(s) source links. Self-service default is 10 requests/second, but our application allows one concurrent call and 12 attempts total for the session. A 429 may omit Retry-After; use reset headers or capped backoff.

Query only public place/corridor context; no private names, home coordinates or team messages. The returned paragraph is explicitly **Public context**, not the explanation for why a particular numerical estimate increased. If there is no corroboration, say so. [Answer reference](https://you.com/docs/api-reference/answer/v1-answer) · [Rate limits](https://you.com/docs/rate-limits)

### Nexconn

Required runtime environment: `NEXCONN_APP_KEY`, `NEXCONN_APP_SECRET`, `NEXCONN_API_BASE` matching the console region. Token issuance is server-only. V4 token request: `POST /v4/auth/access-token/issue`, body `userId`, `name`; headers App-Key, random Nonce ≤18 characters, millisecond Timestamp, SHA1 hex of AppSecret+Nonce+Timestamp. Success is `code=0`, `result.accessToken`, `result.userId`; limit 200 requests/second.

Do not copy the older token shape from the Web quickstart. Check the installed SDK declarations after reading the current documentation. Initialize once, register handlers, connect once, then operate on the group. For server alerts, read `/v4/group-channel/message/send` request example and current SDK types before implementing; documented limit is 20 messages/second. Verify real receipt in a second session. Exactly-once network delivery is not promised.

The application authenticates people and owns approval/decision state. Nexconn tokens are not an application login system. Keep App Secret and signatures out of browser bundles, logs, chat and fixtures intended for sharing. [Token](https://docs.nexconn.ai/platform-chat-api/user/register) · [Signing](https://docs.nexconn.ai/platform-chat-api/prepare-to-use-api/auth) · [Group send](https://docs.nexconn.ai/platform-chat-api/message/send-group) · [Web SDK](https://docs.nexconn.ai/chatsdk-web)

## Rule and budget invariants

- Typed, comparable observations only. Query hash includes endpoints, mode, locale and fixed bbox/zoom. Rule changes create a new baseline.
- Two distinct fresh source observations above the limit are required. Replaying an ID or a source timestamp cannot create confirmation. Reject future source timestamps.
- An empty route list is UNKNOWN. An empty traffic list is “none returned.” Neither is a safety assurance.
- Choose the minimum positive finite driving duration, not the first row. Reordering alternatives must not create a change.
- One alert per breach episode. Recover only at least 300 seconds below the threshold. An unknown observation never creates recovery.
- Area-incident changes can request a paid route check within the remaining budget. They cannot satisfy the commute condition themselves.
- Reserve a credit before network dispatch, inside a database transaction. Count ambiguous failures conservatively. Restart and concurrent ticks must not reset the budget.
- Stop at the deadline, pause or budget ceiling. Surface the stop reason. No unbounded retries.
- Never change live timestamps or edit raw provider fixtures to manufacture a demo. Synthetic data lives separately with permanent provenance labels.

Research cap 40, actual spent 0. Entire plan allocates 240/500 at most: research 40, development 50, rehearsal 60, final monitoring window 60, stage refresh 6, contingency 24. Leave 260 untouched. See BUILDPLAN for calculations; all pools must share a durable accounting model. Provider-reported actual balance can only lower the available budget.

## Professional UI/UX direction

### Domain exploration and decisions

Domain vocabulary: pact, threshold, departure window, checkpoint, evidence receipt, acknowledgement, fallback. The product's physical analogue is a small team's annotated travel plan on a desk.

Color world: uncoated paper, graphite pen, Bengaluru granite, muted roadside green, amber caution paint. Use paper/graphite for most of the interface, green for an armed or accepted state, amber for stale/uncertain, red only for errors or destructive actions.

Signature: a **decision line** connecting the agreed threshold to the last two observations and the deadline. It appears in the pact summary, participant row, evidence receipt, confirmation dialog and activity record. These are explanatory components, not a decorative line behind unrelated cards.

Defaults to replace:

- Replace the standard sidebar plus four statistic cards with a shallow team header, a pact list, a primary decision workspace and an optional chat panel.
- Replace a giant prompt box with a short structured agreement that exposes every consequential parameter before activation.
- Replace traffic-light confidence scores with actual estimates, source ages, the agreed threshold and clearly written UNKNOWN states.
- Replace a dramatic map hero with a compact place reference. A map is optional; route geometry is not in the approved MVP contract.

### Composition

At 1440px: 56px top bar; 224px pact list; remaining workspace split into a flexible main column (minimum 560px) and 336px conversation panel. Use 24px main gutters. If available width falls below 1180px, make chat a deliberate tab/drawer rather than squeezing evidence. At 390px, use one column with **Pact / Evidence / Conversation** tabs and a bottom action bar. No horizontal page overflow.

The top bar contains product name, team switch label, connection status and a small account menu. No marketing navigation or giant brand illustration. The pact list contains real named commitments, deadline and status; no fake chart summaries.

Primary hierarchy:

1. “Bellandur office meetup” and “Decide by 09:00 IST · 21 Nov”.
2. Plain-language agreement: “Reconsider if either commute exceeds 60 min twice.”
3. Two participant rows with neighbourhood, current estimate, limit, source age and validity.
4. Decision line showing baseline → confirmation → deadline; sample values explicitly labelled if synthetic.
5. The latest evidence receipt, followed by a compact activity log.

Conversation supports the decision instead of dominating the screen. Keep message history and composer usable. Put alert receipts in the main workspace; send text plus stable alert link into chat first. Do not attempt a bespoke custom message schema until documented and necessary.

### Tokens

Use a single light theme first. Proposed values are design choices, not a claim of completed accessibility validation.

```css
:root {
  --paper: #F7F6F2;
  --paper-raised: #FCFBF8;
  --paper-inset: #EFEEE8;
  --ink: #202824;
  --ink-secondary: #536057;
  --ink-muted: #667168;
  --rule: #DADDD5;
  --rule-strong: #B7BFB5;
  --pact-green: #245C46;
  --pact-green-hover: #1B4937;
  --pact-green-wash: #E8EFE8;
  --caution-ink: #815B17;
  --caution-wash: #FBF0D9;
  --error-ink: #A3342C;
  --error-wash: #FAECE8;
  --focus: #215A9A;
  --radius-control: 6px;
  --radius-panel: 8px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
}
```

Typography: IBM Plex Sans for readable, workmanlike forms and prose; IBM Plex Mono only for times, numerical estimates and audit identifiers. Self-host if already available, otherwise use a reliable system fallback and do not make external font loading a critical dependency. Body 15/22px; secondary 13/18px; labels 12/16px; page title 26/32px; estimated minutes 30/34px with tabular numerals. Use sentence case. Text should not be faint merely to look refined.

Depth: structural borders and subtle same-family surface shifts; no drop shadows on every panel. Most content sits directly on the main surface. Reserve rounded containers for the rule editor, alert receipt and conversation boundaries, not every paragraph.

Spacing: four-pixel base; 8px within a control group, 16px within a participant row, 24px between related sections, 32px between major sections. Align times and estimates consistently. Controls have at least 44px usable hit areas; icons 18–20px with text labels for consequential actions.

Motion: 120–180ms opacity/translation for drawers and confirmation, no animated background or continuous pulsing. Respect reduced-motion preferences. Async calls show stages such as “Checking route estimates” and elapsed time; never decorative percentages with no measurement.

### States and copy

Required: initial empty, draft, awaiting approval, armed, checking, confirming breach, alert active, acknowledged, recovered, paused, expired, budget exhausted, provider unavailable, stale, reconnecting, delivery pending, live, replay and simulated change.

Use specific copy:

- “No route estimate returned. Your last check is 12 min old.”
- “Area incident newly observed. Its effect on your route is unknown.”
- “One estimate exceeded your limit. A second fresh check is required.”
- “Monitoring paused: session credit limit reached.”
- “Alert saved. Delivery to the conversation is pending.”

No “AI confidence 98%”, “All clear”, “Traffic solved”, “Optimizing your journey”, fabricated savings, or unsupported countdown to arrival.

### UI acceptance gate

At 1440×900 and 390×844, verify screenshots after rendering actual app states. No overlapping header, cut-off composer, horizontal overflow, misaligned numeric columns or large empty decorative region. A first-time viewer should identify the agreed condition, source freshness and next action in five seconds.

Keyboard-only: create/edit pact, select venue, approve, open evidence, follow a citation, acknowledge, switch tabs and close dialogs. Focus is visible and restored on close. Forms have persistent labels and inline errors; statuses include text, not color alone. Measure WCAG AA contrast (4.5:1 body text; 3:1 large text and essential UI boundaries). Honor reduced motion and 200% zoom. Never claim the UI is validated until these checks have actually run.

## Phase-by-phase Antigravity prompts

Paste the boot prompt once. Then paste each phase prompt in order. These prompts authorize repository work, not spending beyond the stated pools or publishing messages to unrelated groups. Use only dedicated test identities and groups. Each phase should end with changed files, tests actually run, known gaps and the next checkpoint.

### Boot prompt — establish context

```text
Read astra.md, RESEARCH.md, BUILDPLAN.md, fixtures/field-contract.json and fixtures/probe-report.json before editing. Inspect the repository and preserve existing working code. We are prototyping Tripwire: Office Pact for an eight-hour Bengaluru buildathon. It scored 8.83/10; no candidate passed the 9+ gate. Do not rewrite this as a validated 9+ idea.

Build one complete path: two participants approve a commute-limit pact, the backend checks Maps/Directions/Traffic, deterministic rules create an evidence receipt, You.com adds separately labelled cited context, and Nexconn carries real discussion/alerts. Do not implement generalized agents or arbitrary natural-language conditions.

Use env vars only for secrets. Research cap 40, currently zero spent; total planned cap 240 of 500. Read the existing ledger before any paid call. Missing keys mean SKIPPED, never fake success. All provider fields must be in the documented contract or newly verified with a source. Keep live, replay and synthetic data separate. First inspect and report the concrete project state, then execute Phase 1.
```

### Phase 1 — prove contracts and scaffold (0:00–1:00)

```text
Run the supplied probe and tests. If keys are missing, record the skip and continue with explicitly synthetic local development; do not claim live integration. If keys exist, make only the three bounded SerpApi calls and one You Answer and Nexconn token call from the probe. Preserve raw bytes and record field checks. Inspect numeric Directions duration against formatted_duration; mark units pending if inconsistent. Empty Traffic results are valid observations but do not verify incident item fields.

Create the minimal React/TypeScript frontend and TypeScript server using familiar supported packages, verify official setup instructions, and commit a lockfile. Keep SQLite and one worker in a persistent runtime. Add environment validation, server-only providers, health endpoint and explicit LIVE/REPLAY/SIMULATION state. Implement no expensive requests in React effects or page renders. Verify start/build/typecheck. Deliver an exact gap list and do not describe scaffolding as a working watchtower.
```

### Phase 2 — pact and designed shell (1:00–2:00)

```text
Implement the domain model and the UI composition in astra.md. Before UI code, state intent, palette, border-based depth, typography and spacing decisions in a short design note. Create the 56px team header, 224px pact list, primary agreement/evidence workspace and 336px conversation slot. On small screens use Pact/Evidence/Conversation tabs. Use the specified paper/graphite/green tokens, IBM Plex or system fallback, restrained borders and clear numeric alignment. No landing-page hero, gradients, card grid, fake metrics or generic prompt-centric dashboard.

Implement one draft pact with two participants, selected destination, per-person threshold, dated deadline and remote fallback. Use persisted application sessions for two test users; enforce membership server-side. Approvals are tied to the exact pact version. Editing a rule invalidates prior approvals; all participants must approve before arming. The place selector uses verified Maps fields, handles missing coordinates and never claims seat availability. Empty state teaches the next action. Test version/approval authorization and render both viewport sizes.
```

### Phase 3 — real Nexconn group chat (2:00–3:00)

```text
Read the current Nexconn llms.txt, Web Chat UI quickstart, nexconn-skills decision framework and v4 token/signing/group docs before integration. Prefer Layer 1 native Group Channel Chat UI beside application-owned pact/evidence UI. Verify exact installed package exports, types and regional configuration. Do not guess SDK APIs from memory or copy the legacy token response from the Web quickstart. Record the package versions and verified response shape.

Create a protected server token endpoint deriving user identity from the authenticated session. App Secret/signatures stay server-only. Initialize once, register owned handlers, connect once and clean up listeners correctly. Configure a dedicated test group; do not send to any unrelated group. Prove an actual text message appears in a second browser session and after a reload. Add connecting/reconnecting/send-failed states. If credentials or delivery fail, mark the sponsor integration incomplete. Do not silently replace it with local simulated chat.
```

### Phase 4 — deterministic observations (3:00–4:00)

```text
Port the invariants from scripts/tripwire_core.py into typed backend modules. Normalize Maps destination, minimum valid Driving duration and sorted incident ID/type sets. Preserve raw hashes and provenance. Validate success status and source timestamps. The canonical query hash includes endpoints/mode/locale or bbox/zoom and excludes secrets. No comparisons across query or rule versions.

Require two distinct, source-fresh breaches before alerting; reject duplicate IDs/timestamps, stale/future data, invalid numbers and empty routes. One alert per episode; five-minute recovery margin. Unknown cannot clear an active alert. Newly observed area incidents may request a fresh route check but cannot assert route impact or independently satisfy the numerical rule.

Write tests for these invariants, threshold equality, different participant limits, missing nested fields, error responses, cached response replay, query changes and restart persistence. Keep synthetic fixtures outside raw provider fixtures. Provide one replayable labelled simulated breach; never change a real response's timestamp to make it fresh.
```

### Phase 5 — bounded scheduler and outbox (4:00–5:00)

```text
Implement one durable worker with a SQLite lease, persisted due times and transactionally reserved credits. Routes every five minutes, traffic every fifteen within a two-hour window. Maps is setup/on-demand only. Honour the account hourly limit from the free Account API, and session/research pool ceilings. Each attempted search reserves one unit before dispatch; failed or ambiguous attempts remain spent. Fresh due Directions/Traffic polls use no_cache=true; never combine it with async. Single-flight duplicate queries.

Deadline, pause and budget exhaustion prevent dispatch and are visible in UI. Incident-triggered rechecks respect minimum intervals and budget. Persist observation, state transition, alert and outbox atomically. Enforce unique logical alert IDs. Retry transient errors with caps/jitter and new reservations; handle 429 headers. For ambiguous Nexconn sends, reconcile documented receipts/history before retrying. Do not promise exactly-once delivery when the provider contract does not.

Test concurrent ticks, worker restart, budget boundary, deadline race and duplicate alert suppression. No browser polling loop may directly call a paid API.
```

### Phase 6 — cited context and decision receipt (5:00–6:00)

```text
Integrate You Answer using only verified query/freshness fields and the correct api.you.com host. Keep queries below 400 characters and free of private team information. Consume answer and citations[].source/excerpts, validate http(s) links, and sanitize rendered Markdown. Public context is a separate section; it cannot change the deterministic rule outcome or invent the cause of a commute estimate.

Build the evidence receipt: participant, exact rule/version, previous and current values, two source timestamps, freshness, source provenance, optional area-incident context and linked public citations. Persist it before delivery. Send a concise text alert plus stable receipt link through the documented Nexconn server API to the dedicated test group. Read the exact request example/current SDK before choosing types for toChannelIds/content.

Implement Keep the plan / Switch to remote / Discuss as authenticated app decisions, not invented SDK read-receipt APIs. You failure must preserve the numerical alert with context-unavailable copy; Nexconn failure must leave delivery pending. Test both failures and cross-session acknowledgement.
```

### Phase 7 — craft and accessibility (6:00–7:00)

```text
Audit the actual rendered interface against astra.md, not just the source code. Capture desktop 1440x900 and mobile 390x844 states: draft, armed, confirming, alert, stale, budget paused and delivery pending. Fix hierarchy, alignment and density before adding decoration. The condition, source age and next action must be legible in five seconds. Chat must not squeeze the evidence column; mobile composer and action bar must not overlap.

Measure contrast; verify keyboard navigation, focus restoration, labels, error messages, reduced motion and 200% zoom. Use status text alongside color. Remove fake performance metrics, oversized blank panels, repeated generic cards, neon/gradient styling, unsupported maps and vague AI copy. Check the decision-line signature appears meaningfully in the pact, participant row, receipt, review dialog and activity record. Report actual visual findings and fixes, with screenshots. Do not call untested aesthetics professional-grade by assertion.
```

### Phase 8 — freeze, rehearse and submit (7:00–8:00)

```text
Freeze features. Run build/typecheck, invariant tests, authorization checks and a two-browser smoke test. Scan bundles/logs/exports for secrets without printing secret values. Verify local raw fixtures are excluded from the shareable package and the budget cannot reset on restart. Confirm event submission requirements and eligibility for preparatory code before publishing.

Rehearse BUILDPLAN.md's three-minute demo twice. Show a real API observation where available, then a persistent SIMULATED CHANGE banner for the controlled breach. Replay the same observation to prove deduplication. Show real Nexconn receipt and an actual returned You citation; if absent, disclose the gap. Test UNKNOWN and budget-stop states. Save a short backup recording and a README with exact run instructions, environment names, tested versions, remaining gaps and credit usage.

Re-score against the original six dimensions using new evidence. Do not give 9+ automatically. Finish with what is implemented, what is live-verified, what is simulated and what remains unfinished.
```

## Final acceptance and self-rating

A complete demo is not a production service. Minimum acceptance: real Maps/Directions/Traffic responses with validated fields; real You citations; real Nexconn two-session delivery; authenticated versioned pact approvals; deterministic duplicate/stale/unknown behaviour; durable credit limits; honest provenance; accessible responsive UI; a rehearsed three-minute narrative.

Current proposal rating **8.8/10**. Local logic proof passes; integration and UI are still pending. A 9+ rating requires evidence and judgment after those gates, not a nicer name or additional sponsor logos.
