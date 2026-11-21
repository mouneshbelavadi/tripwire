# Tripwire: Office Pact — Pitch Demonstration & Evaluation Runbook

> **Target Audience:** Presenters, Hackathon Evaluators, System Auditors, and Demonstrators.  
> **Repository:** `Office-Pact-Handoff`  
> **Key Value Proposition:** *"Agree on when to reconsider the office trip, check before leaving."*  
> **Supported Demo Runners:** `succes.bat` (All-Clear & Arrived Onsite proof, ~10s) and `fail.bat` (Observable breach & selectable fallback options, ~16s).

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
| **Safe Commute Demo (`succes.bat`)** | Indiranagar & HSR Layout corridors | **Seeded Baseline & Arrival State** | Injected via `POST /api/simulation/safe-commute` with `fastestDuration` = 2280s (38m) and 2040s (34m). Demonstrates zero breaches, safe commute window, and onsite arrival progression with "Continue Work & Open Strategy Session". |
| **Breach Fail Demo (`fail.bat`)** | Step 1 (68m) & Step 2 (72m) | **Synthetic Fixture** | Generated deterministically by `createSyntheticBreachSequence()`. Tagged with `provenance = 'synthetic'` in `observations`. Presents actionable selectable fallback options (Meet, Cancel Cab, Cancel Meeting, Maintain Plan, Chat) without unilateral auto-redirects. |
| **Breach Citations** | Bangalore Traffic Police Advisory | **Synthetic Fixture** | Hardcoded citation in `citation_contexts` referencing Bellandur junction waterlogging. **Not a live municipal scrape.** |
| **Live Route Check** | Directions Polling | **Live SerpApi** | Triggered via `POST /api/simulation/check-live` or wizard route checks; calls `https://serpapi.com/search.json?engine=google_maps_directions`. |
| **Interactive Map** | Corridor Map & Destination Pins | **Live Esri Tiles** | Live vector street map tiles loaded directly via Leaflet from Esri (`https://server.arcgisonline.com/...`) without watermarks. |
| **Places Discovery** | Landmark Search | **Live OpenAI / Grok** | Fallback autocomplete queries OpenAI Chat Completions (`gpt-4o-mini`) to resolve unstructured corporate landmarks. |

---

## 4. Multi-Tenant Enterprise Authentication & Login Flow

The Office Pact web client features a multi-tenant corporate login form (`/login`) designed for live enterprise walkthroughs. To simulate corporate single sign-on without external IdP configuration, the system collects four authentication fields:

### 4.1 Authentication Form Fields
1. **Company Legal Name:** The registered corporate entity name (e.g., `Paytm (One97 Communications)`, `Google Bengaluru`, `Acme Corp`).
2. **Company ID (Corporate Workspace Key):** The corporate workspace identifier used to partition pacts, channels, and team rules (e.g., `PAYTM-CORP-01`, `GOOG-BLR-01`, `comp_acme`).
3. **Employee Name:** The participant's display name for pact membership, audit trails, and consensus votes (e.g., `Kabir`, `Ananya`, `Maya`).
4. **Employee ID (Corporate Badge / Staff ID):** The participant's corporate badge identifier ensuring unambiguous participant tracking and cryptographic audit integrity (e.g., `PAYTM-EMP-01`, `PAYTM-EMP-02`).

### 4.2 Sample Corporate Demo Credentials

Presenters and evaluators can switch tenants or log in as distinct participants using the following standard credentials:

