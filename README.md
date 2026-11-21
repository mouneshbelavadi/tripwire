# Tripwire: Office Pact

> **BEYOND 9TO5 Buildathon · Bengaluru · 21 November 2026**  
> **Track:** Track 1 (SerpApi) + You.com Answer + Nexconn Platform Chat  
> **Core Promise:** *“Agree on when to reconsider the office trip, then check together before anyone leaves.”*

---

## 1. Product Pitch & The Bengaluru Commute Problem

Morning commutes in Bengaluru are notorious for severe, unpredictable bottlenecks—especially across high-density tech corridors like the Outer Ring Road (ORR), Bellandur, Marathahalli, and Silk Board. 

Distributed teams planning to work together in person (for example, **Maya** travelling from Indiranagar and **Arjun** from HSR Layout to **WeWork Bellandur**) routinely encounter high-friction coordination overhead:
- Team members wake up early, guess commute conditions from individual navigation apps, and ask over chat if the meetup is still on.
- Frequently, one member spends 80+ minutes in bumper-to-bumper traffic only to arrive at an empty office because colleagues cancelled late, or everyone cancels unnecessarily because of a single transient traffic spike.

**Office Pact** solves this with a **deterministic, bilateral commute tripwire**:
1. **The Pact Contract:** Team members agree ahead of time on a destination, individual commute duration ceilings (e.g., 60 minutes driving), a decision deadline (e.g., 09:00 IST), and a default remote fallback (e.g., Google Meet huddle).
2. **Deterministic Background Monitoring:** A persistent scheduler checks Google Maps Directions and Traffic. Commute times are parsed and evaluated using mathematical invariants—free from LLM hallucinations or opaque heuristics.
3. **Strict Two-Breach Gate:** Exactly **two consecutive, source-fresh checks** exceeding a participant's limit are required to fire an alert. Single spikes or replayed cached data cannot trigger false alarms.
4. **5-Minute Recovery Hysteresis:** An active alert does not flap or reset on minor fluctuations; commute times must drop at least 5 minutes below the threshold to recover.
5. **Immutable Evidence Receipt & Bilateral Consensus:** When breached, an immutable evidence receipt is generated with before/after estimates, source timestamps, and cited corridor context. Participants vote (`Keep the plan`, `Switch to remote`, `Discuss`) to reach consensus before anyone steps out the door.

---

## 2. System Architecture

```mermaid
flowchart TD
  subgraph Client [React 18 + Vite + Astra Design System]
    UI[Workspace & Pact List]
    Triad[5-Second Legibility Triad]
    Stepper[4-Step Stepper Decision Line]
    ReceiptUI[Immutable Evidence Receipt]
    ChatUI[#bellandur-office-pact Channel]
  end

  subgraph Server [Node.js 24 + Express Application]
    Sec[Helmet Security & Rate Limiting]
    Auth[Session Manager & RBAC]
    Kernel[Deterministic Tripwire Kernel]
    Sched[Watch Scheduler Worker]
    Outbox[Outbox Delivery Worker]
  end

  subgraph Storage [SQLite 3 (Durable Persistent Database)]
    DB_Pacts[(pacts & participants)]
    DB_Watches[(watches & rule_states)]
    DB_Obs[(observations & alerts)]
    DB_Budget[(credit_attempts & worker_leases)]
    DB_Chat[(team_messages & outbox)]
  end

  subgraph Providers [External API Integrations]
    SerpApi[SerpApi: Maps / Directions / Traffic]
    YouAPI[You.com Answer API]
    Nexconn[Nexconn Platform Chat API]
  end

  UI --> Sec
  Sec --> Auth
  Auth --> Kernel
  Kernel --> Storage
  Sched --> DB_Watches
  Sched --> DB_Budget
  Sched --> SerpApi
  SerpApi --> Kernel
  Kernel --> YouAPI
  Outbox --> DB_Chat
  Outbox --> Nexconn
  Storage --> UI
```

### Architectural Highlights
- **Zero-Bloat Frontend:** Custom Astra design system built on paper (`#F7F6F2`), graphite (`#202824`), and forest green (`#245C46`). High contrast (WCAG AA compliant), responsive desktop/mobile layouts, and keyboard accessible.
- **Server-Side Security:** Enforced via `helmet()` security headers and sliding-window rate limiting on write endpoints (`POST /api/pacts`, `POST /api/alerts/:id/decision`).
- **Transactional Lease & Budget Guard:** A single scheduler worker acquires a SQLite database lease with periodic heartbeats. Every attempted search transactionally reserves a credit before dispatch, preventing double-spend or ceiling overruns.
- **Real-Time Cross-Session Sync:** Server-Sent Events (`/api/stream`) deliver immediate updates to all connected browser windows without polling lag.

