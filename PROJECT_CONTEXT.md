# Tripwire: Office Pact — Complete Project Context & Architecture Guide

> **Target Audience:** Developers, System Architects, Evaluators, Hackathon Judges, and AI Assistants (e.g., OpenAI Codex, GitHub Copilot, Claude) continuing development, code auditing, and performance optimization on this project.  
> **Repository:** `Office-Pact-Handoff`  
> **Primary API Track:** **Track 1: SerpApi (Google Maps Directions, Traffic Incidents, Place Autocomplete)**  
> **AI Search Fallback:** **OpenAI / Grok Places Discovery** (`OPENAI_API_KEY` / `OPEN_AI_API_KEY`)  
> **Explicit Service Exclusions:** **Nexconn Chat SDK** and **You.com Answer API** are deliberately **NOT** actively used. All chat communication is handled natively in-app with multi-tenant company isolation, and all traffic corridor context is derived deterministically from SerpApi live queries.

---

## 1. Executive Summary & Problem Space

### 1.1 The Core Problem
In congested metropolitan tech corridors (specifically modeled on Bengaluru's Outer Ring Road, Silk Board, Indiranagar, and HSR Layout), team members often embark on grueling 60–90+ minute commutes only to find that their colleagues were held up in traffic, delayed, or chose to stay home. 

Traditional navigation platforms (Google Maps, Waze, Apple Maps) notify only the individual commuter after they are already stranded in traffic. They do not provide a mechanism for **bilateral, enforceable team agreements** that automatically trigger a shared remote fallback *before* anyone leaves home.

### 1.2 The Solution: "Tripwire: Office Pact"
**Tripwire: Office Pact** introduces automated, verifiable commute agreements:
1. **Multi-Tenant Corporate Login (`/login`):** Direct enterprise session identification. Users enter their Company Legal Name, **Company ID** (e.g. `PAYTM-CORP-01`, `GOOG-BLR-01`, `MSFT-IN-01`), **Employee Full Name** (e.g. `Kabir Verma`, `Ananya Sharma`), and **Employee ID / Corporate Badge** (e.g. `PAYTM-EMP-01`, `PAYTM-EMP-02`). Includes 8 official corporate SVG logos (Paytm, Google, Microsoft, Amazon, Infosys, Flipkart, Swiggy, Uber). Direct selection and quick-fill badge prefixes—no suggested name chips, and departure origins are managed in-workspace/admin.
2. **Enterprise Admin Console (`/admin`):** Accessible at `http://localhost:3000/admin`. Corporate admins register new legal entities, receive auto-generated enterprise Company IDs (`<TICKER>-CORP-01`), provision employees, and monitor ecosystem telemetry with application-level SQLite query isolation.
3. **Form a Bilateral Agreement:** Colleagues agree to meet at a designated workplace (e.g., *Google Anantha Bengaluru* or *Paytm Office RMZ Ecoworld*).
4. **Define Strict Commute Thresholds & Decision Deadline:** Each participant sets their maximum acceptable commute limit (e.g., 60 minutes) and an agreed decision deadline (e.g., 09:30 IST). Number inputs feature automatic zero-stripping (resolving `060` inputs) and quick preset pills (`[30m] [45m] [60m] [75m] [90m]`).
5. **Interactive Mapping & Live Corridors:** High-resolution **Esri World Street Map** displays departure origins, workplace destination, and live dashed commute corridor lines with zero 403 errors or watermarks.
6. **Automated Background Watcher:** A persistent background worker polls live commute durations via **SerpApi (Google Maps Directions & Traffic Incidents)**.
7. **Deterministic Tripwire Invariants:** If live driving duration for *either* person exceeds their agreed threshold on **two consecutive, source-fresh checks** before the deadline, an alert fires and automatically triggers the ratified team fallback (*"Switch to remote Google Meet and cancel cab"*).
8. **Shared Bilateral Consensus:** Both participants confirm the decision within the app. If choices conflict, a "Needs Discussion" state is established with an automated briefing in team chat. Zero credit mentions or budget gauges are exposed to users.
9. **Single-Click Pitch Demo Batches:** Two dedicated batch files—`succes.bat` (~10s rapid All-Clear proof) and `fail.bat` (~16s observable breach & alert proof)—enable rapid, repeatable live presentations for hackathon judges with automatic server health management.

---

## 2. Track & Sponsor Scope Clarification

| Sponsor / API | Status | Implementation Details |
|---|---|---|
| **SerpApi** | **ACTIVE (Primary Track 1)** | Powers live Google Maps Directions (`engine=google_maps_directions`), Traffic Incidents (`engine=google_maps_traffic`), and Place Autocomplete. Background worker manages credit reservations safely without blocking the user or displaying quota counts. Configured via `SERPAPI_API_KEY` in `.env`. |
| **OpenAI / Grok** | **ACTIVE (Places Discovery)** | Powers intelligent fallback places discovery for unlisted or custom corporate hubs (`OPENAI_API_KEY` or `OPEN_AI_API_KEY`) via standard OpenAI Chat Completions API (`gpt-4o-mini`). Top priority is granted to high-density hubs like *Google Anantha Bengaluru* and *Paytm Office*. Grok is supported as an OpenAI-compatible endpoint fallback if configured; no separate proprietary SDK is used. |
| **Nexconn Chat SDK** | **EXCLUDED / INACTIVE** | Packages `@nexconn/chat` and `@nexconn/engine` (v26.5.1) remain in `package.json` as residual scaffolding. However, live messaging is handled natively by internal SQLite storage (`team_messages`), providing authenticated team messaging with zero external cloud dependencies. Unconfigured Nexconn credentials gracefully yield a 503 status without blocking the app. |
| **You.com Answer API** | **EXCLUDED / INACTIVE** | You.com is **not used**. Traffic incident citations and corridor advisories in simulation routes are synthetic seeded fixtures modeled on Bangalore Traffic Police advisories. |

---

## 3. High-Level Architecture & Tech Stack

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Tripwire: Office Pact                         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   Frontend (React 18.3.1 + Vite 6 + TypeScript + Astra Design System)  │
│   ┌────────────────────┐ ┌───────────────────┐ ┌───────────────────┐   │
│   │ Corporate Login    │ │ Enterprise Admin  │ │ Workspace Shell   │   │
│   │ - 8 Company Logos  │ │   (/admin)        │ │ - TopBar Aligned  │   │
│   │   (Paytm, Google,  │ │ - Register Entity │ │ - Esri Map Tiles  │   │
│   │    Microsoft, etc) │ │ - Gen Company ID  │ │ - Decision Line   │   │
│   │ - Company ID Key   │ │ - Provision Staff │ │ - Plan Switcher   │   │
│   │ - Direct Identity  │ │ - SQLite Monitor  │ │ - Team Chat       │   │
│   └────────────────────┘ └───────────────────┘ └───────────────────┘   │
│                                  │ (REST APIs + SSE Stream)            │
│                                  ▼                                     │
├────────────────────────────────────────────────────────────────────────┤
│   Backend (Node.js 24+ / Express 4.21 / TypeScript)                    │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ REST API Layer (/api/auth, /api/admin, /api/pacts,           │     │
│   │ /api/places, /api/health, /api/simulation, /api/chat)        │     │
│   │ Multi-Tenant Context: x-company-id, x-user-id headers        │     │
│   └──────────────────────────────┬───────────────────────────────┘     │
│                                  ▼                                     │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ Domain & Mathematical Invariants Engine (tripwireCore.ts)    │     │
│   │ - 2-Breach Gate      - Recovery Margin (5m below limit)      │     │
│   │ - Fastest Driving    - Canonical Query Hash (SHA-256)        │     │
│   │ - Freshness Gate     - Version / Approval Invalidation       │     │
│   └──────────────────────────────┬───────────────────────────────┘     │
│                                  ▼                                     │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ Durable Background Worker & Scheduler (watchScheduler.ts)    │     │
│   │ - SQLite Lease Locking (10s heartbeat lease)                 │     │
│   │ - Transactional Credit Reservation (reserveCredit)           │     │
│   │ - Next-due query polling (Directions 5m, Traffic 15m)        │     │
│   └──────────────────────────────┬───────────────────────────────┘     │
│                                  ▼                                     │
│   Database (Embedded SQLite 3 via Node.js native node:sqlite)          │
│   - companies, team_members, pacts, participants, watches,       │     │
│     observations, rule_states, credit_attempts, team_messages    │     │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Frontend Stack
- **Framework:** React 18.3.1
- **Router:** React Router DOM v7 (`BrowserRouter`, multi-page layout with `AppShell`, protected workspace routes)
- **Maps:** Leaflet 1.9.4 (`react-leaflet` / native Leaflet with **Esri World Street Map** tiles, destination pins, commuter departure pins, and dashed corridor polylines)
- **Validation:** Zod v4 for wizard schemas and runtime safety
- **Bundler:** Vite 6.1.0
- **Typography & Design System:** **Astra Design System**
  - Backgrounds: Canvas Paper (`#FBFBF9`), Raised Panel (`#FFFFFF`), Recessed (`#F4F4F0`)
  - Typography: IBM Plex Sans / system monospace font stack with tabular numbers (`font-variant-numeric: tabular-nums`)
  - Palette: Forest Green (`#1B4D3E`), Warning Amber (`#B45309`), Danger Crimson (`#B91C1C`), Subtle Ink (`#6E6D68`)
- **Iconography:** Pure responsive SVG vector icons matching Google Material Design standards (zero emojis).

### 3.2 Backend Stack
- **Runtime Environment:** Node.js v24.14.0 (compatible with Node.js v20.x, v22.5+, and v24+)
- **HTTP Server:** Express 4.21.2
- **Database Engine:** Embedded SQLite 3 via Node.js built-in native `node:sqlite` (`DatabaseSync`).
  > [!NOTE]
  > `node:sqlite` is an experimental Node.js built-in feature and emits `ExperimentalWarning: SQLite is an experimental feature and might change at any time`. SQLite operates in Write-Ahead Logging (`PRAGMA journal_mode = WAL;`), which generates companion `officepact.sqlite3-wal` and `officepact.sqlite3-shm` files.
- **Real-Time Streaming:** Server-Sent Events (`GET /api/stream`) backed by internal in-memory `EventBus`.
- **Security & Headers:** Helmet HTTP headers, IP-based write rate limiting, header-based session identification (`x-user-id`, `x-company-id`).

---

## 4. Multi-Tenant Corporate Ecosystem & Boundary Realities

### 4.1 Company Workspace Model
Each corporate tenant operates with data partitioned at the application layer:
- **Companies:** Stored in `companies` table (`id`, `name`, `code`, `corporate_id`, `domain`). Pre-seeded entities:
  1. `comp_paytm`: **Paytm (One97 Communications)**, Code: `PAYTM`, ID: `PAYTM-CORP-01`
  2. `comp_acme`: **Acme Technologies**, Code: `ACME`, ID: `ACME-CORP-01`
  3. `comp_google`: **Google Bengaluru**, Code: `GOOG`, ID: `GOOG-BLR-01`
  4. Additional seeds: Microsoft, Amazon, Infosys, Flipkart, Swiggy, Uber.
- **Team Members:** Filtered by `company_id`. For example, in Paytm:
  - `user_ananya`: Ananya (Indiranagar)
  - `user_kabir`: Kabir (HSR Layout)
- **Pacts & Agreements:** Every pact carries a `company_id`. Pacts created under Paytm are isolated from Acme or Google via SQL `WHERE company_id = ?` query clauses.
- **Team Chat Channels:** Each company has its dedicated team channel (`#channel_comp_paytm_office_pact`). Colleagues see messages filtered by corporate company ID.

### 4.2 Corporate Authentication Flow (`/login`) — Identity Simulation vs Hardened Auth
- The login flow (`/login`) and session resolution (`/api/auth/session`) are designed as an **enterprise identity simulation**:
  1. Users submit Company Legal Name / Corporate ID and Employee Name.
  2. The backend looks up or auto-provisions the company and member records without requiring passwords, multi-factor authentication, or cryptographic proofs.
  3. Active identity is conveyed across API requests via HTTP headers: `x-company-id` and `x-user-id`.
  4. **Deferred Production Auth Work:** This is not credential-backed enterprise authentication. There is no password hashing (bcrypt), OAuth2/OIDC provider flow, or cryptographically signed session tokens (JWT/Paseto).

### 4.3 Tenant Isolation Realities & Architectural Gaps
While standard application endpoints filter by `company_id`, the system currently has several tenant boundary gaps that require hardening prior to enterprise multi-tenant deployment:
1. **Server-Sent Events Stream (`GET /api/stream`):** Connects to a global in-memory `EventBus` and broadcasts all domain events (observations, alerts, decisions, chat messages) globally across all connected clients without per-tenant stream filtering.
2. **Enterprise Admin Console (`/admin` and `/api/admin/*`):** These routes have no role-based access control (RBAC) or session authentication checks; any client can view tenant metrics or provision entities.
3. **Simulation Endpoints (`/api/simulation/*`):** The simulation routes operate globally and perform table deletions without multi-tenant scoping.

---

## 5. Proposed Fallback Directives vs Real External Actions

When a tripwire breach occurs or when participants unanimously confirm remote work, the application proposes a team fallback directive:
> *"Switch to remote Google Meet and cancel cab"*

### Scope Boundary Clarification:
- **What the system does:** The system updates pact and alert states in SQLite, records participant votes in `acknowledgements`, computes consensus status, generates cryptographic breach receipts, and dispatches automated status updates to the company team chat channel (`team_messages`).
- **What the system DOES NOT do:** The system does **not** call the Google Calendar API or Google Meet API to provision meeting URLs, nor does it interface with third-party ride-hailing APIs (e.g. Uber or Ola) to automatically book or cancel vehicles. Fallback directives are human-executable team alignment instructions, not direct third-party transactional automation.

---

## 6. Deterministic Invariant Rules (`tripwireCore.ts`)

The domain invariants governing commute evaluations are enforced through deterministic logic in `src/server/domain/tripwireCore.ts` and verified in `scripts/tripwire_core.py`:

### 6.1 Two-Breach Confirmation Gate
- An alert is **never** triggered on an isolated traffic spike.
- A single observation exceeding the threshold sets `consecutive = 1` and returns `outcome = 'confirming'` ("Confirming 1/2").
- Exactly **two consecutive, source-fresh checks** exceeding the limit (`consecutive >= 2`) are required to transition `active = true` and return `outcome = 'alert'`.

### 6.2 Pending Breach Reset vs. Active-Alert Recovery Hysteresis
There is a fundamental mathematical distinction between resetting a pending breach and recovering an active alert:
1. **Pending Breach Reset (`active == false`, `consecutive == 1`):**
   - Any subsequent valid observation with `duration <= limit` immediately resets `consecutive = 0` (returning `within_limit`).
   - Any stale observation (`sourceAt > now` or `now - sourceAt > maxAge`) or malformed/missing observation (`duration === null` or non-numeric) immediately resets `consecutive = 0`.
   - A single spike does **not** require any 5-minute duration margin or time delay to reset; it clears immediately if the next check is within limit.
2. **Active Alert Recovery Hysteresis (`active == true`):**
   - Once an alert has fired (`active == true`), an observation that merely drops below the threshold (e.g. 58 min for a 60 min limit) **does not clear the alert**. It remains `outcome = 'active'`.
   - Recovery strictly requires an observation with `duration <= limit - resetMargin`. With `resetMargin = 300` (5 minutes), a 60-minute limit requires traffic to drop to **55 minutes or less** before transitioning `active = false` and returning `recovered`.
   - **Alert Safety Invariant:** Stale or malformed/unknown observations arriving while `active == true` do **not** clear the alert. They maintain `active = true` to prevent intermittent sensor failures from creating false recoveries.
3. **No Claimed Elapsed Recovery Window:**
   - The 5-minute recovery margin (`resetMargin = 300s`) is a **duration threshold margin**, not an elapsed clock time after a spike. There is no requirement or rule that traffic must recover within 5 clock minutes.

### 6.3 Freshness Defaults & Clock Skew
- **Observation Freshness Window:** In `tripwireCore.ts`, `maxAge` defaults to **300 seconds** (5 minutes). Observations with `now - sourceAt > maxAge` are rejected as `stale`.
- **Clock Skew Tolerance:** Timestamps from the future (`sourceAt > now`) are strictly rejected as `stale` (0 seconds future tolerance in `tripwireCore.ts`).
  > [!NOTE]
  > Earlier planning documents referenced a theoretical `DEFAULT_CONFIG` with `maxSourceAgeSec = 600s` (10 minutes) and `maxClockSkewFutureSec = 120s`. The implemented codebase enforces `maxAge = 300s` and zero future clock skew tolerance.
- **Deduplication:** Observations with identical observation IDs (`state.seenIds.has(observationId)`) or non-advancing provider timestamps (`sourceAt <= state.lastSourceAt`) return `duplicate_or_old`.
- **Comparability:** Evaluations across differing rule versions (`ruleVersion !== state.ruleVersion`) or query parameters (`queryHash !== state.queryHash`) return `incomparable`. Modifying any pact parameter increments `version` and resets the baseline state.
- **Decision Cutoff:** Once `now >= deadline`, evaluations cease and return `expired`.

---

## 7. Data Provenance: Seeded Fixtures vs Live Provider Responses

The application clearly tags observation provenance in SQLite (`observations.provenance`) to distinguish real network responses from deterministic demonstration fixtures:

| Component / Route | Provenance | Nature of Data |
|---|---|---|
| `POST /api/simulation/safe-commute` | Seeded Baseline (`provenance = 'live'`) | Injected deterministic observations (Indiranagar: 38 min, HSR Layout: 34 min). Marked 'live' for UI baseline demonstration, but generated directly in SQLite. |
| `POST /api/simulation/trigger-breach` | Synthetic Fixture (`provenance = 'synthetic'`) | Deterministic synthetic sequence generated by `syntheticBreach.ts` (68 min and 72 min). Explicitly tagged as synthetic. |
| Traffic Citations in `/trigger-breach` | Synthetic Advisory | Stored in `citation_contexts`. Hardcoded advisory text citing "Bangalore Traffic Police" and Bellandur waterlogging. **Not a live web scrape or real municipal API call.** |
| `POST /api/simulation/check-live` | Live Network Call (`provenance = 'live'`) | Real HTTP query dispatched to SerpApi Google Maps Directions API (`https://serpapi.com/search.json?engine=google_maps_directions`). Validated for driving mode and positive duration. |
| Background Watcher (`watchScheduler.ts`) | Live Network Call (`provenance = 'live'`) | Scheduled background worker querying SerpApi on 5-minute (Directions) and 15-minute (Traffic) polling cadences. |
| Places Autocomplete (`/api/places/autocomplete`) | Multi-Tiered | 1. Curated Bengaluru tech hubs (instant, 0 credits); 2. OpenAI / Grok completions (`gpt-4o-mini`); 3. SerpApi Google Maps (`engine=google_maps`); 4. SQLite `place_cache`. |

---

## 8. Pitch Demonstration Scripts (Batch Runners)

Judges cannot wait 60 minutes during a pitch demo to observe commute monitoring and failover triggers. Two production batch runners provide immediate, visual proof:

### 8.1 `succes.bat` — All-Clear Rapid Verification (~10 Seconds)
```cmd
succes.bat
```
- **Scenario:** Normal commute conditions for Kabir & Ananya (Paytm @ Google Anantha).
- **Corridor Estimates:** Indiranagar: 38 min, HSR Layout: 34 min (both well within agreed 60m threshold).
- **Pacing Timeline:**
  - `t = 0s`: Bilateral pact armed in SQLite (Paytm @ Google Anantha, 60m threshold).
  - `t = 3s`: Directions queries dispatched for both commuter corridors.
  - `t = 6s`: Invariant evaluation confirms zero breaches recorded ($0/2$).
  - `t = 9s`: All-Clear confirmed, logged to SQLite, and sent to `#channel_comp_paytm_office_pact`.
  - `t = 10s`: Automatically opens `http://localhost:3000` showing the **Green "All clear" Dashboard** (0 alerts needing decision, 1 active monitored pact).

---

### 8.2 `fail.bat` — Observable Breach & Fallback Verification (~16 Seconds)
```cmd
fail.bat
```
- **Scenario:** Severe Outer Ring Road congestion triggers the 2-breach hysteresis tripwire.
- **Pacing Timeline:**
  - `t = 0s`: **[Phase 1]** Bilateral pact armed cleanly. Pacing delay allows judges to observe the armed baseline state.
  - `t = 4s`: **[Phase 2]** Outer Ring Road traffic spike detected. Kabir's commute jumps from 34m to **68m (+8m over limit)**.
    - **Invariant Enforced:** Terminal highlights the **Hysteresis Invariant (Confirming 1/2)**: *Single breach NEVER alerts the team or cancels plans. Prevents false alarms from transient delays.*
  - `t = 9s`: **[Phase 3]** Mandatory 2nd re-check at Bellandur bottleneck worsens to **72m (+12m over limit)**.
    - Terminal confirms **2/2 Consecutive Fresh Breaches**.
  - `t = 14s`: **[Phase 4]** **Tripwire Alert Triggered!**
    - Cryptographic breach receipt generated with SHA-256 hash and Bangalore Traffic Police incident citations.
    - Automatic remote fallback proposed: *"Switch to remote Google Meet and cancel cab"*.
    - Outbox delivery dispatched to `#channel_comp_paytm_office_pact`.
  - `t = 16s`: **[Phase 5]** Automatically launches browser directly to:
    `http://localhost:3000/pacts/pact_paytm_google_anantha`
    displaying the **Live Cryptographic Breach Receipt, Stepper Alert Gate, and Bilateral Voting Buttons** (`Switch to Remote`, `Keep Plan`, `Discuss in Chat`).

---

### 8.3 Standard Application Runner
- **`run.bat`:** Standard project runner that builds client/server, starts background daemon on port 3000, and launches `http://localhost:3000`.

---

## 9. Verification & Audit Results

### 9.1 Test Suite & Build Verification
The test suite and build pipeline were audited during this evaluation pass:

| Verification Target | Command | Result | Audit Findings & Notes |
|---|---|---|---|
| **Python Invariant Proofs** | `python scripts/test_core.py` | **19/19 PASSED** (0.153s) | Verifies 2-breach gate, deduplication, replay rejection, staleness, unknown handling, recovery margin, and credit estimation. |
| **Server TypeScript Tests** | `npx tsx src/server/tests/test_tripwire_core.ts` | **21/21 PASSED** | Verifies TypeScript port of domain invariants, query hash normalization, and SQLite persistence. |
| **Client Production Build** | `npm run build:client` | **BUILD CLEAN** (3.53s) | Vite 6.1.0 bundles client without errors (`dist/client/assets`). |
| **Server TypeScript Build** | `npm run build:server` | **0 ERRORS** | Compiles server via `tsc -p tsconfig.server.json` cleanly into `dist/server/`. |
| **Full Typecheck** | `npm run typecheck` | **2 TS ERRORS DETECTED** | `tsc --noEmit` flags 2 undeclared variable errors in `src/client/components/DecisionTab.tsx` (`mayaChoiceObj`, `arjunChoiceObj`). *Vite build passes because esbuild strips types without typechecking.* |
| **Safe Commute Batch** | `succes.bat` | **10.1s EXECUTION** | Cleanly executes baseline check and launches dashboard. |
| **Breach Fail Batch** | `fail.bat` | **16.1s EXECUTION** | Verified pacing and browser launch to alert view. |

> [!WARNING]
> While `npm run build` succeeds (since Vite ignores type errors), running strict `npm run typecheck` currently fails due to two undeclared variables in `DecisionTab.tsx`. Per subagent constraints, application code was not modified.

---

## 10. Operational Guidelines & Critical Warnings

### 10.1 Destructive Nature of Simulation Routes
> [!CAUTION]
> Endpoints under `/api/simulation/` (`/api/simulation/state/set`, `/api/simulation/reset`, `/api/simulation/safe-commute`) execute broad SQL `DELETE` queries across core tables (including `DELETE FROM pacts WHERE ...`, `DELETE FROM alerts`, `DELETE FROM outbox`).
> **Never run simulation routes or demo batch files against a production database!** Always operate against a disposable SQLite database instance configured via `DATABASE_PATH`.

### 10.2 SQLite WAL File Integrity & Backups
> [!IMPORTANT]
> The database runs with Write-Ahead Logging (`PRAGMA journal_mode = WAL;`). Active transactions reside in `officepact.sqlite3-wal` alongside `officepact.sqlite3-shm`.
> - Do **not** copy or back up `officepact.sqlite3` alone while the server is running.
> - Prior to snapshotting or transferring the database file, execute a WAL checkpoint:
>   ```sql
>   PRAGMA wal_checkpoint(TRUNCATE);
>   ```
> - Alternatively, stop the Node.js server to ensure all WAL transactions are fully committed back into the main database file.

---

## 11. Key File Locations & Reference Map

| Component / Logic | File Path |
|---|---|
| **Pitch Batch: Safe Commute** | [`succes.bat`](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/succes.bat) |
| **Pitch Batch: Breach Fail** | [`fail.bat`](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/fail.bat) |
| **Success Demo Script** | [`scripts/demo_success.cjs`](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/scripts/demo_success.cjs) |
| **Breach Demo Script** | [`scripts/demo_fail.cjs`](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/scripts/demo_fail.cjs) |
| **Domain Invariants Core** | [`src/server/domain/tripwireCore.ts`](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/src/server/domain/tripwireCore.ts) |
| **Python Invariant Proofs** | [`scripts/tripwire_core.py`](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/scripts/tripwire_core.py) / [`scripts/test_core.py`](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/scripts/test_core.py) |
| **Observation Service** | [`src/server/domain/observationService.ts`](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/src/server/domain/observationService.ts) |
| **Receipt Service** | [`src/server/domain/receiptService.ts`](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/src/server/domain/receiptService.ts) |
| **Simulation Routes** | [`src/server/routes/simulation.ts`](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/src/server/routes/simulation.ts) |
| **Corporate Auth Route** | [`src/server/routes/auth.ts`](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/src/server/routes/auth.ts) |
| **Admin Console Route** | [`src/server/routes/admin.ts`](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/src/server/routes/admin.ts) |
| **Server Configuration** | [`src/server/config.ts`](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/src/server/config.ts) |
| **Database Initialization** | [`src/server/db.ts`](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/src/server/db.ts) |
| **Corporate Login Page** | [`src/client/pages/LoginPage.tsx`](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/src/client/pages/LoginPage.tsx) |
| **Enterprise Admin Page** | [`src/client/pages/AdminPage.tsx`](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/src/client/pages/AdminPage.tsx) |
| **Pact Detail & Stepper Page** | [`src/client/pages/PactDetailPage.tsx`](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/src/client/pages/PactDetailPage.tsx) |
| **Dashboard Page** | [`src/client/pages/DashboardPage.tsx`](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/src/client/pages/DashboardPage.tsx) |