| Corporate Tenant | Company ID (Key) | Employee Name | Employee ID (Badge) | Corridor / Neighbourhood | Role |
|---|---|---|---|---|---|
| **Paytm** (`One97 Communications`) | `PAYTM-CORP-01` | **Kabir** | `PAYTM-EMP-01` | HSR Layout | Participant |
| **Paytm** (`One97 Communications`) | `PAYTM-CORP-01` | **Ananya** | `PAYTM-EMP-02` | Indiranagar | Creator |
| **Google** (`Google LLC`) | `GOOG-BLR-01` | **Sundar** | `GOOG-EMP-01` | Whitefield | Creator |
| **Google** (`Google LLC`) | `GOOG-BLR-01` | **Priya** | `GOOG-EMP-02` | Koramangala | Participant |
| **Acme** (`Acme Corp`) | `comp_acme` | **Maya** | `ACME-EMP-01` | Indiranagar | Creator |
| **Acme** (`Acme Corp`) | `comp_acme` | **Arjun** | `ACME-EMP-02` | HSR Layout | Participant |

> [!TIP]
> The login form automatically provisions or resolves the corporate tenant and user profile in SQLite upon form submission, ensuring zero setup friction during live pitches.

---

## 5. Rehearsal Guide: Demonstration Batch Runners

### 5.1 Demo Script 1: `succes.bat` — All-Clear & Arrived Onsite Verification (~10 Seconds)

**Pitch Angle:** *"When traffic is within agreed bounds, the system provides passive assurance without noise, false alerts, or wasted commute anxiety. Once members reach the destination, it seamlessly transitions into the arrived onsite state."*

#### How to Execute:
Double-click `succes.bat` in Windows Explorer or run from terminal:
```cmd
succes.bat
```

#### Step-by-Step Pacing Timeline:
1. **t = 0s [Initialization]:**
   - Automatically checks if server is active on `http://localhost:3000`. If offline, compiles server bundle if needed and starts the daemon minimized.
   - Arms bilateral pact in SQLite for Paytm workspace: *Paytm & Google Anantha Strategy Meetup* (Kabir [PAYTM-EMP-01] & Ananya [PAYTM-EMP-02], 60m threshold).
2. **t = 3s [Corridor Polling]:**
   - Simulates route queries for Indiranagar (12.8 km) and HSR Layout (9.6 km) corridors.
3. **t = 6s [Invariant Evaluation]:**
   - Displays evaluation matrix in terminal:
     - Indiranagar: **38 min** ($\le 60\text{m}$) $\rightarrow$ `PASS` (-22 min under ceiling)
     - HSR Layout: **34 min** ($\le 60\text{m}$) $\rightarrow$ `PASS` (-26 min under ceiling)
   - Consecutive breaches counter: **0 / 2**.
4. **t = 9s [Database Commit, Invariant Satisfied & Arrival State]:**
   - Emphasizes arrival and time progression in terminal:
     ```
     [00:09.000] t=9s │ INVARIANT SATISFIED: COMMUTE SAFE & ARRIVED ONSITE
       🏢 Destination: Google Anantha Bengaluru
       👥 Participants: Kabir [PAYTM-EMP-01] (HSR Layout) & Ananya [PAYTM-EMP-02] (Indiranagar)
       ⏱  Indiranagar: 38 min (Limit: 60m) · ZERO BREACHES
       ⏱  HSR Layout:   34 min (Limit: 60m) · ZERO BREACHES
       🎉 Status:      Team has arrived safely onsite. Proceeding with work.
     ```
   - Logs observations with `provenance = 'live'`.
   - Dispatches confirmation to internal team channel `#channel_comp_paytm_office_pact`:
     `"✅ [Commute Safe & Arrived Onsite] Indiranagar (38m) & HSR Layout (34m). Zero breaches. Team has arrived safely onsite at Google Anantha Bengaluru. Proceeding with work!"`
5. **t = 10s [Browser Presentation]:**
   - Launches browser directly to:
     `http://localhost:3000?arrived=true`

#### Observable UI Verification for Evaluators:
- TopBar displays corporate badge: **Paytm (One97 Communications)** with `● LIVE MODE`.
- Green **"Commute Safe & Arrived Onsite" Dashboard Banner** with timestamp and zero breach confirmation.
- Rich arrival dashboard card: **"Continue Work & Open Strategy Session"**, giving participants one-click access to meeting notes, agenda, and desk resources.
- Monitored Corridors card displays: **2 routes (● Active)**.
- Active pact card visible with direct navigation to pact details.

