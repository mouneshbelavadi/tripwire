# Tripwire: Office Pact — Complete Project Context & Architecture Guide

> **Target Audience:** Developers, System Architects, and AI Assistants (e.g., OpenAI Codex / GitHub Copilot) continuing development, code auditing, and performance optimization on this project.  
> **Repository:** `Office-Pact-Handoff`  
> **Primary Track:** **Track 1: SerpApi (Google Maps, Directions, Traffic)**  
> **Excluded Tracks / Services:** **Nexconn Chat SDK** and **You.com Answer API** are deliberately **NOT** used.

---

## 1. Executive Summary & Problem Space

### 1.1 The Core Problem
In major congested tech hubs (specifically demonstrated in Bengaluru: Bellandur, Outer Ring Road, Silk Board, Indiranagar, HSR Layout), team members often travel 60–90+ minutes to an office only to find that their colleagues were delayed or decided to stay home. 

Traditional navigation apps (e.g. Google Maps, Waze) alert only the individual commuter after they are already sitting in traffic. They do not enable **bilateral, enforceable team agreements** beforehand.

### 1.2 The Solution
**Tripwire: Office Pact** is an automated tripwire agreement system:
1. **Form a Bilateral Pact:** Two colleagues (e.g., Maya from Indiranagar and Arjun from HSR Layout) agree to meet at a designated workspace (e.g., *WeWork Bellandur*).
2. **Set Commute Thresholds & Decision Deadline:** Each defines their maximum acceptable commute duration (e.g., 60 minutes) and an agreed decision deadline (e.g., 09:00 IST).
3. **Automated Background Watcher:** A background worker monitors live commute durations via **SerpApi (Google Maps Directions & Traffic)**.
4. **Deterministic Tripwire Invariant:** If live driving duration for *either* person exceeds their threshold in **two consecutive fresh observations** before the deadline, an alert fires and automatically triggers the agreed remote fallback (*"Switch to remote Google Meet and cancel cab"*).
5. **Shared Team Decision:** Both participants make decisions within the app before anyone wastes hours in gridlock.

---

## 2. Track & Sponsor Scope Clarification

| Sponsor / API | Status | Implementation Details |
|---|---|---|
| **SerpApi** | **ACTIVE (Primary Track 1)** | Used for live Google Maps Directions (`engine=google_maps_directions`), Traffic Incidents (`engine=google_maps_traffic`), and Place Autocomplete. Tracks credit consumption against an hourly/session budget ceiling. Configured via `SERPAPI_API_KEY` in `.env`. |
| **Nexconn Chat SDK** | **EXCLUDED / NOT USED** | Per project requirements, Nexconn Chat SDK is **not used**. Instead, an internal SQLite-backed team communication channel (`#bellandur-office-pact`) provides persistent team messaging without external cloud chat dependencies. |
| **You.com Answer API** | **EXCLUDED / NOT USED** | You.com is **not used**. Route advisories, traffic bulletin alerts, and corridor public context are generated deterministically from SerpApi traffic incidents and official municipal traffic feeds. |

---

## 3. High-Level System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Tripwire: Office Pact                         │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   Frontend (React 18 + Vite 6 + Astra Design System)                   │
│   ┌────────────────────┐ ┌───────────────────┐ ┌───────────────────┐   │
│   │ 224px Pact List    │ │ Primary Workspace │ │ 336px Team Chat   │   │
│   │ - Draft/Armed/Alert│ │ - 5s Legibility   │ │ - Channel:        │   │
│   │ - Version badges   │ │ - Decision Line   │ │   #bellandur-     │   │
│   │ - Active pacts     │ │ - Live SerpApi ⚡ │ │   office-pact     │   │
│   └────────────────────┘ └───────────────────┘ └───────────────────┘   │
│                                  │ (REST APIs)                         │
├──────────────────────────────────┼─────────────────────────────────────┤
│   Backend (Node.js 20+ / Express / TypeScript)                         │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ REST API Layer (/api/pacts, /api/health, /api/simulation,    │     │
│   │ /api/chat/messages)                                          │     │
│   └──────────────────────────────┬───────────────────────────────┘     │
│                                  ▼                                     │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ Domain & Mathematical Invariants Engine (tripwireCore.ts)    │     │
│   │ - 2-Breach Gate      - Recovery Margin (5m)                  │     │
│   │ - Fastest Driving    - Canonical Query Hash (SHA-256)        │     │
│   │ - Freshness Gate     - Version / Approval Invalidation       │     │
│   └──────────────────────────────┬───────────────────────────────┘     │
│                                  ▼                                     │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ Durable Background Worker & Scheduler (worker.ts, scheduler) │     │
│   │ - SQLite Lease Locking (TTL: 10s)                            │     │
│   │ - Transactional Credit Reservation (reserveCredit)           │     │
│   │ - Next-due query polling (Directions 5m, Traffic 15m)        │     │
│   └──────────────────────────────┬───────────────────────────────┘     │
│                                  ▼                                     │
│   Database (SQLite via node:sqlite native module, officepact.db)       │
│   - pacts, participants, watches, observations, rule_states,     │     │
│     credit_attempts, team_messages, outbox, alerts                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Tech Stack Breakdown

