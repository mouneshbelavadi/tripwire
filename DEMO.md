# Office Pact: 2-Minute Demo Walkthrough

> **BEYOND 9TO5 Buildathon · Bengaluru · 21 November 2026**  
> **Target Audience:** Judges, Evaluators, Engineering Leads  
> **Total Time:** 2 Minutes (120 Seconds)  
> **Core Narrative:** *“We don’t tell you how to navigate. We automate the team agreement: agree together, check deterministically, decide before anyone steps out the door.”*

---

## Demo Setup (10 Seconds Before Demo Starts)

1. Open two browser windows side by side:
   - **Left Window:** Maya's Session (`http://localhost:3000?user=user_maya` or select Maya in header)
   - **Right Window:** Arjun's Session (`http://localhost:3000?user=user_arjun` or select Arjun in header)
2. Ensure the dev/prod server is running (`npm start` or `run.bat`).
3. If live API keys are not supplied, the app operates in **Simulation Mode** with full interactivity, realistic Bangalore traffic fixtures, and honest disclosures.

---

## Script & Walkthrough Timeline

### [0:00 – 0:25] The Bengaluru Commute Problem & The 5-Second Triad
- **Action (Left Window):**
  - Point to Maya (Indiranagar) and Arjun (HSR Layout) planning to meet at **WeWork Bellandur** with an agreed 60-minute threshold before **09:00 IST**.
- **Narration:**
  > *"Every morning in Bengaluru, distributed teams face the same dread: 'Should we still head to the office, or is Outer Ring Road blocked?' Usually, it’s frantic WhatsApp messages at 08:30 when someone is already stuck in a cab. Office Pact solves this by making commute decisions a deterministic team contract."*
- **Visual Highlight:**
  - Show the **5-Second Legibility Triad** at the top of Maya's workspace:
    1. **Agreed Condition:** “Fastest driving > 60m on 2 fresh checks before 09:00 IST”
    2. **Source Age:** “Last check: 2 min ago” (source freshness)
    3. **Next Action:** “Status: Awaiting Arjun's approval”

---

### [0:25 – 0:50] Bilateral Pact Agreement & Mathematical Invariants
- **Action (Right Window - Arjun):**
  - Click **Approve Version 1** in Arjun's window.
- **Visual Highlight:**
  - Notice the **4-Step Stepper Decision Line** immediately transition across **both windows** in real-time from `Awaiting Approval` to `ARMED` (Forest Green).
  - Point out that neither participant can be forced into a commute they didn't approve: editing any rule (threshold, deadline, venue) instantly invalidates prior approvals and returns status to `Draft`.
- **Narration:**
  > *"Both Maya and Arjun have signed version 1. The pact is now ARMED. A background SQLite worker monitors Google Maps Directions every 5 minutes and Bellandur area traffic every 15 minutes. Note our credit guard in the header: every check transactionally reserves a SerpApi credit from our budget ceiling before network dispatch."*

---

### [0:50 – 1:20] Controlled Two-Breach Alert & Deduplication Proof
- **Action (Left Window):**
  - Click the **"Simulate 2-Breach Alert"** button in the Simulation Controls panel.
- **Visual Highlight:**
  - The first check returns 68 minutes $\to$ Status transitions to **`Confirming (1/2)`** (Amber). No premature alert is fired!
  - The second fresh check returns 72 minutes $\to$ Status transitions to **`ALERT ACTIVE`** (Crimson).
  - The persistent **`SIMULATED CHANGE`** badge appears, upholding honest provenance.
- **Narration:**
  > *"Notice our critical mathematical invariant: exactly TWO consecutive, fresh breaches are required. A single spike or transient GPS blip only enters 'Confirming'. Only when the second fresh check confirms 72 minutes does the alert tripwire fire. Stale cached timestamps or replayed network responses are mathematically rejected."*

---

### [1:20 – 1:45] The Immutable Evidence Receipt & Real-Time Consensus
- **Action (Either Window):**
  - Point to the **Evidence Receipt** that appeared:
    - Baseline: 42m $\to$ Check 1: 68m $\to$ Check 2: 72m (+30m congestion).
    - Area Traffic Incidents: Identifies waterlogging on the Bellandur corridor (without making false claims of total road closure).
    - Public Context: Grounded corridor summary citing public road conditions.
- **Action (Right Window - Arjun):**
  - Arjun clicks **"Switch to remote"**.
- **Action (Left Window - Maya):**
  - In Maya's window, observe Arjun's vote appear instantly: `"Arjun voted Switch to remote · Awaiting Maya"`.
  - Maya clicks **"Switch to remote"**.
- **Visual Highlight:**
  - Status immediately resolves to **`CONSENSUS: SWITCH TO REMOTE`**.
  - A resolution announcement appears in the persistent team chat channel `#bellandur-office-pact`.
- **Narration:**
  > *"The Evidence Receipt provides the facts so the humans own the decision. Arjun votes to switch to remote; Maya sees it in real time and agrees. Consensus is reached. No one wasted 90 minutes in traffic, and no one sat alone in an empty office."*

---

### [1:45 – 2:00] Boundaries & Credit Ceiling Guard
- **Action:**
  - Point to the **Budget & Spend Ledger** in the header or Health drawer: `40/40 Research Cap` and persistent lease state.
- **Narration:**
  > *"Office Pact respects strict boundaries: it does not track employee phones, book cabs, or hallucinate road closures. If the credit ceiling is reached or the 09:00 deadline passes, monitoring pauses cleanly. The team owns the decision; Office Pact guarantees the evidence on time. Thank you."*

---

## Contingency & Fallback Plans

| Potential Friction | Observed Behavior | Immediate Fallback Action |
|---|---|---|
| **Live SerpApi / You API is slow (>3s)** | Network latency | The system's transactional lease handles single-flight queries. If demonstrating on stage with poor WiFi, rely on the **Simulation Controls** panel, which uses pre-loaded verified Bengaluru corridor fixtures with zero network delay. |
| **Missing API Keys in `.env`** | `CREDENTIALS PENDING` banner | App automatically boots in `SIMULATION` mode. All UI flows, consensus voting, decision lines, and receipt generation work identically. Disclose honestly: *"Running on validated synthetic Bengaluru fixtures."* |
| **Accidental Double Click** | Rapid repeated requests | Write rate limiter throttles excessive requests (HTTP 429), and database idempotency locks prevent duplicate pact creation or multiple alerts for the same episode. |
| **Browser Window Desync** | SSE connection reset | The app auto-reconnects to `/api/stream` within 3 seconds and fetches fresh state via HTTP polling fallback. |
