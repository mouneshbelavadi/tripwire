# Privacy Policy for Tripwire Teams

*Last updated: November 2026*

Tripwire Teams is designed from the ground up around **Privacy by Design**. We believe you should never have to surrender your personal privacy, live whereabouts, or home address just to coordinate hybrid work with your team.

This document explains in clear, plain English what data we collect, why we need it, who has access to it, and how you have complete control over it.

---

## 1. What Data We Collect

When you choose to opt in using `/tripwire setup`, we collect only the minimum information necessary to calculate whether your commute will be unusually difficult on an office day:

1. **Approximate Home Area (Rounded to ~1 km)**:
   - We do **NOT** collect your exact home address, apartment number, or building name.
   - Any location you provide is converted into geographic coordinates and immediately **rounded to 2 decimal places** (approximately a 1-kilometer radius, roughly the size of a whole neighborhood).
   - This coarse coordinate is stored using **AES-256-GCM encryption at rest**.
2. **Travel Mode**:
   - Your preferred way of getting to work (such as driving or transit).
3. **Personal Commute Threshold**:
   - The maximum minutes you are comfortable commuting (for example, "45 minutes") before a trip feels unreasonable.
4. **Slack Identifier & Email Address**:
   - Your Slack User ID (e.g., `U12345678`) and workspace identifier.
   - Your email address, used solely to identify your participation on the team's Google Calendar event.
5. **Commute Checks**:
   - Automated travel time calculations retrieved from Google Routes API before scheduled decision times.

### What We NEVER Collect
- **NO real-time GPS tracking**: We do not run on your mobile device, track your speed, or monitor your live location.
- **NO movement history**: We do not track where you go on weekends, evenings, or working hours.
- **NO personal calendar details**: We only inspect or modify the specific office event linked to the plan.

---

## 2. Why We Collect It

We collect this data for a single purpose: **to estimate commute times before anyone leaves home**, so your team lead can decide whether to switch an in-person office day to remote when severe traffic, disruptions, or heavy rain make traveling miserable.

By using an approximate 1 km neighborhood center rather than your doorstep, Google Routes API produces a commute estimate that is virtually identical to your actual trip, without anyone ever storing where your front door is.

---

## 3. Who Can See Your Data

- **The Automated System Only**:
  - Individual coordinates and travel preferences are processed exclusively by our automated backend worker.
- **The Team Lead Sees AGGREGATES ONLY**:
  - The team lead who creates the plan and makes the decision **cannot see your home area, coordinates, or individual travel times**.
  - In channel notifications, the lead sees only high-level summary metrics, such as:
    > *"4 of 7 attendees affected by severe traffic delays (commutes 35%+ above baseline)."*
  - Individual names and locations are hidden by default.
- **Your Teammates**:
  - Teammates cannot see your setup details, home neighborhood, or whether you personally were flagged.
- **Third Parties**:
  - We do not sell, rent, or share personal data with advertisers or data brokers.
  - Origin coordinates (rounded to 1 km) and destination office coordinates are sent via secure HTTPS to the Google Routes API solely to calculate route durations.

---

## 4. How to Delete Your Data (`/tripwire forget`)

You have unconditional control over your data at all times:

1. **Immediate Personal Deletion**:
   - Type `/tripwire forget` in Slack at any time.
   - This immediately and permanently deletes your member record, approximate home location, commute threshold, travel mode, and attendee associations from our database.
2. **Skipping a Day**:
   - If you are on leave, sick, or working from home on a specific day, type `/tripwire skip`. You will be excluded from that day's checks without deleting your profile.
3. **Workspace Uninstallation**:
   - If your workspace administrator uninstalls the Tripwire Teams Slack app, or if Slack tokens are revoked (`tokens_revoked`), all database records for that workspace (plans, checks, attendee records, and tokens) are purged completely.

---

## 5. Data Retention Policy

We keep data only as long as strictly necessary:

| Data Type | Retention Period | Deletion Mechanism |
| :--- | :--- | :--- |
| **Commute Duration Checks** | **30 days** | Automated daily retention cleanup job permanently deletes records older than 30 days (`DELETE FROM checks WHERE checked_at < NOW() - INTERVAL '30 days'`). |
| **Member Profiles** | Until deleted by user | Deleted immediately upon `/tripwire forget` or workspace uninstall. |
| **Audit Logs** | 90 days | Kept for security and compliance audits; sanitized of all coordinates, emails, and credentials. |
| **Google OAuth Tokens** | Until disconnected | Disconnected immediately upon lead request or workspace uninstall. |

---

## 6. Questions and Privacy Inquiries

If you have questions about Tripwire Teams' privacy practices, or if you would like to request an audit of your data, contact your workspace administrator or reach out through your organization's internal support channels.