### Frontend
- **Framework:** React 18.3.1
- **Bundler & Dev Server:** Vite 6.1.0
- **Language:** TypeScript 5.7.3
- **Styling Architecture:** Custom **Astra Design System** (defined in `astra.md` and `src/client/index.css`)
  - **Tokens:** Paper canvas (`#FBFBF9`), graphite text (`#1A1A1A`), forest green accents (`#1B4D3E`), warning amber (`#B45309`), danger red (`#B91C1C`).
  - **Typography:** IBM Plex Sans / system monospace font stacks. Strict tabular numbers for alignment (`font-variant-numeric: tabular-nums`).
  - **Layout Geometry:**
    - Top team header: fixed `56px` height.
    - Left sidebar (pact list): fixed `224px` width.
    - Main workspace: flex `1 1 auto` (min `560px`).
    - Right conversation slot: fixed `336px` width.
    - Mobile responsive: Tabs for `Pact`, `Evidence`, `Chat` with sticky bottom action bar below 840px.

### Backend
- **Runtime:** Node.js v20+ / v24+
- **HTTP Server:** Express 4.21.2
- **Language:** TypeScript (compiled via `tsc -p tsconfig.server.json` to `dist/server/`)
- **Database:** Embedded SQLite 3 via Node.js native `node:sqlite` (`DatabaseSync`), requiring zero external database setup or C++ native addon builds.
- **Transactions:** Strict transactional atomicity using `db.exec('BEGIN IMMEDIATE')` and `db.exec('COMMIT')` / `ROLLBACK`.

---

## 5. Mathematical & Domain Invariants (`tripwireCore.ts`)

The project implements mathematical invariants to eliminate false alerts and phantom triggers:

### 5.1 The Two-Breach Gate
- **Invariant:** A single high traffic spike *never* alerts. Exactly **two distinct, consecutive, source-fresh breach observations** ($T_1 > \text{limit}$ and $T_2 > \text{limit}$) are mandatory before transitioning state from `confirming` to `alert`.
- **First breach:** Sets state to `confirming` (`consecutive_breaches = 1`).
- **Second breach:** Sets state to `alert` (`active = true`, generates logical alert entity).

### 5.2 Recovery Hysteresis Gate
- **Invariant:** To prevent rapid flickering/thrashing between alert and non-alert states, an active alert does **not** clear when traffic simply drops 1 second below the threshold.
- Commute duration must recover by at least **5 minutes (300 seconds)** below the agreed limit:
  $$\text{duration} \le \text{limit} - 300\text{s}$$
- Only then does the state transition from `alert` to `recovered`.

### 5.3 Stale & Unknown Data Invariants
- **Stale Data:** If observation timestamp is in the future ($t_{source} > t_{now}$) or older than 5 minutes ($t_{now} - t_{source} > 300\text{s}$), outcome is `'stale'`.
- **Unknown Data:** If duration is missing, non-finite, $\le 0$, or error payload, outcome is `'unknown'`.
- **CRITICAL INVARIANT:** Stale or Unknown data clears the confirmation streak, but **NEVER clears an active alert**. An active alert can only be cleared by a fresh, valid recovery.