---

## 3. 3-Command Setup & Quick Start

### 3-Command Setup (Any OS)
```powershell
npm install
npm run build
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### One-Click Launch (Windows)
Double-click **`run.bat`** (or execute `.\run.bat` in your terminal).  
This single batch file automatically:
1. Verifies Node.js (v20+) and npm.
2. Creates `.env` from `.env.example` if missing.
3. Installs dependencies if `node_modules` is not present.
4. Compiles client and server production bundles (`npm run build`).
5. Boots the server on port 3000 and automatically launches your browser.

---

## 4. Environment Variables Explanation (`.env.example`)

Copy `.env.example` to `.env` to configure credentials:
```powershell
cp .env.example .env
```

| Variable | Required? | Purpose & Engine Mapping |
|---|---|---|
| `PORT` | Optional (default: `3000`) | Port on which the Express server listens. |
| `SERPAPI_API_KEY` | Recommended | API key for SerpApi. Powers live Google Maps Directions, Traffic Incidents, and Place Autocomplete. |
| `YDC_API_KEY` | Optional | API key for You.com Answer API. Powers grounded public context summaries for traffic corridors. |
| `NEXCONN_APP_KEY` | Optional | Nexconn Platform Chat application key for token derivation. |
| `NEXCONN_APP_SECRET` | Optional | Nexconn Platform Chat application secret. |
| `NEXCONN_API_BASE` | Optional | Nexconn API base endpoint (e.g., `https://api.nexconn.ai/v4`). |

> **Honest Simulation Mode:** If `SERPAPI_API_KEY` or sponsor keys are omitted, Office Pact cleanly boots in **`SIMULATION`** mode. The full UI, 4-step stepper, multi-user consensus voting, and simulated breach sequences operate seamlessly using verified Bengaluru corridor fixtures, with clear and honest `SIMULATED CHANGE` and `CREDENTIALS PENDING` badges.

---

## 5. SerpApi Engine Specifications & Credit Guard

### Supported SerpApi Engines
1. **`engine=google_maps_directions`**
   - **Parameters:** `start_coords`, `end_coords`, `travel_mode=0` (Driving), `distance_unit=0`, `gl=in`, `hl=en`.
   - **Kernel Parser (`fastestDriving`):** Extracts the minimum finite positive `duration` in seconds across all returned Driving alternatives. Rejects non-numeric, negative, or boolean durations. Independent of row reordering.
2. **`engine=google_maps_traffic`**
   - **Parameters:** `bbox`, `zoom=13`, `gl=in`, `hl=en`.
   - **Kernel Parser (`incidentSnapshot`):** Extracts `{ incident_id: type }` maps with deterministic key sorting. Flags new incidents for route rechecks without falsely declaring routes closed.
3. **`engine=google_maps`**
   - **Parameters:** `q`, `ll`, `type=search`, `gl=in`, `hl=en`.
   - **Kernel Parser:** Resolves destination coordinates and place IDs for workspace venues.

### Transactional Credit Guard
- **Pre-Dispatch Reservation:** Credits are reserved inside a SQLite transaction (`BEGIN IMMEDIATE`) in the `credit_attempts` table *before* network requests are dispatched.
- **Ambiguous Failures Count as Spent:** If an upstream request times out, fails, or returns an error, the credit remains accounted for to protect account limits.
- **Ceiling Enforcement:** Research ceiling is strictly capped at **40 credits**; live demo windows cap at **60 credits**; total account allocation is enforced against **500 credits**.
- **Durability Across Restarts:** Budget usage is persisted in SQLite and cannot reset upon process restarts or crashes.

---

## 6. Key Design Decisions & Mathematical Invariants

| Design Decision | Rationale & Mathematical Invariant |
|---|---|
| **Why 2 Fresh Breaches?** | A single long commute estimate can be caused by transient signal drops, momentary traffic light queues, or map provider anomalies. Firing alerts on a single spike causes fatigue. Exactly **two consecutive, source-fresh checks** exceeding the limit are required before transitioning from `Confirming` to `Alert Active`. |
| **Why 5-Minute (300s) Recovery Hysteresis?** | Traffic congestion fluctuates constantly around thresholds. If a limit is 60 minutes and traffic drops from 68m to 59m, clearing the alert immediately would cause "flapping" (rapid alert/clear cycles). The kernel enforces a 300-second margin: duration must recover to $\le \text{limit} - 300\text{s}$ (e.g., 55 minutes) to clear the alert. |
| **Why Bilateral Approval?** | A commute pact is a bilateral social contract. Neither Maya nor Arjun can unilaterally change the threshold, destination, or deadline without mutual consent. Any modification increments the pact version ($v1 \to v2$) and automatically invalidates all prior approvals, returning the status to `Draft`. |
| **Why Reject Cached Timestamps?** | Replayed HTTP responses or stale provider cache hits have identical `created_at` or non-advancing source timestamps. The kernel rejects observations where `source_at <= last_source_at` or `observation_id` is already seen (`duplicate_or_old`), preventing replays from confirming alerts. |
| **Why Unanimous vs Needs Discussion?** | If Maya votes `Switch to remote` and Arjun votes `Keep the plan`, or if either participant chooses `Discuss`, consensus cannot be presumed. The status transitions to `needs_discussion` until the team aligns. |