---

### 5.2 Demo Script 2: `fail.bat` — Observable Breach & Selectable Fallback Options (~16 Seconds)

**Pitch Angle:** *"A single traffic spike is noise; two consecutive fresh checks make a verified breach. Once triggered, the pact provides an actionable menu of fallback options (Google Meet, ride cancellation, meeting reschedule, or team discussion) rather than an automatic unilateral redirect, allowing the team to make an informed consensus choice."*

#### How to Execute:
Double-click `fail.bat` in Windows Explorer or run from terminal:
```cmd
fail.bat
```

#### Step-by-Step Pacing Timeline:
1. **t = 0s [Phase 1: Baseline Armed State]:**
   - Confirms server health and arms bilateral pact (`pact_paytm_google_anantha`) for Kabir [PAYTM-EMP-01] and Ananya [PAYTM-EMP-02].
   - Pacing delay allows judges to observe the armed baseline state (0/2 breaches).
2. **t = 4s [Phase 2: Traffic Spike Detected]:**
   - Outer Ring Road congestion spikes Kabir's commute ([PAYTM-EMP-01]) from 34m to **68m (+8m over limit)**.
   - **Critical Invariant Highlighted:**
     Terminal displays: `>> 1st Breach Recorded (Confirming 1/2). Single breach NEVER alerts the team or cancels plans (Hysteresis invariant).`
   - Evaluators observe that the team is **not** falsely alerted on a single measurement.
3. **t = 9s [Phase 3: 2nd Consecutive Breach Confirmed]:**
   - Second fresh check at Bellandur bottleneck worsens to **72m (+12m over limit)**.
   - Mathematical proof satisfied: Two distinct fresh checks exceeded the threshold.
   - Terminal confirms: `>> 2nd Consecutive Fresh Breach (2/2) Confirmed!`
4. **t = 14s [Phase 4: Tripwire Alert Fired & Actionable Fallback Options Menu]:**
   - Tripwire alert generated with unique Cryptographic Episode Receipt ID.
   - Terminal displays the actionable fallback options menu:
     ```
     ======================================================================
     ACTIONABLE FALLBACK OPTIONS AVAILABLE TO USER:
     ======================================================================
       [1] Go to Google Meet      -> Open virtual meeting room (meet.google.com)
       [2] Cancel the cab         -> Cancel Uber / Ola ride to avoid penalties
       [3] Cancel the meeting     -> Reschedule in-person sync to tomorrow
       [4] Maintain Office Plan   -> Proceed with onsite meeting despite traffic
       [5] Discuss in Team Chat   -> Align in internal team channel
     ----------------------------------------------------------------------
     >> Launching Microsoft Edge directly to interactive decision panel...
     ```
   - Outbox delivery dispatched to `#channel_comp_paytm_office_pact`.
5. **t = 16s [Phase 5: Browser Launch to Interactive Decision Panel]:**
   - Automatically opens Microsoft Edge directly to the decision tab:
     `http://localhost:3000/pacts/pact_paytm_google_anantha?tab=decision`

#### Interactive Evaluation Walkthrough (What Judges See & Do):
1. **Verified Two-Breach Evidence Receipt Card:**
   - Evaluators inspect the cryptographic receipt with SHA-256 query hashes for Check 1 (68m) and Check 2 (72m).
   - Provenance badge clearly reads: `SYNTHETIC FIXTURE (AUDIT TRAIL)`.
   - Public Context Advisory card displays synthetic Bangalore Traffic Police advisory regarding Bellandur waterlogging.
2. **4-Step Stepper Decision Line:**
   - Step 3 (Tripwire Monitor) shows amber alert state.
   - Step 4 (Team Consensus) shows pending bilateral voting.