### 5.4 Fastest Driving Selection
- Multiple route options may be returned by Google Maps Directions (`directions[]`).
- The engine filters strictly for `travel_mode === 'Driving'`, rejects booleans, NaNs, and negative numbers, and deterministically computes:
  $$\text{fastestDuration} = \min_{r \in \text{routes}} (r.\text{duration})$$
- Independent of row reordering.

### 5.5 Canonical Query Hashing
- Invariant: Rules cannot be compared across different queries or endpoints.
- Evaluates SHA-256 hash of sorted query parameters excluding ephemeral flags:
  $$\text{excludedKeys} = \{\text{api\_key}, \text{no\_cache}, \text{async}, \text{output}\}$$
- If `queryHash` or `ruleVersion` changes, comparison is declared `'incomparable'` and establishes a clean baseline.

### 5.6 Version Invalidation & Bilateral Approvals
- Any modification to pact title, destination, participants, or thresholds increments `pact.version` (e.g. $v_1 \to v_2$).
- Invalidation Rule: Changing rules immediately invalidates all prior participant approvals and resets `rule_states`.
- Both participants must explicitly approve the exact current version before the watch is `armed`.

---

## 6. Database Schema (`officepact.sqlite3`)

The SQLite database is initialized automatically on startup by `src/server/db.ts`:

```sql
-- Team Pacts
CREATE TABLE IF NOT EXISTS pacts (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  title TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'armed' | 'paused' | 'triggered' | 'completed'
  destination_name TEXT NOT NULL,
  destination_place_id TEXT,
  destination_lat REAL,
  destination_lon REAL,
  destination_address TEXT,
  decision_deadline_utc TEXT NOT NULL,
  decision_deadline_ist TEXT NOT NULL,
  fallback_text TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Participants & Commute Limits
CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  pact_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  neighbourhood TEXT NOT NULL,
  origin_lat REAL NOT NULL,
  origin_lon REAL NOT NULL,
  max_duration_s INTEGER NOT NULL DEFAULT 3600,
  approval_version INTEGER,
  approved_at TEXT,
  FOREIGN KEY (pact_id) REFERENCES pacts(id) ON DELETE CASCADE
);

-- Team Messages (Persistent Team Conversation)
CREATE TABLE IF NOT EXISTS team_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  text TEXT NOT NULL,
  sent_time INTEGER NOT NULL
);

-- Scheduled Watches (Worker polling targets)
CREATE TABLE IF NOT EXISTS watches (
  id TEXT PRIMARY KEY,
  pact_id TEXT NOT NULL,
  engine TEXT NOT NULL, -- 'google_maps_directions' | 'google_maps_traffic'
  params_json TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  next_due_at TEXT NOT NULL,
  ttl_s INTEGER NOT NULL DEFAULT 300,
  priority INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (pact_id) REFERENCES pacts(id) ON DELETE CASCADE
);

-- Observations (Normalized results from SerpApi)
CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  watch_id TEXT NOT NULL,
  provider_search_id TEXT,
  provider_created_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  raw_hash TEXT NOT NULL,
  normalized_json TEXT NOT NULL,
  validity TEXT NOT NULL, -- 'valid' | 'unknown' | 'empty'
  provenance TEXT NOT NULL, -- 'live' | 'replay' | 'synthetic'
  FOREIGN KEY (watch_id) REFERENCES watches(id) ON DELETE CASCADE
);

-- Rule States (Persistent Tripwire evaluation state per watch)
CREATE TABLE IF NOT EXISTS rule_states (
  watch_id TEXT PRIMARY KEY,
  pact_version INTEGER NOT NULL,
  last_source_at REAL,
  consecutive_breaches INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 0,
  episode_id TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (watch_id) REFERENCES watches(id) ON DELETE CASCADE
);

-- Credit Attempts (Transactional SerpApi budget accounting)
CREATE TABLE IF NOT EXISTS credit_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_id TEXT,
  phase TEXT NOT NULL,
  reserved_at TEXT NOT NULL,
  state TEXT NOT NULL, -- 'reserved' | 'spent' | 'aborted'
  provider_search_id TEXT
);
```

---