---

## 7. Verification & Test Matrix (100% Passing)

Every test suite passes with zero errors:

| Suite | Command | Coverage & Invariants | Result |
|---|---|---|---|
| **Python Core Proof** | `python -m unittest discover -s scripts -p test_core.py -v` | Deadline status, decision resolution, credit estimation, 2-breach recovery hysteresis | **19/19 Passed** |
| **Prompt 8 Invariants & QA** | `npx tsx src/server/tests/test_prompt8_invariants.ts` | Deadlines, decision resolution, credit math, two-breach gate, rate limiting, helmet | **6/6 Passed** |
| **Domain Model & Auth** | `npx tsx src/server/tests/test_domain.ts` | Server-side team membership, versioned approvals, invalidation on rule edit | **5/5 Passed** |
| **Tripwire Backend** | `npx tsx src/server/tests/test_tripwire_core.ts` | Fastest driving duration, incident sets, 2-breach threshold, canonical query hash | **21/21 Passed** |
| **Scheduler & Lease** | `npx tsx src/server/tests/test_scheduler.ts` | Worker leases, single-flight ticks, outbox retry, budget ceilings, deadline stop | **6/6 Passed** |
| **Cited Context & Receipt** | `npx tsx src/server/tests/test_phase6.ts` | You Answer 400-char limits, citation sanitization, alert preservation on You failure | **5/5 Passed** |
| **Pact Creation & Past Plans** | `npx tsx src/server/tests/test_pact_management.ts` | Multiple pacts, past pacts archive, dynamic creation, automated watch arming | **5/5 Passed** |
| **Hygiene & Secrets** | `npx tsx scripts/scan_hygiene.ts` | Zero leaked tokens, .env and raw fixtures gitignored, budget durability on restart | **0 Violations** |
| **Full Production Build** | `npm run build` | Vite client bundle + TypeScript server compilation | **Clean Build** |
| **TypeScript Typecheck** | `npm run typecheck` | Strict compiler checks on client and server | **0 Errors** |

---

## 8. Known Limitations & Roadmap

### Current Scope & Honest Limitations
- **Multi-Modal Transit Excluded:** Current MVP targets four-wheeler / cab driving commutes via SerpApi Google Maps Directions. Bengaluru Namma Metro and BMTC bus schedules are not integrated.
- **No Calendar Writeback:** To maintain user trust and avoid disruptive automation, Office Pact does not modify Google Calendar or Outlook events directly.
- **No Live GPS Geotracking:** Office Pact explicitly does not track continuous background GPS locations of participants' personal phones, preserving privacy and battery life.

### Roadmap
1. **Multi-Modal Tripwires:** Add Namma Metro purple/green line service interruption alerts.
2. **Slack & Teams Native Bot:** Expand outbox delivery beyond Nexconn to enterprise Slack and Microsoft Teams channels.
3. **Recurring Pact Schedules:** Support weekly recurring templates (e.g., "Every Tuesday & Thursday morning").
4. **Carpool / Cab Coordination:** Integrate direct Uber/Ola shared booking link generation upon unanimous `Keep the plan` consensus.

---

## 9. Changelog Summary

See [CHANGELOG.md](file:///c:/Users/moune/OneDrive/Desktop/Office-Pact-Handoff/CHANGELOG.md) for full details across all prompts:
- **Prompt 8:** Helmet security headers, write endpoint rate limiting, deadline status & decision resolution domain invariants, credit estimation functions, 19/19 passing Python tests, and 2-minute demo walkthrough.
- **Prompt 7:** Astra warm paper design system, 5-second legibility triad, 4-step stepper decision line, and multi-browser synchronization.
- **Prompt 6:** Immutable evidence receipts with You.com grounded context and multi-action consensus.
- **Prompt 5:** Durable background scheduler worker, worker lease recovery, and transactional credit reservations.
- **Prompt 4:** Mathematical tripwire decision kernel with two-breach gate and 5-minute recovery margin.
- **Prompt 3:** Team membership authentication and Nexconn chat bridge.
- **Prompt 2:** SQLite schema, bilateral pact approvals, and venue autocomplete.
- **Prompt 1:** Field probe scripts, SerpApi contract validation, and architecture blueprint.
