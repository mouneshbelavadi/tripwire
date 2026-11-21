# Tripwire Teams: Evaluator Walkthrough & Demo Script
**A 3-Minute Live Judge Rehearsal Script**

---

## Overview

Tripwire Teams is an intelligent commute-aware watchtower for hybrid teams. It eliminates morning Slack chaos, removes guesswork about severe transit disruptions and heavy monsoon rain, and automates the decision to transition an in-office day to remote with a single click.

This 3-minute walkthrough showcases:
1. **Live Provider Preview** without team channel spam.
2. **2-Breach Hysteresis Invariant** and explicit `SIMULATED` labeling during deterministic demo tests.
3. **Single Decision Maker Workflow** with one-click remote transition.
4. **Automated Google Calendar & Meet Sync** (`sendUpdates='all'`).
5. **Instant Privacy Compliance** via `/tripwire forget` (Zero data retention).

---

## 3-Minute Presentation Cue Sheet

| Time Window | Segment | Action / Screen | Key Talking Point |
|---|---|---|---|
| **0:00 – 0:35** | **Step 1: `/tripwire preview`** | Team lead runs `/tripwire preview` in Slack. | Real-time live provider lookup. Ephemeral response: aggregate metrics only, zero channel spam, zero privacy leakage. |
| **0:35 – 1:15** | **Step 2: Deterministic Disruption & Hysteresis** | Inject synthetic disruption across Bengaluru corridors (ORR, Silk Board, Whitefield). | **Rule 3 & Rule 1:** Bold `🚨 [SIMULATED]` banner. Check 1 triggers `CONFIRMING` (no alarm). Check 2 confirms `RECOMMEND_REMOTE`. Zero false positives. |
| **1:15 – 1:50** | **Step 3: Single Decision Maker** | Lead clicks **"Make it remote"** on Slack Block Kit card. Non-leads are blocked. | **Rule 5:** Exactly one decision maker. No time wasted on morning group polls. |
| **1:50 – 2:30** | **Step 4: Calendar & Google Meet Sync** | Google Calendar updates live to "Remote" with Google Meet video link. | **Rule 6:** Idempotent external action written to `audit_log`. All attendees notified automatically. |
| **2:30 – 3:00** | **Step 5: Privacy by Design & Forget** | Member types `/tripwire forget`. DB records wiped immediately. | **Rule 4:** Rounded coordinates (2 decimals ~1 km), encrypted at rest. Immediate data purge on demand. |

---

## Detailed Step-by-Step Walkthrough

### Step 1: `/tripwire preview` (0:00 – 0:35)
*Goal: Demonstrate live real-time checking without disturbing teammates.*

#### What to Do:
1. As the team lead in your Slack `#engineering-team` channel, type:
   ```text
   /tripwire preview
   ```
2. Press Enter.

#### What Appears on Screen:
An **ephemeral** message (visible *only* to the team lead):
```text
🔒 Private Live Preview for Tomorrow's In-Office Plan
This summary is visible only to you as the plan owner. Nothing has been posted to the channel.

*Aggregate Team Status:*
• Currently 2 of 5 eligible teammates are projected to face delays (40.0%).
• 0 teammates opted out / skipped for tomorrow.

*Weather Projection:*
• 15% rain probability, 0.0mm expected in morning commute window.

*Current Recommendation Preview:*
🟢 GO - within normal bounds
> Commute within normal limits: 2 of 5 eligible attendees affected (40.0%), below threshold of 40%. Team travel is GO.
```

#### What to Say to the Judges:
> *"Hybrid team leads usually have no idea if their team is about to commute into a transit gridlock until people start complaining in Slack. With `/tripwire preview`, the lead can pull a real-time live check right now for tomorrow's plan.*
>
> *Notice two crucial architectural details: First, this message is strictly ephemeral—nothing is posted to the team channel. Second, privacy by design is preserved: the lead sees only high-level aggregates (`2 of 5 teammates projected to face delays`), never individual home locations or names."*

---

### Step 2: Deterministic Disruption & 2-Breach Hysteresis (0:35 – 1:15)
*Goal: Demonstrate simulated disruption with strict safety labeling and the 2-breach hysteresis filter.*

#### What to Do:
1. Trigger the deterministic demo simulation sequence (via demo CLI or test runner with `DEMO_MODE=true`):
   ```bash
   DEMO_MODE=true npm run test -- demo.test.ts
   ```
   *Or trigger the Slack demo action.*

#### What Appears on Screen:
The Slack channel receives a notification with the mandatory simulation banner:
```text
🚨 [SIMULATED TEST DATA - FOR DEMO ONLY]
Tripwire Bengaluru Simulation (first_breach)
• Affected attendees: 3 of 5 (60.0%)
• Decision outcome: CONFIRMING
• Weather condition: 85% rain, 14.5mm
• Consecutive flagged checks: 1
> Commute threshold breached: 3 of 5 eligible attendees affected (60.0%), meeting threshold of 30%. Breach confirming (check 1 of 2 required).
```

10 minutes later (simulated check 2):
```text
🚨 [SIMULATED TEST DATA - FOR DEMO ONLY]
⚠️ Commute Disruption Detected for Tomorrow's In-Office Day
"3 of 5 teammates are likely to face very long commutes tomorrow"

• Outer Ring Road transit corridor is exceeding baseline by +85% (Bellandur waterlogging)
• Central Silk Board flyover gridlock: +94% delay over baseline
• 85% heavy rain predicted during morning commute window (14.5mm rainfall)
• Checked live at 08:10 AM. Two consecutive fresh checks verified.

[ Make it remote ]  [ Keep in office ]  [ Let individuals decide ]
```