## 7. SerpApi Integration Specifications

### 7.1 Authentication & Configuration
- SerpApi API key is read from `.env` (`SERPAPI_API_KEY`).
- When present, the server boots in `LIVE MODE`.
- The free SerpApi Account endpoint (`https://serpapi.com/account?api_key=...`) is queried to track live account status:
  - Account verified: `mouneshbelavadi15@gmail.com`
  - Total remaining searches tracked live.

### 7.2 Directions Query Engine
- **Engine:** `google_maps_directions`
- **Query Parameters:**
  ```typescript
  {
    engine: 'google_maps_directions',
    start_coords: `${participant.origin_lat},${participant.origin_lon}`,
    end_coords: `${pact.destination_lat},${pact.destination_lon}`,
    travel_mode: '0',   // 0 = Driving
    distance_unit: '0', // 0 = km
    gl: 'in',           // India
    hl: 'en',
    no_cache: 'true'    // Guarantees real fresh traffic calculation
  }
  ```
- **Durations Verified:**
  - Arjun (HSR Layout $\to$ WeWork Bellandur): ~14–15 minutes
  - Maya (Indiranagar $\to$ WeWork Bellandur): ~29–30 minutes

### 7.3 Budget Reservation Guard (`reserveCredit`)
Before executing any call to SerpApi, credits are reserved transactionally:
```typescript
export function reserveCredit(label: string, cap: number = 40): number {
  // Checks that active credit attempts < cap (40 credits limit)
  // Throws error before dispatch if cap exceeded
}
```
Failed or ambiguous attempts remain spent to avoid budget overruns.

---

## 8. REST API Reference

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | `GET` | Health check returning mode (`LIVE`/`SIMULATION`), budget usage, worker lease state, and provider configuration status. |
| `/api/pacts` | `GET` | Lists all pacts for the active team (both active and past plans). |
| `/api/pacts/:id` | `GET` | Retrieves full details for a pact, including participants and approval states. |
| `/api/pacts` | `POST` | Creates a brand new pact with UUID, Maya & Arjun participants, and attached watches. |
| `/api/pacts/:id` | `PUT` | Updates an existing pact (advances version, resets prior approvals). |
| `/api/pacts/:id/approve` | `POST` | Records the active user's approval for the current pact version. |
| `/api/pacts/:id/complete` | `POST` | Marks the pact completed, moves it to Past Plans, and disables watches. |
| `/api/simulation/check-live` | `POST` | Dispatches real live SerpApi Directions checks for all pact participants, evaluates rules, and records credit usage. |
| `/api/simulation/state/set` | `POST` | Switches demo states (`draft`, `armed`, `confirming`, `alert`, `stale`, `budget_paused`) for UI visual testing. |
| `/api/chat/messages` | `GET` | Retrieves recent messages for team channel `#bellandur-office-pact`. |
| `/api/chat/messages` | `POST` | Posts a new message from the authenticated user to the team channel. |

---

## 9. Automation & Running the Project

### 9.1 One-Click Windows Launcher (`run.bat`)
A single batch file automates everything:
```bat
run.bat
```
What `run.bat` does automatically:
1. Validates `node` and `npm` are in `PATH`.
2. Checks for `.env` (creates from `.env.example` if absent).
3. Installs `node_modules` if missing (`npm install`).
4. Runs full production build: Vite frontend (`npm run build:client`) and TypeScript backend (`npm run build:server`).
5. Launches the default browser to `http://localhost:3000`.
6. Starts the server (`node dist/server/index.js`).

### 9.2 Manual Commands
```bash
# Install dependencies
npm install

# Run full build
npm run build

# Start server
npm start

# Run unit invariants test (Python)
npm run test:python
```

---

## 10. End-to-End User Walkthrough on Localhost

Here is the exact step-by-step workflow of how users interact with the application on `http://localhost:3000`:

### Step 1: Launch the Application
- Double click `run.bat` or run `npm start` in the terminal.
- Your browser opens to `http://localhost:3000`.
- The top header displays:
  - Application badge: `Tripwire: Office Pact · BEYOND 9TO5 · Bengaluru`
  - Mode indicator: **`LIVE MODE`** (green token) powered by real SerpApi queries.
  - Budget tracker: **`BUDGET: X/40 CREDITS`** tracking live Google Maps queries.
  - Session selector: Switch between **Maya (Indiranagar)** and **Arjun (HSR Layout)** in the top right.

