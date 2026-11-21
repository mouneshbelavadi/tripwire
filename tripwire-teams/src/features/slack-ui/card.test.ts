import { describe, it, expect, vi } from 'vitest';
import {
  buildRecommendRemoteCard,
  buildCannotAssessCard,
  buildRatifiedDecisionCard,
  SIMULATED_BANNER_TEXT,
  RECOMMEND_REMOTE_HEADER,
} from './decisionCard.js';
import {
  handleDecisionClick,
  DecisionHandlerDependencies,
  PlanRecord,
  DecisionRecord,
} from './buttonHandlers.js';
import {
  buildHeadsUpDm,
  buildHeadsUpDmText,
  sendPersonalHeadsUpDm,
  sendPrivateHeadsUpDms,
} from './dmHeadsUp.js';

describe('Slack Block Kit Decision Cards', () => {
  describe('buildRecommendRemoteCard', () => {
    const mockParams = {
      planId: 'plan-xyz-123',
      affectedCount: 4,
      totalEligibleCount: 7,
      reasons: [
        'Outer Ring Road transit corridor is exceeding baseline by +45% (3 teammates affected)',
        '75% heavy rain predicted during 08:00 - 09:30 morning commute window',
      ],
      checkedAt: '08:15 AM',
      isSimulated: false,
    };

    it('contains the required header, bold headline, aggregate reasons, and timestamp metadata', () => {
      const card = buildRecommendRemoteCard(mockParams);

      // Verify Header block
      const headerBlock = card.blocks.find((b) => b.type === 'header');
      expect(headerBlock).toBeDefined();
      expect(headerBlock?.text?.text).toBe(RECOMMEND_REMOTE_HEADER);

      // Verify Bold headline: "4 of 7 teammates are likely to face very long commutes tomorrow"
      const headlineBlock = card.blocks.find(
        (b) =>
          b.type === 'section' &&
          b.text?.text.includes('*4 of 7 teammates are likely to face very long commutes tomorrow*')
      );
      expect(headlineBlock).toBeDefined();

      // Verify aggregate reasons in plain English
      const reasonsBlock = card.blocks.find(
        (b) =>
          b.type === 'section' &&
          b.text?.text.includes('Outer Ring Road transit corridor is exceeding baseline')
      );
      expect(reasonsBlock).toBeDefined();
      expect(reasonsBlock?.text?.text).toContain('• Outer Ring Road transit corridor is exceeding baseline by +45% (3 teammates affected)');
      expect(reasonsBlock?.text?.text).toContain('• 75% heavy rain predicted during 08:00 - 09:30 morning commute window');

      // Verify timestamp metadata: "Checked live at 08:15 AM. Two consecutive fresh checks verified."
      const contextBlock = card.blocks.find((b) => b.type === 'context');
      expect(contextBlock).toBeDefined();
      expect(contextBlock?.elements?.[0].text).toContain('Checked live at 08:15 AM. Two consecutive fresh checks verified.');

      // In live mode, no simulated banner should exist
      const simulatedBanner = card.blocks.find(
        (b) => b.type === 'section' && b.text?.text.includes(SIMULATED_BANNER_TEXT)
      );
      expect(simulatedBanner).toBeUndefined();
    });

    it('contains all 3 interactive action buttons with correct styles and action_ids', () => {
      const card = buildRecommendRemoteCard(mockParams);

      const actionsBlock = card.blocks.find((b) => b.type === 'actions' && b.block_id === 'tripwire_decision_actions');
      expect(actionsBlock).toBeDefined();
      const elements = actionsBlock?.elements as any[];
      expect(elements).toHaveLength(3);

      // 1. "Make it remote" (primary style / green)
      const remoteBtn = elements.find((e) => e.action_id === 'decision_make_remote');
      expect(remoteBtn).toBeDefined();
      expect(remoteBtn.text.text).toBe('Make it remote');
      expect(remoteBtn.style).toBe('primary');
      expect(remoteBtn.value).toBe(mockParams.planId);

      // 2. "Keep in office" (danger style / red)
      const officeBtn = elements.find((e) => e.action_id === 'decision_keep_office');
      expect(officeBtn).toBeDefined();
      expect(officeBtn.text.text).toBe('Keep in office');
      expect(officeBtn.style).toBe('danger');
      expect(officeBtn.value).toBe(mockParams.planId);

      // 3. "Let individuals decide" (default style)
      const individualBtn = elements.find((e) => e.action_id === 'decision_individual');
      expect(individualBtn).toBeDefined();
      expect(individualBtn.text.text).toBe('Let individuals decide');
      expect(individualBtn.style).toBeUndefined();
      expect(individualBtn.value).toBe(mockParams.planId);
    });

    it('prepends prominent bold banner 🚨 [SIMULATED TEST DATA - FOR DEMO ONLY] when isSimulated is true', () => {
      const simulatedCard = buildRecommendRemoteCard({
        ...mockParams,
        isSimulated: true,
      });

      // The first block should be the prominent simulated banner
      const firstBlock = simulatedCard.blocks[0];
      expect(firstBlock.type).toBe('section');
      expect(firstBlock.text?.text).toBe(`*${SIMULATED_BANNER_TEXT}*`);
      expect(simulatedCard.text).toContain('[SIMULATED]');
    });

    it('prepends prominent bold banner when demoMode is true', () => {
      const demoCard = buildRecommendRemoteCard({
        ...mockParams,
        demoMode: true,
      });

      const bannerBlock = demoCard.blocks.find(
        (b) => b.text?.text === `*${SIMULATED_BANNER_TEXT}*`
      );
      expect(bannerBlock).toBeDefined();
    });
  });

  describe('buildCannotAssessCard', () => {
    it('builds an honest notification explaining >30% unknown readings and advises manual decision', () => {
      const card = buildCannotAssessCard({
        checkedAt: '08:20 AM',
        unknownPercent: 35,
      });

      const headerBlock = card.blocks.find((b) => b.type === 'header');
      expect(headerBlock?.text?.text).toBe('⚠️ Commute Status: Cannot Assess');

      const bodyBlock = card.blocks.find((b) => b.type === 'section');
      expect(bodyBlock?.text?.text).toContain('35%');
      expect(bodyBlock?.text?.text).toContain('Team lead, please evaluate local conditions and decide manually');

      const contextBlock = card.blocks.find((b) => b.type === 'context');
      expect(contextBlock?.elements?.[0].text).toContain('Checked at 08:20 AM');
    });

    it('prepends simulated banner when simulated', () => {
      const card = buildCannotAssessCard({ isSimulated: true });
      expect(card.blocks[0].text?.text).toBe(`*${SIMULATED_BANNER_TEXT}*`);
    });
  });

  describe('buildRatifiedDecisionCard', () => {
    it('formats exact ratification string: Decision Ratified by @{owner}: *{decision}* at {time}', () => {
      const ratifiedCard = buildRatifiedDecisionCard({
        planId: 'plan-123',
        ownerSlackUserId: 'U12345',
        ownerName: 'lead_alex',
        decision: 'REMOTE',
        ratifiedAt: '08:30 AM',
      });

      const sectionBlock = ratifiedCard.blocks.find((b) => b.type === 'section');
      expect(sectionBlock?.text?.text).toContain('Decision Ratified by @lead_alex: *REMOTE* at 08:30 AM');
      expect(ratifiedCard.text).toBe('Decision Ratified by @lead_alex: *REMOTE* at 08:30 AM');
    });
  });
});