#### What to Say to the Judges:
> *"A single GPS spike or temporary traffic hiccup must never cancel an office day. Tripwire Teams enforces a strict 2-breach hysteresis filter: a remote recommendation requires two consecutive fresh readings exceeding thresholds.*
>
> *Look at Check 1: Outer Ring Road, Silk Board, and Whitefield spiked, but Tripwire flagged it as `CONFIRMING` without crying wolf. Ten minutes later, Check 2 confirmed the persistent disruption, advancing to `RECOMMEND_REMOTE`.*
>
> *And notice our non-negotiable safety invariant: every piece of simulated data in the database and in Slack is permanently stamped with the bold `🚨 [SIMULATED TEST DATA - FOR DEMO ONLY]` badge. Production live data and simulated test runs can never be confused."*

---

### Step 3: Single Decision Maker (1:15 – 1:50)
*Goal: Show fast, decisive leadership without chaotic morning voting.*

#### What to Do:
1. Try clicking **"Make it remote"** as a regular team member (non-owner).
   - Slack shows an immediate private rejection:
     `"🔒 Only the plan owner (@lead) can make the office day decision."`
2. Now, click **"Make it remote"** as the team lead.

#### What Appears on Screen:
The card updates instantaneously in the channel:
```text
✅ Decided: Remote Work Day
Decision by @lead at 08:11 AM.
Reason: 3 of 5 teammates affected (60.0%) on Outer Ring Road & Silk Board, with 85% heavy monsoon rain.
Calendar event updated to Remote with Google Meet video link.
```

#### What to Say to the Judges:
> *"Most hybrid team tools make the mistake of running democratic polls at 7:30 AM, resulting in confusion and delayed commutes. Tripwire Teams enforces one clear decision maker: only the plan owner can click the action button. Decisions are fast, final, and everyone is immediately on the same page."*

---

### Step 4: Real Google Calendar & Meet Sync (1:50 – 2:30)
*Goal: Show the real-world automated resolution.*

#### What to Do:
1. Open Google Calendar in the browser tab.
2. View the scheduled team event: `Engineering Sprint Planning & Office Day`.

#### What Appears on Screen:
- Location has changed from `Bagmane Tech Park, Bellandur, Bengaluru` to `Google Meet (Remote Work Day)`.
- A Google Meet conference URL is automatically attached: `https://meet.google.com/xyz-abcd-jkl`.
- Event description updated:
  `"Tripwire Teams Update: Converted to Remote due to commute disruptions. Join via Google Meet."`
- Calendar guest notification (`sendUpdates: 'all'`) sent to all attendees.
- Audit log entry stored in PostgreSQL:
  ```json
  {
    "actionType": "CALENDAR_UPDATE",
    "actorSlackUserId": "U_LEAD",
    "targetEntity": "plan:plan_blr_101",
    "details": { "status": "REMOTE", "meetLinkAttached": true }
  }
  ```

#### What to Say to the Judges:
> *"Here is the real payoff. The lead clicked one button in Slack, and Tripwire Teams immediately called the Google Calendar API: changing the location, provisioning a real Google Meet conference room, notifying all attendees, and writing an idempotent audit record. Nobody needs to scramble to create a link or ping people in DMs."*

---

### Step 5: Privacy by Design & `/tripwire forget` (2:30 – 3:00)
*Goal: Demonstrate privacy compliance and instant data erasure.*

#### What to Do:
1. In Slack, a team member types:
   ```text
   /tripwire forget
   ```
2. Press Enter.

#### What Appears on Screen:
```text
🗑️ Your Tripwire profile and saved commute data have been permanently erased.
• Coordinates and home area removed.
• Historical commute checks anonymized.
• Workspace association purged.
```

#### What to Say to the Judges:
> *"Finally, privacy is built directly into our schema. Teammates never provide exact street addresses—only neighborhood labels. Coordinates are rounded to 2 decimal places (roughly 1 kilometer) and encrypted at rest with AES-256-GCM.*
>
> *And if any teammate ever wants to opt out, `/tripwire forget` immediately wipes their profile and encrypted coordinates from the database. Zero friction, zero data hoarding.*
>
> *Tripwire Teams gives hybrid organizations the best of both worlds: data-driven commute intelligence with total privacy and zero false alarms."*

---

## Evaluator FAQ & Technical Architecture Sheet

### Q1: How do you prevent false alarms from temporary traffic jams?
> **A:** The Pure Invariant Decision Engine (`src/features/decision/decisionCore.ts`) strictly requires **two consecutive fresh checks** (`<= 10 minutes old`) with advancing provider timestamps. Replayed or cached provider timestamps are automatically ignored (`step2DuplicateTimestampReplay`), preventing stale cache hits from falsely confirming a disruption.

### Q2: What happens if Google Routes API or Open-Meteo is down?
> **A:** **"Unknown is never fine."** If more than 30% of eligible member readings fail or are stale, the engine transitions to `CANNOT_ASSESS`. It will **never** guess or assume everything is OK, and unknown readings **never silently clear** a pending breach. The system honestly notifies the lead to make a manual call.

### Q3: How is tenant isolation enforced in multi-workspace Slack installs?
> **A:** Every single database query partitions by `workspaceId`. Cross-tenant checks are validated in `src/features/security/workspaceIsolation.ts`. If an app is uninstalled or tokens revoked, a cascading purge wipes all workspace data immediately.
