# Office Pact buildathon handoff

Start with **astra.md** for full context and copy-ready, phase-by-phase Antigravity prompts. Use **BUILDPLAN.md** during the sprint and **RESEARCH.md** when defending the idea and API choices.

The strongest candidate is **Tripwire: Office Pact**: a small team agrees on commute limits and a decision deadline, monitors evidence, and reconsiders the meetup together before leaving. It uses SerpApi Maps, Maps Directions and Maps Traffic, You.com Answer and Nexconn group chat.

**Honest result: 8.83/10; no idea passed the requested 9+ gate.** This is a conditional prototype plan. It is not a built application or a validated 9+ project.

## What is included

- `RESEARCH.md`: five scored ideas, Tripwire assessment, saturated ideas with project names, white space, sourced API contracts and unknowns.
- `ENGINE-CATALOG.md`: 189 documentation-page inventory, including 169 distinct engine values explicitly extracted from engine parameter declarations. Counts include auxiliary and feature pages; no claim of 189 independent engines.
- `BUILDPLAN.md`: architecture, data model, eight-hour timeline, credit budget, caching/fallbacks, risks and three-minute demo.
- `astra.md`: complete context, restrained professional UI direction, acceptance criteria and boot plus eight phase prompts.
- `scripts/`: executable provider probes, deterministic rule proof and tests.
- `fixtures/`: documentation-backed field contract and actual skip report. No fabricated API responses.
- `sources/`: source URLs/hashes, showcase counts and nearest-project evidence.

## Run

Python 3.10+; probe and tests use the standard library only.

```powershell
python scripts/probe_apis.py
python -m unittest discover -s scripts -p test_core.py -v
```

Export credentials into the process environment using the names in `.env.example`. The probe does not load `.env` files. Do not paste keys into chat or commit them. A credentialed probe run attempts three SerpApi searches, one You.com Answer request and one Nexconn token request for a dedicated test identity. It sends no chat messages. A persistent local research ledger caps SerpApi search attempts at 40, including errors. Keep the ledger across reruns.

## Verification status

Research SerpApi usage: **0/40**. All expected credentials were absent, so the five provider endpoint probes were skipped. No provider fields are live-verified yet. Nexconn Web SDK connection and delivery are not proven by a server token request and still require a two-session test.

**15 local tests pass**, covering decision and budget invariants; these tests do not establish data coverage, provider integration or UI quality. The UI is specified in prompts, not implemented in this handoff.

When distributing the package after a live run, exclude `fixtures/private/`, `fixtures/raw/`, databases and secret files. Raw Nexconn responses contain access tokens. The supplied handoff archive contains only shareable planning/code/evidence files from this research run.
