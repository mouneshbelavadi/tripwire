# Tripwire Teams

> **Automated commute tripwires and bilateral remote agreements for hybrid engineering teams.**  
> Prevent the dreaded "empty office commute" before anyone steps out the door.

---

## 1. Overview & What It Is

In major tech metropolitan corridors (such as Bengaluru's Outer Ring Road, Silk Board, Indiranagar, and Whitefield), team members routinely embark on grueling 60–90+ minute commutes only to discover that colleagues are stranded in gridlock, delayed by sudden monsoon downpours, or forced to turn back.

Traditional map applications notify only individual drivers *after* they are already stuck in traffic. **Tripwire Teams** introduces **automated, team-level bilateral tripwires** inside Slack:

1. **A Team Lead creates an office day:** Using `/tripwire plan`, the lead schedules an office day with target arrival time and a decision deadline.
2. **Teammates opt in privately:** Using `/tripwire setup`, members define their approximate home locality, travel mode, and personal commute tolerance.
3. **Automated Background Telemetry:** Prior to the morning decision deadline, a persistent `pg-boss` queue worker polls predicted and live travel times via Google Routes API alongside Open-Meteo precipitation forecasts.
4. **Deterministic Invariant Evaluation:** If $40\%$ or more of active attendees (or $30\%$ when accompanied by $\ge 70\%$ rain probability) are affected on **two consecutive, source-fresh checks**, the app posts an actionable recommendation card in the team channel.
5. **Single Decision Maker Action:** The team lead presses a single button (**"Make it remote"**). Tripwire Teams automatically updates the shared Google Calendar event to "Remote Sync", attaches a Google Meet link, and notifies all attendees.

---

## 2. Non-Negotiable System Invariants

Tripwire Teams is built around eight strict safety and privacy rules:

| # | Invariant Rule | Implementation Detail |
|---|---|---|
| **1** | **No Fake Data as Live** | All synthetic or demo records are explicitly stamped with `provenance: 'simulated'` in PostgreSQL and flagged with prominent `[SIMULATED]` warnings in Slack. |
| **2** | **"Unknown" is Never "Fine"** | A timed-out, rate-limited, or failed provider check is stored as `unknown`. It never counts as OK and never resets a pending breach to OK. If $> 30\%$ of readings are unknown, Tripwire outputs `CANNOT_ASSESS`. |
| **3** | **Two Consecutive Fresh Checks** | A team recommendation of `RECOMMEND_REMOTE` requires two consecutive flagged checks no older than 10 minutes. A single spike never triggers false alarms. |
| **4** | **Privacy by Design** | Personal coordinates are strictly rounded to 2 decimal places ($\approx 1.1\text{ km}$ precision) before encryption at rest (AES-256-GCM). The team lead only sees aggregates (e.g. *"4 of 7 teammates affected"*), never individual home addresses or names. |
| **5** | **One Decision Maker** | Only the plan owner can click decision buttons. Clicks by other users receive an ephemeral reminder. No chaotic voting or veto loops. |
| **6** | **Idempotency & Audit Logging** | Every external mutation (Slack post, calendar update, data wipe) is idempotent and recorded in the append-only `audit_log` table. |
| **7** | **Zero Field Guessing** | Strictly conforms to official Google Routes API (`computeRoutes`), Google Calendar API v3, and Open-Meteo schemas. |
| **8** | **Zero Secret Logging** | Tokens, encryption keys, authorization codes, and raw coordinates are scrubbed before writing to logs. |

---

## 3. Quickstart Guide

Follow these five steps to set up and run Tripwire Teams locally:

### Step 1: Install Dependencies
Ensure you have **Node.js 20+** installed. Then install all dependencies:
```bash
cd tripwire-teams
npm install
```

### Step 2: Environment Configuration
Create a `.env` file in the `tripwire-teams` directory based on `.env.example`:
```bash
cp .env.example .env
```
Fill in the configuration variables:
```ini
# Application Mode ('development' | 'test' | 'production')
NODE_ENV=development
PORT=3000

# Slack Bolt App Credentials (Socket Mode recommended for local dev)
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_APP_TOKEN=xapp-your-slack-app-token
SLACK_SIGNING_SECRET=your-slack-signing-secret

# PostgreSQL Database Connection
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tripwire_teams?schema=public

# AES-256-GCM Encryption Key (Must resolve to exactly 32 bytes)
# Generate via: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Google APIs (Routes, Geocoding, Calendar)
GOOGLE_MAPS_API_KEY=AIzaSyYourGoogleMapsApiKey
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
```

### Step 3: Database Setup
Push the Prisma schema to your PostgreSQL instance to generate all tables and indexes:
```bash
npx prisma generate
npx prisma db push
```

### Step 4: Slack App Configuration
1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new Slack App **From an app manifest** or scratch.
2. Enable **Socket Mode** under **Settings > Socket Mode** and generate an App Token (`xapp-...`) with the `connections:write` scope.
3. Under **OAuth & Permissions**, add the following **Bot Token Scopes**:
   - `commands` (for `/tripwire` slash commands)
   - `chat:write` (to post channel recommendations)
   - `chat:write.public` (to post in channels without joining)
   - `channels:read` & `groups:read` (to list team channels)
   - `im:write` (to send private heads-up DMs to affected individuals)
   - `users:read` & `users:read.email` (to match calendar attendees)
4. Under **Slash Commands**, create command `/tripwire`:
   - Command: `/tripwire`
   - Description: `Tripwire Teams commute monitor and bilateral office pacts`
   - Usage Hint: `[setup | plan | preview | skip | forget | connect-calendar]`
5. Under **Interactivity & Shortcuts**, enable Interactivity.
6. Under **Event Subscriptions**, enable events and subscribe to:
   - `app_uninstalled` (triggers automated GDPR workspace data purge)
   - `tokens_revoked` (triggers automated workspace data purge)
7. Install the app to your Slack workspace and copy the Bot Token (`xoxb-...`).

### Step 5: Running Locally
Start the development server with live watch:
```bash
npm run dev
```
Alternatively, on Windows, double-click `run_tripwire_teams.bat` for one-click validation and startup!

The server will launch:
- 🌐 **Landing Page & Telemetry:** `http://localhost:3000/`
- 🩺 **Health Check:** `http://localhost:3000/health`
- 🔒 **Privacy Compliance:** `http://localhost:3000/privacy`
- 🛡️ **Security Policy:** `http://localhost:3000/security`
- 🔑 **Google OAuth Gateway:** `http://localhost:3000/oauth/google/callback`
- ⚡ **Slack Bolt:** Connected via Socket Mode
- 📦 **pg-boss Queue:** Listening for baseline and morning cadence jobs

---

## 4. Slash Command Reference

All interactions in Tripwire Teams are driven by `/tripwire` subcommands:

### `/tripwire`
- **Description:** System alive and health check.
- **Behavior:** Returns an ephemeral message confirming that the bot is running and lists all available slash commands.

### `/tripwire setup`
- **Description:** Personal commute preferences and privacy opt-in.
- **Behavior:** Opens an interactive Slack modal dialog where team members select:
  1. *Approximate Home Area:* Free-text locality (e.g. `HSR Layout, Bengaluru` or `Indiranagar`).
  2. *Travel Mode:* `Driving/Car`, `Two-Wheeler`, or `Public Transit`.
  3. *Commute Tolerance:* Personal maximum duration in minutes (default: 75).
- **Privacy Enforcement:** Coordinates are strictly rounded to 2 decimal places ($\approx 1.1\text{ km}$), encrypted using AES-256-GCM, and stored with an explicit consent timestamp.

### `/tripwire plan`
- **Description:** Team lead office day scheduler.
- **Behavior:** Opens a modal for the team lead:
  - Office address (geocoded & validated).
  - Target office date (defaults to tomorrow or next weekday).
  - Target arrival time (e.g. `09:30`).
  - Decision cutoff time (e.g. `08:30`, at least 30 mins before arrival).
  - Target Slack channel.
- **On Submit:** Persists the plan, enqueues pg-boss scheduled jobs (evening baseline at 20:00, morning cadence every 15 min starting 45 min before decision time), and announces the planned day in the channel.

### `/tripwire preview [planId]`
- **Description:** Private live dry-run check for the team lead.
- **Behavior:** Runs an immediate check against live providers (Google Routes API and Open-Meteo), evaluates decision invariants, and returns an ephemeral breakdown solely to the lead:
  - Total opted-in attendees & skipped count.
  - Number and percentage of teammates currently affected.
  - Rain probability & rainfall forecast.
  - Current recommendation outcome (`GO`, `RECOMMEND_REMOTE`, or `CANNOT_ASSESS`).

### `/tripwire skip <date>`
- **Description:** Opt out of a specific office day.
- **Examples:** `/tripwire skip 2026-11-23` or `/tripwire skip tomorrow`.
- **Behavior:** Marks the member as `hasSkipped: true` for that date's plan. They are excluded from commute queries, team threshold calculations, and notification cards.

### `/tripwire forget`
- **Description:** Instant GDPR / Right to be Forgotten data wipe.
- **Behavior:** Immediately and permanently erases all personal records across `members`, `checks`, `plan_attendees`, and `google_tokens` tables. Emits an immutable audit log entry.

### `/tripwire connect-calendar`
- **Description:** Google Calendar & Google Meet integration.
- **Behavior:** Responds with an ephemeral Google OAuth authorization link. Once completed, Tripwire securely encrypts and stores the OAuth refresh token to manage calendar events and Meet links automatically.

---

## 5. Verification & Testing

Tripwire Teams includes an exhaustive Vitest test suite with 10 modules and 190 tests covering 100% of core domain invariants:

```bash
# Run all Vitest test suites
npm test

# Run TypeScript static type checking
npx tsc --noEmit

# Run the Master Verification Script (report card)
npx tsx scripts/verify-all.ts
```

Subsystems verified by `scripts/verify-all.ts`:
1. `src/config/encryption.test.ts` — AES-256-GCM encryption, tampering rejection, and 32-byte key safety.
2. `src/features/members/member.test.ts` — Geocoding 2-decimal rounding, setup flow, skip, and GDPR cascade forget.
3. `src/features/commute/routes.test.ts` — Google Routes Provider, two-step arrival calculation, 429 backoff, 5xx retry, and daily quota guards.
4. `src/features/decision/decisionCore.test.ts` — Pure invariant decision engine, baseline multipliers, rain thresholds, and unknown reading limits.
5. `src/features/scheduler/scheduler.test.ts` — pg-boss queue scheduling, Open-Meteo rain forecasts, and idempotency guards.
6. `src/features/calendar/calendar.test.ts` — Google Calendar creation, Meet link generation, and remote fallback switching.
7. `src/features/security/security.test.ts` — Multi-tenant workspace isolation, log scrubbing, rate limiting, and retention policies.
8. `src/features/demo/demo.test.ts` — Bengaluru tech corridor fixtures, simulated disruption injection, and safety guards.
9. `src/features/evidence/evidence.test.ts` — SerpApi Google News traffic incidents telemetry and graceful degradation.
10. `src/features/slack-ui/card.test.ts` — Block Kit cards, single decision maker gate, and in-place message updates.

---

## 6. One-Click Windows Runner (`run_tripwire_teams.bat`)

For quick local development on Windows:
```cmd
.\run_tripwire_teams.bat
```
The script automatically:
1. Verifies **Node.js** version $\ge 20$.
2. Verifies presence of `.env` (or guides from `.env.example`).
3. Verifies dependency installation (`node_modules`).
4. Generates Prisma Client (`npx prisma generate`).
5. Boots the Tripwire Teams master server with colored status logging.

---

## 7. License & Credits

Tripwire Teams is licensed under the MIT License. Built with ❤️ for hybrid teams seeking certainty before the morning commute.
