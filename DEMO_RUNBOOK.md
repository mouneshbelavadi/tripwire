# Tripwire: Office Pact — Pitch Demonstration & Evaluation Runbook

> **Target Audience:** Presenters, Hackathon Evaluators, System Auditors, and Demonstrators.  
> **Repository:** `Office-Pact-Handoff`  
> **Key Value Proposition:** *"Agree on when to reconsider the office trip, check before leaving."*  
> **Supported Demo Runners:** `succes.bat` (All-Clear proof, ~10s) and `fail.bat` (Observable breach proof, ~16s).

---

## 1. System Prerequisites & Startup Health Checks

Before presenting or testing the system, ensure the following runtime environment requirements are satisfied:

### 1.1 Software & Runtime Requirements
- **Operating System:** Windows 10/11 (fully supported via batch runners), macOS, or Linux (using bash equivalents).
- **Node.js:** **v24.14.0** (tested runtime) or **v20.x+** with built-in native `node:sqlite`.
  > [!NOTE]
  > `node:sqlite` is an experimental Node.js built-in module. When running, Node will output `(node:...) ExperimentalWarning: SQLite is an experimental feature and might change at any time`. This is expected behavior.
- **Python:** Python 3.10+ (required for invariant proof verification: `python scripts/test_core.py`).
- **Network Access:**
  - HTTP port **3000** must be open and available for the Express backend.
  - Internet access required for Esri map tile loading (`https://server.arcgisonline.com/...`) and SerpApi live queries.

### 1.2 Configuration Verification (`.env`)
Ensure a valid `.env` file exists in the repository root. A sample template is provided in `.env.example`:
```ini
# SerpApi Google Maps Directions & Traffic Engine
SERPAPI_API_KEY=your_serpapi_key_here

# OpenAI / Grok Places Discovery (gpt-4o-mini completions)
OPENAI_API_KEY=your_openai_or_grok_key_here

# Server Host & Port
PORT=3000
HOST=0.0.0.0

# Optional: Dedicated Disposable Database Path
DATABASE_PATH=officepact.sqlite3
```
> [!CAUTION]
> Never print, display, or commit `.env` credentials in console logs or shared screens.

### 1.3 Pre-Flight Health Check Command
Run the following quick verification command to confirm system readiness:
```bash
# Verify Python Invariant Suite (19/19 tests)
python scripts/test_core.py

# Verify TypeScript Core Invariant Suite (21/21 tests)
npx tsx src/server/tests/test_tripwire_core.ts
```

---

## 2. Disposable Demo Database Management

The application stores all pacts, watches, observations, alerts, outbox records, and messages in an embedded SQLite database configured via `DATABASE_PATH`.

### 2.1 Using a Dedicated Disposable Database
To isolate demo presentations from development data, set the `DATABASE_PATH` environment variable:
```cmd
:: Windows Command Prompt
set DATABASE_PATH=demo.sqlite3
node dist/server/index.js
```
The database engine will automatically initialize the schema and populate baseline seeds for Paytm, Acme, Google, and initial team members.

### 2.2 Critical Warning: Destructive Nature of Simulation Endpoints
> [!CAUTION]
> The simulation routes (`/api/simulation/state/set`, `/api/simulation/reset`, `/api/simulation/safe-commute`) execute broad SQL `DELETE` operations across database tables:
> - `DELETE FROM pacts WHERE ...`
> - `DELETE FROM alerts`
> - `DELETE FROM outbox`
> - `DELETE FROM acknowledgements`
> - `DELETE FROM citation_contexts`
>
> **NEVER point the application to a production database when running `succes.bat`, `fail.bat`, or any test script.** Always execute demonstrations against a disposable SQLite database.

### 2.3 SQLite WAL File Integrity & Safe Copying
> [!IMPORTANT]
> SQLite operates in Write-Ahead Logging (`PRAGMA journal_mode = WAL;`). This creates three files on disk:
> 1. `officepact.sqlite3` (Main database file)
> 2. `officepact.sqlite3-wal` (Write-ahead log containing uncommitted/un-checkpointed transactions)
> 3. `officepact.sqlite3-shm` (Shared-memory index)
>
> **Do NOT copy or archive only the `.sqlite3` file while the server is active.** To create a safe backup:
> 1. Stop the Node.js server, OR
> 2. Force a WAL checkpoint from SQLite CLI or script:
>    ```sql
>    PRAGMA wal_checkpoint(TRUNCATE);
>    ```

---

## 3. Data Scenarios: Synthetic Fixtures vs Live Integrations

When presenting to evaluators, clearly delineate what data is synthetic fixture vs live external provider response:

| Scenario / Flow | Component | Nature of Data | Verifiable Proof |
|---|---|---|---|
| **Safe Commute Demo (`succes.bat`)** | Indiranagar & HSR Layout corridors | **Seeded Baseline** | Injected via `POST /api/simulation/safe-commute` with `fastestDuration` = 2280s (38m) and 2040s (34m). Stored with `provenance = 'live'` for baseline visual fidelity. |
| **Breach Fail Demo (`fail.bat`)** | Step 1 (68m) & Step 2 (72m) | **Synthetic Fixture** | Generated deterministically by `createSyntheticBreachSequence()`. Tagged with `provenance = 'synthetic'` in `observations`. |
| **Breach Citations** | Bangalore Traffic Police Advisory | **Synthetic Fixture** | Hardcoded citation in `citation_contexts` referencing Bellandur junction waterlogging. **Not a live municipal scrape.** |
| **Live Route Check** | Directions Polling | **Live SerpApi** | Triggered via `POST /api/simulation/check-live` or wizard route checks; calls `https://serpapi.com/search.json?engine=google_maps_directions`. |
| **Interactive Map** | Corridor Map & Destination Pins | **Live Esri Tiles** | Live vector street map tiles loaded directly via Leaflet from Esri (`https://server.arcgisonline.com/...`) without watermarks. |
| **Places Discovery** | Landmark Search | **Live OpenAI / Grok** | Fallback autocomplete queries OpenAI Chat Completions (`gpt-4o-mini`) to resolve unstructured corporate landmarks. |

---

## 4. Rehearsal Guide: Demonstration Batch Runners

### 4.1 Demo Script 1: `succes.bat` — All-Clear Rapid Verification (~10 Seconds)

**Pitch Angle:** *"When traffic is within agreed bounds, the system provides passive assurance without noise, false alerts, or wasted commute anxiety."*

#### How to Execute:
Double-click `succes.bat` in Windows Explorer or run from terminal:
```cmd
succes.bat
```

#### Step-by-Step Pacing Timeline:
1. **t = 0s [Initialization]:**
   - Automatically checks if server is active on `http://localhost:3000`. If offline, compiles server bundle if needed and starts the daemon minimized.
   - Arms bilateral pact in SQLite for Paytm workspace: *Paytm & Google Anantha Strategy Meetup* (Kabir & Ananya, 60m threshold).
2. **t = 3s [Corridor Polling]:**
   - Simulates route queries for Indiranagar (12.8 km) and HSR Layout (9.6 km) corridors.
3. **t = 6s [Invariant Evaluation]:**
   - Displays evaluation matrix in terminal:
     - Indiranagar: **38 min** ($\le 60\text{m}$) $\rightarrow$ `PASS` (-22 min under ceiling)
     - HSR Layout: **34 min** ($\le 60\text{m}$) $\rightarrow$ `PASS` (-26 min under ceiling)
   - Consecutive breaches counter: **0 / 2**.
4. **t = 9s [Database Commit & Outbox Dispatch]:**
   - Logs observations with `provenance = 'live'`.
   - Dispatches confirmation to internal team channel `#channel_comp_paytm_office_pact`:
     `"✅ [All-Clear Confirmed] Route check complete: Indiranagar: 38 min, HSR Layout: 34 min. Both within 60m threshold. Zero breaches. Office pact on track!"`
5. **t = 10s [Browser Presentation]:**
   - Launches browser to `http://localhost:3000`.

#### Observable UI Verification for Evaluators:
- TopBar displays corporate badge: **Paytm (One97 Communications)** with `● LIVE MODE`.
- Green **"All clear" Dashboard** indicating 0 alerts requiring decision.
- Monitored Corridors card displays: **2 routes (● Active)**.
- Active pact card visible with direct navigation to pact details.

---

### 4.2 Demo Script 2: `fail.bat` — Observable Breach & Fallback Verification (~16 Seconds)

**Pitch Angle:** *"A single traffic spike is noise; two consecutive fresh checks make a verified breach. Once triggered, the pact automatically switches the team to remote before anyone leaves home."*

#### How to Execute:
Double-click `fail.bat` in Windows Explorer or run from terminal:
```cmd
fail.bat
```

#### Step-by-Step Pacing Timeline:
1. **t = 0s [Phase 1: Baseline Armed State]:**
   - Confirms server health and arms bilateral pact (`pact_paytm_google_anantha`).
   - Pacing delay allows judges to observe the armed baseline state (0/2 breaches).
2. **t = 4s [Phase 2: Traffic Spike Detected]:**
   - Outer Ring Road congestion spikes Kabir's commute from 34m to **68m (+8m over limit)**.
   - **Critical Invariant Highlighted:**
     Terminal displays: `>> 1st Breach Recorded (Confirming 1/2). Single breach NEVER alerts the team or cancels plans (Hysteresis invariant).`
   - Evaluators observe that the team is **not** falsely alerted on a single measurement.