### Step 2: Browse Active and Past Plans
- In the left sidebar (`224px`), observe the segmented filter tabs:
  - **`Active (1)`**: Shows active agreements (e.g., `Bellandur Office Meetup`).
  - **`Past (2)`**: Click to view archived plans from previous days (`Whitefield Client Sync`, `Koramangala Standup`).
  - **`All (3)`**: Displays all agreements in one comprehensive view.
- Click any past plan to inspect its historical commute conditions, approved thresholds, and concluded status.

### Step 3: Create a Brand-New Pact
- In the left sidebar, click **`+ New`**.
- The **`Create New Office Pact`** dialog opens:
  - Enter a meeting title (e.g., `"Koramangala Tech Sync"`).
  - Select destination (or click `Change Place` to search verified Bangalore coworking venues).
  - Configure individual commute thresholds for Maya (e.g., `60 min`) and Arjun (e.g., `60 min`).
  - Set the decision deadline (e.g., `09:30 IST`).
  - Set the remote fallback action (e.g., `"Switch to Google Meet"`).
- Click **`Create Pact (v1)`**: A new plan is created in `draft` status with version `v1` without modifying or overwriting any existing plan!

### Step 4: Bilateral Agreement & Arming
- **Maya's Turn:** Acting as Maya, review the condition in the 5-second legibility triad and click **`Approve v1 (as Maya)`**.
  - The status updates to `APPROVALS (1/2 approved)`.
- **Arjun's Turn:** Use the session switcher in the top right to switch to **Arjun (HSR Layout)**.
  - Notice the action button updates to **`Approve v1 (as Arjun)`**.
  - Click approve. With both parties approved, the status transitions to **`ARMED`** (indicated with a solid green pill and decision line).

### Step 5: Execute Live SerpApi Commute Checks
- Under the evidence section, click **`⚡ Run Live Commute Check (SerpApi)`**.
- Real Google Maps Directions queries dispatch with `no_cache=true`:
  - Maya's route (Indiranagar $\to$ Bellandur): ~30 min driving ($\le 60$ min limit).
  - Arjun's route (HSR Layout $\to$ Bellandur): ~15 min driving ($\le 60$ min limit).
- The budget increments transactionally in the header, and both routes confirm within limits.

### Step 6: Collaborate in Team Chat
- In the right sidebar (`336px`), participate in `#bellandur-office-pact`.
- Type a message in the composer (e.g., *"Outer Ring Road looks clear today!"*) and click **Send**.
- Switch users to see the message instantly in Arjun's view.

### Step 7: Conclude and Archive a Plan
- When the meeting or day concludes, click **`Complete Pact`**.
- The pact transitions to `COMPLETED` and automatically moves into the **`Past Plans`** tab, disabling background polling watches while preserving the full audit trail.
```

---

## 10. Opportunities & Next Steps for Codex

When collaborating with Codex or other coding assistants to improve this codebase, here are the most valuable areas for enhancement:

1. **WebSocket / Server-Sent Events (SSE) Live Feed:**
   - Currently, the frontend polls `/api/pacts/:id` and `/api/chat/messages`.
   - *Improvement for Codex:* Implement lightweight SSE (`/api/stream`) to push instant updates when an observation completes, when a partner approves, or when a chat message arrives.
2. **Interactive Map Visualization:**
   - Currently, coordinates and distances are rendered textually in the evidence panel.
   - *Improvement for Codex:* Add a lightweight Leaflet or Canvas map showing the origins (Indiranagar, HSR Layout), destination (Bellandur), and route polylines with traffic congestion coloring.
3. **Multi-Leg / Alternative Commute Modes:**
   - Expand `travel_mode` to support Bangalore Namma Metro + Auto-rickshaw multimodal comparisons alongside Driving.
4. **Calendar Webhook Integration:**
   - Trigger the creation of an Office Pact automatically when a shared Google Calendar / Outlook meeting is scheduled at an in-person office location.