3. **Actionable Fallback Options & Bilateral Consensus Voting:**
   - Evaluators see the five actionable fallback choices available to the user:
     - `[1] Go to Google Meet`: Direct link to switch the sync into a virtual meeting room.
     - `[2] Cancel the cab`: Prompt / deep-link to cancel Uber/Ola ride before cancellation fees apply.
     - `[3] Cancel the meeting`: Reschedule in-person sync to tomorrow.
     - `[4] Maintain Office Plan`: Proceed with onsite meeting despite traffic.
     - `[5] Discuss in Team Chat`: Align in internal team channel.
   - Evaluators can click the voting buttons to cast their decision:
     - `Switch to Remote`: Casts vote to adopt virtual fallback.
     - `Keep the Plan`: Casts vote to proceed with onsite meeting despite traffic.
     - `Discuss in Chat`: Automatically flags a decision mismatch and drafts an alignment briefing in the chat drawer.
   - Once both participants cast matching votes, the Stepper resolves to green **"Consensus Reached: Unanimous Remote"** and a system resolution message is written to team chat.

---

## 6. Recovery & Troubleshooting Procedures

| Symptom / Failure | Probable Cause | Immediate Remediation |
|---|---|---|
| **`curl: (7) Failed to connect to localhost port 3000`** | Server process terminated or failed to start | 1. Check if another process occupies port 3000: `netstat -ano \| findstr :3000`<br>2. Run `npm run build:server` to verify compilation.<br>3. Launch server in terminal to observe startup errors: `node dist/server/index.js`. |
| **`npm run typecheck` reports 2 errors in `DecisionTab.tsx`** | Known issue with undeclared variables (`mayaChoiceObj`, `arjunChoiceObj`) | Run `npm run build` instead. Vite's esbuild compiler bundles the client without failing on type errors. Do not edit `DecisionTab.tsx` during an active pitch. |
| **Missing `dist/` directory or assets** | Fresh repository checkout without prior build | Run full build command: `npm run build`. This generates `dist/client` (Vite) and `dist/server` (tsc). |
| **`SQLITE_BUSY: database is locked`** | Concurrent SQLite write contention or zombie Node process holding lock | 1. Terminate orphaned Node processes: `taskkill /F /IM node.exe`<br>2. SQLite busy timeout is configured to 5000ms. Rerun the script. |
| **SerpApi rate limit or invalid API key** | Missing or exhausted `SERPAPI_API_KEY` | The application will log a warning and fall back to curated landmarks or synthetic data. `succes.bat` and `fail.bat` operate cleanly using deterministic database seeds even if SerpApi keys are omitted. |
| **Browser fails to launch automatically** | OS default browser handler restricted | Manually open your browser and navigate to `http://localhost:3000?arrived=true` (for success scenario) or `http://localhost:3000/pacts/pact_paytm_google_anantha?tab=decision` (for breach scenario). |

---

## 7. Known Limitations & Deferred Work

For transparency with technical evaluators, the following architectural boundaries and deferred items should be noted:

1. **Authentication:**
   - The login system (`/login`) is an enterprise identity simulation using HTTP headers (`x-company-id`, `x-user-id`) and collects Company Legal Name, Company ID, Employee Name, and Employee ID.
   - It does not implement password hashing (bcrypt), OAuth2/OIDC, or signed JWT session tokens.
2. **Tenant Boundaries:**
   - Application queries filter by `company_id`.
   - However, the Server-Sent Events stream (`/api/stream`) broadcasts domain events globally across all connected clients without company partitioning.
   - The Enterprise Admin console (`/admin`) is unauthenticated.
3. **External Action Directives:**
   - Fallback options (Go to Google Meet, Cancel the cab, Reschedule sync, Maintain Plan, Discuss in Chat) are human-executable team alignment choices presented to the user and recorded in SQLite.
   - They do **not** unilaterally execute automated external API calls to Google Calendar, Google Meet, Uber, or Ola without user confirmation.
4. **Simulation Route Safety:**
   - Endpoints under `/api/simulation/` perform broad destructive SQL table deletes. They are strictly intended for controlled hackathon presentations and automated test harnesses against disposable databases.