3. **t = 9s [Phase 3: 2nd Consecutive Breach Confirmed]:**
   - Second fresh check at Bellandur bottleneck worsens to **72m (+12m over limit)**.
   - Mathematical proof satisfied: Two distinct fresh checks exceeded the threshold.
   - Terminal confirms: `>> 2nd Consecutive Fresh Breach (2/2) Confirmed!`
4. **t = 14s [Phase 4: Tripwire Alert Fired & Fallback Directive Proposed]:**
   - Tripwire alert generated with unique Cryptographic Episode Receipt ID.
   - Automatic remote fallback directive proposed:
     `"Switch to remote Google Meet and cancel cab"`
   - Outbox delivery dispatched to `#channel_comp_paytm_office_pact`.
5. **t = 16s [Phase 5: Browser Launch & Interactive Voting]:**
   - Automatically opens browser directly to the live agreement:
     `http://localhost:3000/pacts/pact_paytm_google_anantha`

#### Interactive Evaluation Walkthrough (What Judges See & Do):
1. **Verified Two-Breach Evidence Receipt Card:**
   - Evaluators inspect the cryptographic receipt with SHA-256 query hashes for Check 1 (68m) and Check 2 (72m).
   - Provenance badge clearly reads: `SYNTHETIC FIXTURE (AUDIT TRAIL)`.
   - Public Context Advisory card displays synthetic Bangalore Traffic Police advisory regarding Bellandur waterlogging.
2. **4-Step Stepper Decision Line:**
   - Step 3 (Tripwire Monitor) shows amber alert state.
   - Step 4 (Team Consensus) shows pending bilateral voting.
3. **Interactive Bilateral Consensus Voting:**
   - Evaluators can click any of the three decision buttons:
     - `Switch to Remote`: Casts vote to adopt the fallback plan.
     - `Keep the Plan`: Casts vote to proceed with onsite meeting despite traffic.
     - `Discuss in Chat`: Automatically flags a decision mismatch and drafts an alignment briefing in the chat drawer.
   - Once both participants cast matching votes, the Stepper resolves to green **"Consensus Reached: Unanimous Remote"** and a system resolution message is written to team chat.

---

## 5. Recovery & Troubleshooting Procedures

| Symptom / Failure | Probable Cause | Immediate Remediation |
|---|---|---|
| **`curl: (7) Failed to connect to localhost port 3000`** | Server process terminated or failed to start | 1. Check if another process occupies port 3000: `netstat -ano \| findstr :3000`<br>2. Run `npm run build:server` to verify compilation.<br>3. Launch server in terminal to observe startup errors: `node dist/server/index.js`. |
| **`npm run typecheck` reports 2 errors in `DecisionTab.tsx`** | Known issue with undeclared variables (`mayaChoiceObj`, `arjunChoiceObj`) | Run `npm run build` instead. Vite's esbuild compiler bundles the client without failing on type errors. Do not edit `DecisionTab.tsx` during an active pitch. |
| **Missing `dist/` directory or assets** | Fresh repository checkout without prior build | Run full build command: `npm run build`. This generates `dist/client` (Vite) and `dist/server` (tsc). |
| **`SQLITE_BUSY: database is locked`** | Concurrent SQLite write contention or zombie Node process holding lock | 1. Terminate orphaned Node processes: `taskkill /F /IM node.exe`<br>2. SQLite busy timeout is configured to 5000ms. Rerun the script. |
| **SerpApi rate limit or invalid API key** | Missing or exhausted `SERPAPI_API_KEY` | The application will log a warning and fall back to curated landmarks or synthetic data. `succes.bat` and `fail.bat` operate cleanly using deterministic database seeds even if SerpApi keys are omitted. |
| **Browser fails to launch automatically** | OS default browser handler restricted | Manually open your browser and navigate to `http://localhost:3000` (for success scenario) or `http://localhost:3000/pacts/pact_paytm_google_anantha` (for breach scenario). |

---

## 6. Known Limitations & Deferred Work

For transparency with technical evaluators, the following architectural boundaries and deferred items should be noted:

1. **Authentication:**
   - The login system (`/login`) is an enterprise identity simulation using HTTP headers (`x-company-id`, `x-user-id`).
   - It does not implement password hashing (bcrypt), OAuth2/OIDC, or signed JWT session tokens.
2. **Tenant Boundaries:**
   - Application queries filter by `company_id`.
   - However, the Server-Sent Events stream (`/api/stream`) broadcasts domain events globally across all connected clients without company partitioning.
   - The Enterprise Admin console (`/admin`) is unauthenticated.
3. **External Action Directives:**
   - Fallback proposals (*"Switch to remote Google Meet and cancel cab"*) are human-executable team alignment directives recorded in SQLite and posted to team chat.
   - They do **not** trigger direct automated API calls to Google Calendar, Google Meet, Uber, or Ola.
4. **Simulation Route Safety:**
   - Endpoints under `/api/simulation/` perform broad destructive SQL table deletes. They are strictly intended for controlled hackathon presentations and automated test harnesses against disposable databases.
