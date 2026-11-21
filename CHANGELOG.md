# Changelog

All notable changes to the **Tripwire: Office Pact** project across all development prompts are documented in this file.

---

## [0.8.0] - 2026-11-21 · Prompt 8: Production Security, Invariant QA & Documentation Freeze

### Added
- **Security & Middleware:**
  - Integrated `helmet()` HTTP security middleware in `src/server/app.ts` providing secure HTTP response headers (`X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, `X-DNS-Prefetch-Control`).
  - Added sliding-window rate limiting middleware (`src/server/middleware/rateLimiter.ts`) protecting write endpoints (`POST /api/pacts`, `POST /api/alerts/:id/decision`, and pact update/approval mutations).
- **Core Domain Invariants & Functions:**
  - `getDeadlineStatus` (`upcoming`, `closing_soon`, `expired`) implemented in both TypeScript and Python.
  - `resolveDecisionStatus` (`unanimous_keep`, `unanimous_remote`, `needs_discussion`, `pending`) implemented in both TypeScript and Python, ensuring unanimous consensus vs discussion requirements are deterministically enforced.
  - `estimateCreditRequirement` calculating route checks, traffic checks, contingency reserve, and budget cap adherence.
- **QA & Unit / Integration Test Suites:**
  - Added `src/server/tests/test_prompt8_invariants.ts` covering deadline statuses, decision resolution, credit estimation, two-breach gate, recovery hysteresis, and rate limiting.
  - Expanded Python test suite `scripts/test_core.py` to 19 tests, covering deadline status, team decision resolution, credit estimation, and two-breach recovery margin.
- **Documentation & Walkthroughs:**
  - Created `DEMO.md`: Crisp 2-minute judge/evaluator walkthrough with exact clicks, timestamps, narration notes, and fallback plans.
  - Updated `README.md` with complete product pitch, architectural diagram, 3-command setup, environment variables guide, SerpApi specifications, credit guard explanation, design decisions, and roadmap.

### Fixed & Hardened
- Sanitized personal email identifiers and verified zero secrets or live keys are tracked in Git.
- Verified `.env` and raw/private fixtures are strictly git-ignored via automated scanner (`scripts/scan_hygiene.ts`).
- Fixed asynchronous test pact cleanup in `src/server/tests/test_scheduler.ts` to prevent transient SQLite foreign key constraint errors during background dispatch.

---

## [0.7.0] - 2026-11-21 · Prompt 7: Astra Design System, UI Craft & Accessibility

### Added
- Handcrafted Astra design system based on warm paper (`#F7F6F2`), deep graphite ink (`#202824`), and forest green (`#245C46`).
- Signature 5-Second Legibility Triad (Agreed Condition, Source Age, Next Action).
- 4-Step Stepper Decision Line visualizing progression from Draft $\to$ Armed $\to$ Breach Confirmation $\to$ Resolution.
- Real-time Server-Sent Events (`/api/stream`) for instant cross-browser state synchronization between Maya and Arjun.
- Automated accessibility and visual audit script (`scripts/audit_phase7.ts`) testing contrast, 200% zoom, focus traps, and keyboard navigation.

---

## [0.6.0] - 2026-11-21 · Prompt 6: Evidence Receipts, Cited Context & Decision Actions

### Added
- Immutable Evidence Receipt generation (`src/server/domain/receiptService.ts`) capturing baseline, check 1, check 2, source freshness, and area traffic incidents.
- You.com Answer API integration with query length enforcement ($\le 400$ characters) and citation sanitization.
- Real-time decision action buttons (`Keep the plan`, `Switch to remote`, `Discuss`) with multi-user vote recording.

### Fixed
- Guaranteed alert preservation: failure or timeout of You.com public context queries never degrades or resets a numerical route alert.

---

## [0.5.0] - 2026-11-21 · Prompt 5: Durable Scheduler, Outbox Worker & Lease Recovery

### Added
- Background scheduler worker (`src/server/scheduler/watchScheduler.ts`) with durable SQLite lease (`worker_leases`) and heartbeat renewals.
- Outbox worker (`src/server/scheduler/outboxWorker.ts`) implementing reliable message dispatch with exponential backoff.
- Transactional credit reservation table (`credit_attempts`) preventing double-spend and enforcing strict session spending caps.

---

## [0.4.0] - 2026-11-21 · Prompt 4: Deterministic Decision Kernel & Math Invariants

### Added
- Mathematical decision kernel (`src/server/domain/tripwireCore.ts` and `scripts/tripwire_core.py`).
- Two-fresh-breaches requirement: exactly two consecutive, source-fresh checks required to trigger an alert.
- 5-minute (300s) recovery hysteresis margin preventing flapping.
- Rejection of duplicate observation IDs, cached timestamps, future timestamps, and malformed numeric values.

---

## [0.3.0] - 2026-11-21 · Prompt 3: Authentication & Multi-User Session Management

### Added
- Session switcher for team members Maya (Indiranagar) and Arjun (HSR Layout).
- Nexconn chat authentication token derivation and team communication channel bridge.
- Protected API endpoints checking session authorization headers.

---

## [0.2.0] - 2026-11-21 · Prompt 2: Domain Schema & Bilateral Pact Governance

### Added
- SQLite database schema (`officepact.sqlite3`) supporting pacts, participants, watches, observations, alerts, and acknowledgements.
- Bilateral pact consent logic: any modification increments pact version and invalidates all prior approvals.
- Place search and venue resolution service (`src/server/domain/venueService.ts`).

---

## [0.1.0] - 2026-11-21 · Prompt 1: Field Probes, Engine Specifications & Budget Design

### Added
- API field contract validator (`fixtures/field-contract.json`).
- Python probe script (`scripts/probe_apis.py`) testing SerpApi, You.com, and Nexconn connectivity.
- Architecture blueprint (`BUILDPLAN.md`) and engine catalog (`ENGINE-CATALOG.md`).
- 40-credit research budget cap and 500-credit event allotment plan.
