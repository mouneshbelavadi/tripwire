# Security Architecture & Compliance Overview

*Last updated: November 2026*

This document provides a transparent, plain-English overview of the security architecture, data protections, and isolation mechanisms implemented in **Tripwire Teams**.

---

## 1. Core Security Principles

Tripwire Teams is built around defense-in-depth and strict data minimization:
1. **Never Log Secrets or Coordinates**: API keys, bot tokens, OAuth tokens, personal emails, and coordinates are programmatically scrubbed before any log is written.
2. **Absolute Multi-Tenant Isolation**: Every database interaction is scoped to an authenticated workspace tenant. No workspace can ever inspect or alter data belonging to another workspace.
3. **Cryptographic Protection at Rest**: Sensitive fields are encrypted using authenticated industry-standard ciphers.
4. **Idempotence & Auditability**: Every external action (modifying Google Calendar, posting into Slack, deleting user data) creates an immutable audit log record.

---

## 2. Data Encryption at Rest (AES-256-GCM)

All sensitive data stored in the database is protected with authenticated encryption:
- **Algorithm**: **AES-256-GCM** (Galois/Counter Mode), providing both confidentiality and cryptographic integrity verification.
- **Protected Fields**: Coarse home coordinates, Google OAuth access tokens, Google refresh tokens, and Slack bot tokens.
- **Key Management**: Primary encryption keys are passed via secure environment variables (`ENCRYPTION_KEY`), rotated according to operational runbooks, and never committed to source control.
- **Data in Transit**: All communications between Slack, the application server, Google APIs (Routes, Geocoding, Calendar), and PostgreSQL are encrypted over **TLS 1.3 / HTTPS**.

---

## 3. Strict Workspace Tenant Isolation

Tripwire Teams serves multiple Slack workspaces from a shared database architecture while enforcing rigid tenant boundaries:
- **Tenant Scoping**: All database tables (`workspaces`, `members`, `plans`, `plan_attendees`, `checks`, `decisions`, `google_tokens`, `audit_log`) are partitioned by `workspace_id`.
- **Query Interception**: Database query wrappers (`workspaceIsolation.ts`) automatically inject and enforce `workspace_id` parameters into every `WHERE` clause.
- **Foreign Access Rejection**: If an application query or API request specifies a foreign workspace identifier, the system immediately aborts with a `TenantIsolationError` before the database responds.
- **Post-Query Assertions**: Verification assertions inspect returned rows to verify that zero foreign records leak across tenant boundaries.

---

## 4. Automated Log Scrubber & Redaction

Under **Rule 8 ("Never log secrets, tokens or coordinates")**, all logging output passes through an automated log scrubber (`logScrubber.ts`):
- **Slack Tokens**: Strips bot tokens (`xoxb-`), app tokens (`xapp-`), user tokens (`xoxp-`), and refresh tokens (`xoxr-`).
- **Google Credentials**: Strips Google API keys (`AIza...`) and OAuth access tokens (`ya29...`).
- **Authorization Headers**: Strips HTTP Bearer tokens and generic JWT strings.
- **Geographic Coordinates**: Masks latitude/longitude pairs (e.g. `12.9716, 77.5946` becomes `[COORDINATES_REDACTED]`).
- **Personal Emails**: Redacts user email addresses to prevent PII exposure in log monitoring tools.

---

## 5. Slash Command Rate Limiting

To protect backend resources and prevent abuse of Slack slash commands (e.g., rapid-fire `/tripwire setup` or `/tripwire skip` spam):
- An in-memory **sliding window rate limiter** tracks commands per user.
- **Limit**: Up to **10 commands per minute** per user.
- Any request exceeding this threshold is rejected with an informative `RateLimitExceededError` detailing the required wait time before retrying.
- Expired timestamps are garbage-collected automatically to prevent memory leaks.

---

## 6. Immutable Audit Logging

All privileged or state-changing actions are recorded to the `audit_log` table:
- **Tracked Actions**:
  - Google Calendar event updates (`CALENDAR_UPDATE`)
  - Team lead remote/office decisions (`DECISION_CLICK`)
  - User personal data deletions via `/tripwire forget` (`MEMBER_FORGET`)
  - Data retention maintenance purges (`RETENTION_PURGE`)
  - Slack notification broadcasts (`SLACK_POST`)
- **Audit Record Schema**: Includes timestamp, workspace identifier, action type, actor Slack user ID, target entity, and sanitized metadata.

---

## 7. Honest Enterprise Gap Analysis ("What is NOT Yet Done")

While Tripwire Teams implements rigorous foundational security, we believe in radical transparency regarding enterprise capabilities that are **not yet built**:

| Capability | Current State | Enterprise Roadmap |
| :--- | :--- | :--- |
| **Enterprise SSO / SAML** | Relies exclusively on Slack OAuth & Google OAuth for workspace authentication. | Dedicated SAML 2.0 / Okta / Azure AD integration for administrative controls is not yet supported. |
| **SOC-2 Type II Certification** | Built following SOC-2 principles (access control, audit trails, encryption, retention). | We have not yet undergone formal third-party SOC-2 Type II certification. |
| **Custom Data Residency** | Data is hosted in a single primary PostgreSQL region. | Region-specific data pinning (e.g., EU-only or US-only database residency) is not currently available. |
| **Customer-Managed Encryption Keys (BYOK)** | Encryption keys are managed securely in environment configuration. | Bring-Your-Own-Key via AWS KMS, GCP KMS, or HashiCorp Vault is planned for future enterprise tiers. |
| **Granular Role-Based Access Control (RBAC)** | Roles are currently binary: Plan Owner (decision maker) and Attendees. | Custom administrative roles (e.g., Compliance Officer, Read-Only Auditor) are not yet configurable. |

---

## 8. Reporting Security Vulnerabilities

We welcome responsible security disclosures. If you discover a potential vulnerability, please report it directly to your organization's security administrator or email our security team with reproduction steps. We will acknowledge receipt within 24 hours and provide an estimated remediation timeline.
