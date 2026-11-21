PROJECT: Tripwire Teams

WHAT IT IS
A Slack app for hybrid teams. A team lead creates an office day. Opted-in members have an approximate home area and travel mode. Before a decision time, the app checks predicted and live commute times plus rain. If enough of the team is affected on two consecutive fresh checks, it posts a recommendation in the channel. The lead presses one button. "Make it remote" converts the Google Calendar event to remote with a Google Meet link and notifies attendees.

USERS
- Team lead: creates plans, receives recommendation, decides.
- Team member: opts in once with /tripwire setup, can /tripwire skip a day, can /tripwire forget to delete all their data.
- Workspace admin: installs the app. There is no separate admin console.

STACK
TypeScript, Node 20+, Slack Bolt, PostgreSQL, pg-boss for scheduled jobs, Prisma, zod for env validation, vitest for tests. Google Routes API for commute times, Google Geocoding API for area lookup, Open-Meteo for rain forecast, Google Calendar API for the real action.

NON-NEGOTIABLE RULES
1. No fake data presented as live. Anything simulated must be labelled SIMULATED in the database (provenance column) and in the Slack message.
2. "Unknown" is never "fine". A failed or stale reading is stored as unknown. It never counts as OK and never resets a pending breach to OK silently. If more than 30 percent of readings are unknown, say "cannot assess" instead of recommending.
3. Two consecutive fresh flagged team-level readings are required before recommending remote. A fresh reading is no older than 10 minutes.
4. Privacy by design. Home location is stored only as a label plus coordinates rounded to 2 decimals (about 1 km), encrypted at rest. The team lead sees only aggregates (for example "4 of 7 affected"), never individual home areas. Names are hidden by default. /tripwire forget deletes all of a person's data immediately. On app_uninstalled or tokens_revoked, delete that workspace's data.
5. One decision maker. Only the plan owner can press the decision buttons. No voting.
6. Every external action (calendar change, Slack post) is idempotent and written to an audit_log table.
7. Never invent API fields. Read the official docs for each API, confirm field names, and say so if unsure.
8. Never log secrets, tokens or coordinates.

DECISION POLICY (defaults, stored per plan so they can be changed)
- A person is "affected" if their live or predicted commute duration exceeds their personal max_minutes, OR it is at least 1.35 times the baseline (the prediction made the evening before for the same arrival time).
- Team recommendation is REMOTE if affected share is 40 percent or more of the attendees who have not skipped.
- If rain probability is 70 percent or more with meaningful rainfall in the commute window, add it as a reason and lower the share threshold to 30 percent.
- If someone is affected but the team threshold is not met, send only that person a private heads-up.
- Routes API cannot target an arrival time for driving. Compute departure_time = arrive_by minus a first-pass duration, then query again once.

DATA MODEL (tables)
workspaces, members, plans, plan_attendees, checks, decisions, google_tokens, audit_log.
checks has: plan_id, member_id, checked_at, provider_timestamp, duration_s, baseline_s, status (ok|unknown), provenance (live|simulated).

PLAIN ENGLISH
The owner of this project is a student who has not hand-coded much. At the end of every phase, explain in plain English what you built, how to run it, and how to check it works.
