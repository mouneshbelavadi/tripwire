/**
 * Comprehensive Security Test Suite for Tripwire Teams
 *
 * Verifies:
 * 1. Cross-workspace isolation (Workspace A cannot see Workspace B data)
 * 2. Log scrubber masks tokens (Slack, Google, OAuth), coordinates, and emails
 * 3. In-memory sliding window rate limiter blocks abuse
 * 4. Audit log records valid records with sanitized details
 * 5. Data retention maintenance job purges records older than 30 days
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  TenantIsolationError,
  assertTenantIsolation,
  scopeWhereClause,
  createTenantContext,
  createScopedDbClient,
  verifyQueryIsolation,
} from './workspaceIsolation.js';

import {
  scrubString,
  scrubObject,
  scrubLog,
  createScrubbedLogger,
  REDACTION_LABELS,
} from './logScrubber.js';

import {
  recordAudit,
  getAuditLogsForWorkspace,
  clearInMemoryAuditLog,
  getInMemoryAuditRecords,
  AuditAction,
} from './auditLog.js';

import {
  runRetentionJob,
  addInMemoryChecks,
  clearInMemoryChecks,
  getInMemoryChecks,
} from './retention.js';

import {
  SlidingWindowRateLimiter,
  RateLimitExceededError,
  checkSlashCommandRateLimit,
  assertSlashCommandNotRateLimited,
  resetSlashCommandRateLimits,
} from './rateLimiter.js';

describe('Security: Workspace Isolation', () => {
  const workspaceA = 'T_WORKSPACE_A';
  const workspaceB = 'T_WORKSPACE_B';

  it('allows access to records matching the expected workspace', () => {
    const records = [
      { id: 'rec_1', workspace_id: workspaceA, title: 'Office Plan 1' },
      { id: 'rec_2', workspace_id: workspaceA, title: 'Office Plan 2' },
    ];

    expect(() => assertTenantIsolation(records, workspaceA, 'plans')).not.toThrow();
  });

  it('throws TenantIsolationError when a record belongs to a foreign workspace', () => {
    const mixedRecords = [
      { id: 'rec_1', workspace_id: workspaceA, title: 'Office Plan 1' },
      { id: 'rec_2', workspace_id: workspaceB, title: 'Foreign Plan' },
    ];

    expect(() => assertTenantIsolation(mixedRecords, workspaceA, 'plans')).toThrow(
      TenantIsolationError
    );

    try {
      assertTenantIsolation(mixedRecords, workspaceA, 'plans');
    } catch (err) {
      expect(err).toBeInstanceOf(TenantIsolationError);
      const tenantErr = err as TenantIsolationError;
      expect(tenantErr.expectedWorkspaceId).toBe(workspaceA);
      expect(tenantErr.violatingWorkspaceId).toBe(workspaceB);
    }
  });

  it('detects foreign records nested in relation arrays', () => {
    const planWithNestedForeignMember = {
      id: 'plan_1',
      workspace_id: workspaceA,
      members: [
        { id: 'mem_1', workspace_id: workspaceA },
        { id: 'mem_2', workspace_id: workspaceB }, // Foreign member
      ],
    };

    expect(() =>
      assertTenantIsolation(planWithNestedForeignMember, workspaceA, 'plans')
    ).toThrow(TenantIsolationError);
  });

  it('enforces workspace_id in where clauses and rejects foreign overrides', () => {
    // Clean where clause
    const scoped = scopeWhereClause({ status: 'active' }, workspaceA);
    expect(scoped).toEqual({ status: 'active', workspace_id: workspaceA });

    // Attempting to query foreign workspace directly is blocked
    expect(() => scopeWhereClause({ workspace_id: workspaceB }, workspaceA)).toThrow(
      TenantIsolationError
    );
  });

  it('TenantContext enforces query scoping and result verification', async () => {
    const ctx = createTenantContext(workspaceA);

    // Mock query runner simulating a DB table
    const mockDb = [
      { id: '1', workspace_id: workspaceA, name: 'Team Alpha' },
      { id: '2', workspace_id: workspaceB, name: 'Team Beta' },
    ];

    const results = await ctx.executeScopedQuery(async (scopedWhere) => {
      expect(scopedWhere.workspace_id).toBe(workspaceA);
      return mockDb.filter((item) => item.workspace_id === scopedWhere.workspace_id);
    });

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Team Alpha');
  });

  it('createScopedDbClient intercepts queries and asserts tenant boundary', async () => {
    const rawClient = {
      plan: {
        async findMany(args: { where: Record<string, any> }) {
          // If query didn't filter, or filtered wrongly, returns matching rows
          const dbRows = [
            { id: 'p1', workspace_id: 'T_WORKSPACE_A', title: 'Plan A' },
            { id: 'p2', workspace_id: 'T_WORKSPACE_B', title: 'Plan B' },
          ];
          return dbRows.filter((r) => !args.where?.workspace_id || r.workspace_id === args.where.workspace_id);
        },
      },
    };

    const scopedClient = createScopedDbClient(rawClient, workspaceA);
    const results = await scopedClient.plan.findMany({ where: { status: 'active' } as any });

    expect(results).toHaveLength(1);
    expect(results[0].workspace_id).toBe(workspaceA);
  });

  it('verifyQueryIsolation asserts full tenant partition between two workspaces', async () => {
    const database = [
      { id: 'p1', workspace_id: workspaceA, title: 'Plan A1' },
      { id: 'p2', workspace_id: workspaceA, title: 'Plan A2' },
      { id: 'p3', workspace_id: workspaceB, title: 'Plan B1' },
    ];

    const queryExecutor = async (wsId: string) => {
      return database.filter((row) => row.workspace_id === wsId);
    };

    const isolationResult = await verifyQueryIsolation(queryExecutor, workspaceA, workspaceB);
    expect(isolationResult.isolated).toBe(true);
    expect(isolationResult.testRecordCount).toBe(2);
    expect(isolationResult.foreignRecordCount).toBe(1);
  });
});

describe('Security: Log Scrubber & Redaction', () => {
  it('strips Slack bot tokens, app tokens, and user tokens', () => {
    const rawMessage = 'Connected Slack with xoxb-mockbottoken-abcdef123456 and xapp-mockapptoken-xyz987654321';
    const scrubbed = scrubString(rawMessage);

    expect(scrubbed).not.toContain('xoxb-mockbottoken-abcdef123456');
    expect(scrubbed).not.toContain('xapp-mockapptoken-xyz987654321');
    expect(scrubbed).toContain(REDACTION_LABELS.SLACK_TOKEN);
  });

  it('strips Google API keys', () => {
    const rawMessage = 'Google Routes API request sent with key AIzaSyD-1234567890abcdefghijklmnopqrstuv';
    const scrubbed = scrubString(rawMessage);

    expect(scrubbed).not.toContain('AIzaSyD-1234567890abcdefghijklmnopqrstuv');
    expect(scrubbed).toContain(REDACTION_LABELS.GOOGLE_API_KEY);
  });

  it('strips Google OAuth tokens and Bearer headers', () => {
    const rawOAuth = 'Google token: ya29.a0AfH6SMDh1234567890abcdefghijklmnopqrstuvwxyz';
    const rawBearer = 'Authorization: Bearer secret-oauth-token-value-123';

    expect(scrubString(rawOAuth)).toContain(REDACTION_LABELS.OAUTH_TOKEN);
    expect(scrubString(rawOAuth)).not.toContain('ya29.a0AfH6SMDh');

    expect(scrubString(rawBearer)).toContain(REDACTION_LABELS.BEARER_TOKEN);
    expect(scrubString(rawBearer)).not.toContain('secret-oauth-token-value-123');
  });

  it('masks geographic coordinates (lat/lon)', () => {
    const rawCoords = 'Calculating commute from 12.971598, 77.594562 to destination';
    const scrubbed = scrubString(rawCoords);

    expect(scrubbed).not.toContain('12.971598');
    expect(scrubbed).not.toContain('77.594562');
    expect(scrubbed).toContain(REDACTION_LABELS.COORDINATES);

    const rawLabeled = 'Origin point lat: 12.9716, lng: 77.5946';
    const scrubbedLabeled = scrubString(rawLabeled);
    expect(scrubbedLabeled).toContain(REDACTION_LABELS.COORDINATE);
  });

  it('masks user email addresses', () => {
    const rawLog = 'Notified user at alice.developer@example.com regarding calendar change';
    const scrubbed = scrubString(rawLog);

    expect(scrubbed).not.toContain('alice.developer@example.com');
    expect(scrubbed).toContain(REDACTION_LABELS.EMAIL);
  });

  it('deeply scrubs nested objects, arrays, and error stacks', () => {
    const sensitivePayload = {
      workspaceId: 'T12345',
      user: {
        slackUserId: 'U98765',
        email: 'bob@company.org',
        bot_token: 'xoxb-mocknestedbot-secretbottoken',
        coords: {
          latitude: 12.9352,
          longitude: 77.6245,
        },
      },
      tags: ['commute', 'xoxp-mocknesteduser-secretuser'],
    };

    const sanitized = scrubObject(sensitivePayload);

    expect(sanitized.user.bot_token).toBe(REDACTION_LABELS.SECRET);
    expect(sanitized.user.email).toBe(REDACTION_LABELS.EMAIL);
    expect(sanitized.user.coords).toBe(REDACTION_LABELS.COORDINATE);
    expect(sanitized.tags[1]).toBe(REDACTION_LABELS.SLACK_TOKEN);
  });

  it('creates a scrubbed logger that sanitizes outputs before console', () => {
    const loggedMessages: string[] = [];
    const mockLogger = {
      info: (...args: any[]) => loggedMessages.push(args.join(' ')),
      warn: (...args: any[]) => loggedMessages.push(args.join(' ')),
      error: (...args: any[]) => loggedMessages.push(args.join(' ')),
      debug: (...args: any[]) => loggedMessages.push(args.join(' ')),
      log: (...args: any[]) => loggedMessages.push(args.join(' ')),
    };

    const logger = createScrubbedLogger(mockLogger);
    logger.info('User john@example.com updated key AIzaSyD-1234567890abcdefghijklmnopqrstuv');

    expect(loggedMessages[0]).not.toContain('john@example.com');
    expect(loggedMessages[0]).not.toContain('AIzaSyD-1234567890abcdefghijklmnopqrstuv');
    expect(loggedMessages[0]).toContain(REDACTION_LABELS.EMAIL);
    expect(loggedMessages[0]).toContain(REDACTION_LABELS.GOOGLE_API_KEY);
  });
});

describe('Security: Sliding Window Rate Limiter', () => {
  beforeEach(() => {
    resetSlashCommandRateLimits();
  });

  it('allows requests up to the maximum limit (10 per minute)', () => {
    const userId = 'U_TEST_USER_1';
    const now = 1000000;

    for (let i = 1; i <= 10; i++) {
      const res = checkSlashCommandRateLimit(userId);
      expect(res.allowed).toBe(true);
      expect(res.totalInWindow).toBe(i);
    }
  });

  it('blocks the 11th request within the 1-minute window', () => {
    const userId = 'U_TEST_USER_2';
    const limiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 10 });
    const startTime = 1000000;

    // Send 10 requests at startTime
    for (let i = 0; i < 10; i++) {
      const res = limiter.check(userId, startTime + i * 100);
      expect(res.allowed).toBe(true);
    }

    // 11th request at 30 seconds into the window
    const blockedRes = limiter.check(userId, startTime + 30_000);
    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.remaining).toBe(0);
    expect(blockedRes.retryAfterSeconds).toBeGreaterThan(0);

    // assertNotRateLimited throws RateLimitExceededError
    expect(() => limiter.assertNotRateLimited(userId, startTime + 30_000)).toThrow(
      RateLimitExceededError
    );
  });

  it('allows new requests once the sliding window advances past old requests', () => {
    const userId = 'U_TEST_USER_3';
    const limiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 5 });
    const startTime = 1000000;

    // Send 5 requests
    for (let i = 0; i < 5; i++) {
      limiter.check(userId, startTime);
    }

    // Immediately blocked
    expect(limiter.check(userId, startTime + 1000).allowed).toBe(false);

    // Fast-forward 61 seconds (past the 60s sliding window)
    const afterWindow = startTime + 61_000;
    const resAfter = limiter.check(userId, afterWindow);
    expect(resAfter.allowed).toBe(true);
    expect(resAfter.totalInWindow).toBe(1);
  });

  it('enforces isolation between different users', () => {
    const limiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 2 });
    const userA = 'USER_A';
    const userB = 'USER_B';

    // Max out User A
    limiter.check(userA);
    limiter.check(userA);
    expect(limiter.check(userA).allowed).toBe(false);

    // User B should still be allowed
    expect(limiter.check(userB).allowed).toBe(true);
  });
});

describe('Security: Immutable Audit Logging', () => {
  const workspaceId = 'T_AUDIT_WS';

  beforeEach(() => {
    clearInMemoryAuditLog();
  });

  it('records calendar updates, decision clicks, and data deletions', async () => {
    // 1. Calendar update
    const calRecord = await recordAudit(
      workspaceId,
      AuditAction.CALENDAR_UPDATE,
      'U_LEAD_1',
      'calendar_event:cal_evt_101',
      { action: 'convert_to_remote', meetUrl: 'https://meet.google.com/abc-defg-hij' }
    );
    expect(calRecord.action_type).toBe(AuditAction.CALENDAR_UPDATE);
    expect(calRecord.target_entity).toBe('calendar_event:cal_evt_101');

    // 2. Decision click
    const decisionRecord = await recordAudit(
      workspaceId,
      AuditAction.DECISION_CLICK,
      'U_LEAD_1',
      'plan:plan_202',
      { decision: 'REMOTE', affectedRatio: 0.57 }
    );
    expect(decisionRecord.action_type).toBe(AuditAction.DECISION_CLICK);

    // 3. Data deletion (/tripwire forget)
    const deletionRecord = await recordAudit(
      workspaceId,
      AuditAction.DATA_DELETION,
      'U_MEMBER_9',
      'member:U_MEMBER_9',
      { reason: 'user_forget_request' }
    );
    expect(deletionRecord.action_type).toBe(AuditAction.DATA_DELETION);

    // Verify all 3 records were recorded in order
    const logs = await getAuditLogsForWorkspace(workspaceId);
    expect(logs).toHaveLength(3);
  });

  it('sanitizes sensitive details automatically before writing audit record', async () => {
    const record = await recordAudit(
      workspaceId,
      AuditAction.PLAN_CREATE,
      'U_LEAD_1',
      'plan:plan_303',
      {
        lead_email: 'lead@company.com',
        slack_token: 'xoxb-12345-secret',
        origin_lat: 12.9716,
        origin_lon: 77.5946,
      }
    );

    expect(record.details.lead_email).toBe(REDACTION_LABELS.EMAIL);
    expect(record.details.slack_token).toBe(REDACTION_LABELS.SECRET);
    expect(record.details.origin_lat).toBe(REDACTION_LABELS.COORDINATE);
    expect(record.details.origin_lon).toBe(REDACTION_LABELS.COORDINATE);
  });

  it('asserts tenant boundaries on audit log queries', async () => {
    await recordAudit('T_ANOTHER_WS', AuditAction.SLACK_POST, 'U_OTHER', 'channel:C1', {});

    // Querying for workspaceId should return only workspaceId records
    const logs = await getAuditLogsForWorkspace(workspaceId);
    expect(logs.every((l) => l.workspace_id === workspaceId)).toBe(true);
  });
});

describe('Security: Data Retention Maintenance Job', () => {
  beforeEach(() => {
    clearInMemoryChecks();
  });

  it('deletes checks older than 30 days and preserves recent checks', async () => {
    const now = new Date('2026-11-21T12:00:00Z');
    const dayMs = 24 * 60 * 60 * 1000;

    const oldCheck1 = {
      id: 'chk_old_1',
      plan_id: 'plan_1',
      member_id: 'mem_1',
      checked_at: new Date(now.getTime() - 40 * dayMs), // 40 days old -> DELETE
      duration_s: 1800,
      status: 'ok' as const,
      provenance: 'live' as const,
    };

    const oldCheck2 = {
      id: 'chk_old_2',
      plan_id: 'plan_1',
      member_id: 'mem_2',
      checked_at: new Date(now.getTime() - 31 * dayMs), // 31 days old -> DELETE
      duration_s: 2400,
      status: 'ok' as const,
      provenance: 'live' as const,
    };

    const recentCheck = {
      id: 'chk_recent_1',
      plan_id: 'plan_1',
      member_id: 'mem_1',
      checked_at: new Date(now.getTime() - 10 * dayMs), // 10 days old -> KEEP
      duration_s: 1500,
      status: 'ok' as const,
      provenance: 'live' as const,
    };

    const freshCheck = {
      id: 'chk_fresh_1',
      plan_id: 'plan_1',
      member_id: 'mem_2',
      checked_at: new Date(now.getTime() - 1 * dayMs), // 1 day old -> KEEP
      duration_s: 1600,
      status: 'ok' as const,
      provenance: 'live' as const,
    };

    addInMemoryChecks([oldCheck1, oldCheck2, recentCheck, freshCheck]);
    expect(getInMemoryChecks()).toHaveLength(4);

    // Run retention maintenance job
    const result = await runRetentionJob({
      now,
      retentionDays: 30,
    });

    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(2);

    const remaining = getInMemoryChecks();
    expect(remaining).toHaveLength(2);
    expect(remaining.map((c) => c.id)).toEqual(['chk_recent_1', 'chk_fresh_1']);
  });

  it('supports dryRun mode without deleting records', async () => {
    const now = new Date('2026-11-21T12:00:00Z');
    const dayMs = 24 * 60 * 60 * 1000;

    addInMemoryChecks([
      {
        id: 'chk_stale',
        plan_id: 'plan_1',
        member_id: 'mem_1',
        checked_at: new Date(now.getTime() - 45 * dayMs),
        duration_s: 2000,
        status: 'ok',
        provenance: 'live',
      },
    ]);

    const result = await runRetentionJob({ now, dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.deletedCount).toBe(1);
    expect(getInMemoryChecks()).toHaveLength(1); // Not deleted due to dry run
  });
});