describe('Slack Button Handlers & Single Decision Maker Invariant', () => {
  const mockPlan: PlanRecord = {
    id: 'plan-100',
    workspaceId: 'workspace-1',
    channelId: 'C100',
    ownerSlackUserId: 'U_OWNER_LEAD',
    ownerName: 'alex_lead',
    isSimulated: false,
  };

  function createMockDeps(overrides: Partial<DecisionHandlerDependencies> = {}): {
    deps: DecisionHandlerDependencies;
    createdDecisions: any[];
    calendarDispatched: string[];
    ephemeralMessages: any[];
    updatedMessages: any[];
    auditLogs: any[];
  } {
    const createdDecisions: any[] = [];
    const calendarDispatched: string[] = [];
    const ephemeralMessages: any[] = [];
    const updatedMessages: any[] = [];
    const auditLogs: any[] = [];

    const deps: DecisionHandlerDependencies = {
      findPlanById: vi.fn(async (id: string) => (id === mockPlan.id ? mockPlan : null)),
      findDecisionByPlanId: vi.fn(async (_id: string) => null),
      createDecision: vi.fn(async (data: any) => {
        const record: DecisionRecord = {
          id: `dec-${Date.now()}`,
          ...data,
        };
        createdDecisions.push(record);
        return record;
      }),
      dispatchCalendarUpdate: vi.fn(async (planId: string) => {
        calendarDispatched.push(planId);
      }),
      updateMessage: vi.fn(async (params: any) => {
        updatedMessages.push(params);
      }),
      sendEphemeralResponse: vi.fn(async (params: any) => {
        ephemeralMessages.push(params);
      }),
      recordAudit: vi.fn(async (params: any) => {
        auditLogs.push(params);
      }),
      ...overrides,
    };

    return {
      deps,
      createdDecisions,
      calendarDispatched,
      ephemeralMessages,
      updatedMessages,
      auditLogs,
    };
  }

  it('rejects click from non-owner and sends ephemeral message: Only the plan owner ({ownerName}) can make the team office decision.', async () => {
    const { deps, ephemeralMessages, createdDecisions, calendarDispatched } = createMockDeps();

    const result = await handleDecisionClick(
      {
        actionId: 'decision_make_remote',
        userId: 'U_OTHER_MEMBER', // Not the owner
        planId: 'plan-100',
        channelId: 'C100',
      },
      deps
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe('UNAUTHORIZED');
    expect(result.message).toBe('Only the plan owner (alex_lead) can make the team office decision.');

    // Ephemeral message was sent to the unauthorized user
    expect(ephemeralMessages).toHaveLength(1);
    expect(ephemeralMessages[0].userId).toBe('U_OTHER_MEMBER');
    expect(ephemeralMessages[0].text).toBe('Only the plan owner (alex_lead) can make the team office decision.');

    // Invariant: no decision recorded, no calendar changed
    expect(createdDecisions).toHaveLength(0);
    expect(calendarDispatched).toHaveLength(0);
  });

  it('rejects non-owner click using slack user ID when ownerName is not populated', async () => {
    const { deps, ephemeralMessages } = createMockDeps({
      findPlanById: vi.fn(async () => ({
        id: 'plan-100',
        workspaceId: 'workspace-1',
        ownerSlackUserId: 'U_OWNER_LEAD',
      })),
    });

    const result = await handleDecisionClick(
      {
        actionId: 'decision_make_remote',
        userId: 'U_OTHER_MEMBER',
        planId: 'plan-100',
      },
      deps
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('Only the plan owner (U_OWNER_LEAD) can make the team office decision.');
    expect(ephemeralMessages[0].text).toBe('Only the plan owner (U_OWNER_LEAD) can make the team office decision.');
  });

  it('handles idempotency: acknowledges without double-processing if decision already exists', async () => {
    const existing: DecisionRecord = {
      id: 'dec-existing',
      planId: 'plan-100',
      decidedBySlackUserId: 'U_OWNER_LEAD',
      decision: 'REMOTE',
      reasonSummary: 'Previously ratified',
      decidedAt: new Date(),
    };

    const { deps, createdDecisions, calendarDispatched, updatedMessages } = createMockDeps({
      findDecisionByPlanId: vi.fn(async () => existing),
    });

    const result = await handleDecisionClick(
      {
        actionId: 'decision_make_remote',
        userId: 'U_OWNER_LEAD', // Owner clicks again
        planId: 'plan-100',
      },
      deps
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe('ALREADY_RECORDED');
    expect(result.decision).toBe('REMOTE');

    // Invariant: no second row created, no calendar double-dispatched, no message rewrite
    expect(createdDecisions).toHaveLength(0);
    expect(calendarDispatched).toHaveLength(0);
    expect(updatedMessages).toHaveLength(0);
  });

  it('records decision, updates message in-place, and dispatches calendar update for REMOTE', async () => {
    const { deps, createdDecisions, calendarDispatched, updatedMessages, auditLogs } = createMockDeps();

    const result = await handleDecisionClick(
      {
        actionId: 'decision_make_remote',
        userId: 'U_OWNER_LEAD',
        planId: 'plan-100',
        channelId: 'C100',
        messageTs: '1700000000.000100',
      },
      deps
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe('RATIFIED');
    expect(result.decision).toBe('REMOTE');

    // 1. Database row recorded
    expect(createdDecisions).toHaveLength(1);
    expect(createdDecisions[0].planId).toBe('plan-100');
    expect(createdDecisions[0].decidedBySlackUserId).toBe('U_OWNER_LEAD');
    expect(createdDecisions[0].decision).toBe('REMOTE');

    // 2. In-place message updated (buttons removed, ratification text present)
    expect(updatedMessages).toHaveLength(1);
    expect(updatedMessages[0].text).toContain('Decision Ratified by @alex_lead: *REMOTE*');
    const updateBlocks = updatedMessages[0].blocks;
    const actionsBlock = updateBlocks.find((b: any) => b.type === 'actions');
    expect(actionsBlock).toBeUndefined(); // buttons removed

    // 3. Calendar update dispatched because decision is REMOTE
    expect(calendarDispatched).toHaveLength(1);
    expect(calendarDispatched[0]).toBe('plan-100');

    // 4. Audit logged
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].actionType).toBe('DECISION_CLICK');
  });

  it('records OFFICE decision, updates message in-place, but does NOT dispatch calendar update', async () => {
    const { deps, createdDecisions, calendarDispatched, updatedMessages } = createMockDeps();

    const result = await handleDecisionClick(
      {
        actionId: 'decision_keep_office',
        userId: 'U_OWNER_LEAD',
        planId: 'plan-100',
      },
      deps
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe('RATIFIED');
    expect(result.decision).toBe('OFFICE');

    expect(createdDecisions).toHaveLength(1);
    expect(createdDecisions[0].decision).toBe('OFFICE');
    expect(calendarDispatched).toHaveLength(0); // No calendar patch needed
    expect(updatedMessages).toHaveLength(1);
    expect(updatedMessages[0].text).toContain('Decision Ratified by @alex_lead: *OFFICE*');
  });

  it('records INDIVIDUAL decision, updates message in-place, and does NOT dispatch calendar update', async () => {
    const { deps, createdDecisions, calendarDispatched, updatedMessages } = createMockDeps();

    const result = await handleDecisionClick(
      {
        actionId: 'decision_individual',
        userId: 'U_OWNER_LEAD',
        planId: 'plan-100',
      },
      deps
    );

    expect(result.success).toBe(true);
    expect(result.decision).toBe('INDIVIDUAL');
    expect(createdDecisions).toHaveLength(1);
    expect(calendarDispatched).toHaveLength(0);
    expect(updatedMessages[0].text).toContain('Decision Ratified by @alex_lead: *INDIVIDUAL*');
  });
});

describe('Private Heads-Up Direct Message (DM)', () => {
  it('builds exact heads-up message text adhering to policy', () => {
    const text = buildHeadsUpDmText(55, 40);
    const expected =
      'Heads up: Your personal commute to the office tomorrow is currently estimated at 55m (exceeding your preferred 40m limit). The team office day remains on, but you may want to coordinate with your lead or use `/tripwire skip` if needed.';
    expect(text).toBe(expected);
  });

  it('builds Block Kit message with simulated banner if isSimulated is true', () => {
    const liveDm = buildHeadsUpDm({ durationMinutes: 60, limitMinutes: 45, isSimulated: false });
    expect(liveDm.text).not.toContain('[SIMULATED]');
    const liveSimBanner = liveDm.blocks.find((b) => b.text?.text === `*${SIMULATED_BANNER_TEXT}*`);
    expect(liveSimBanner).toBeUndefined();

    const simDm = buildHeadsUpDm({ durationMinutes: 60, limitMinutes: 45, isSimulated: true });
    expect(simDm.text).toContain('[SIMULATED]');
    const simBanner = simDm.blocks.find((b) => b.text?.text === `*${SIMULATED_BANNER_TEXT}*`);
    expect(simBanner).toBeDefined();
  });

  it('sends private DM via Slack conversations.open and chat.postMessage', async () => {
    const mockSlackClient = {
      conversations: {
        open: vi.fn(async () => ({ channel: { id: 'D_CHANNEL_MEMBER_1' } })),
      },
      chat: {
        postMessage: vi.fn(async () => ({ ok: true })),
      },
    };

    const res = await sendPersonalHeadsUpDm(mockSlackClient, {
      slackUserId: 'U_MEMBER_1',
      durationMinutes: 52,
      limitMinutes: 35,
    });

    expect(res.success).toBe(true);
    expect(res.channelId).toBe('D_CHANNEL_MEMBER_1');
    expect(mockSlackClient.conversations.open).toHaveBeenCalledWith({ users: 'U_MEMBER_1' });
    expect(mockSlackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'D_CHANNEL_MEMBER_1',
        text: expect.stringContaining('52m (exceeding your preferred 35m limit)'),
      })
    );
  });

  it('sends multiple heads-up DMs in batch', async () => {
    const postedTo: string[] = [];
    const mockSlackClient = {
      conversations: {
        open: vi.fn(async ({ users }: any) => ({ channel: { id: `D_${users}` } })),
      },
      chat: {
        postMessage: vi.fn(async ({ channel }: any) => {
          postedTo.push(channel);
          return { ok: true };
        }),
      },
    };

    const results = await sendPrivateHeadsUpDms(mockSlackClient, [
      { slackUserId: 'U1', durationMinutes: 50, limitMinutes: 30 },
      { slackUserId: 'U2', durationMinutes: 65, limitMinutes: 45 },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    expect(postedTo).toEqual(['D_U1', 'D_U2']);
  });
});
