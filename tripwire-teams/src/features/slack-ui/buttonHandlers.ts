/**
 * Slack Interactive Button Handlers for Tripwire Teams
 *
 * Handles:
 * - `decision_make_remote`
 * - `decision_keep_office`
 * - `decision_individual`
 *
 * Enforces:
 * 1. Single Decision Maker Invariant (Rule 5):
 *    Only plan.ownerSlackUserId can click. Others receive ephemeral:
 *    "Only the plan owner ({ownerName}) can make the team office decision."
 * 2. Idempotency Guard (Rule 6):
 *    If decision already exists for this plan, acknowledge without double-processing.
 * 3. Ratification & Notification:
 *    - Record row in `decisions` table
 *    - In-place channel message update: "Decision Ratified by @{owner}: *{decision}* at {time}"
 *    - If decision is REMOTE, dispatch calendar update handler
 *    - Log event to audit_log table
 */

import { buildRatifiedDecisionCard } from './decisionCard.js';

export type DecisionType = 'REMOTE' | 'OFFICE' | 'INDIVIDUAL';

export interface PlanRecord {
  id: string;
  workspaceId: string;
  channelId?: string;
  ownerSlackUserId: string;
  ownerName?: string;
  isSimulated?: boolean;
}

export interface DecisionRecord {
  id: string;
  planId: string;
  decidedBySlackUserId: string;
  decision: DecisionType | string;
  reasonSummary: string;
  decidedAt: Date;
}

export interface DecisionHandlerDependencies {
  findPlanById: (planId: string) => Promise<PlanRecord | null>;
  findDecisionByPlanId: (planId: string) => Promise<DecisionRecord | null>;
  createDecision: (data: {
    planId: string;
    decidedBySlackUserId: string;
    decision: DecisionType;
    reasonSummary: string;
    decidedAt: Date;
  }) => Promise<DecisionRecord>;
  dispatchCalendarUpdate?: (planId: string) => Promise<void>;
  updateMessage?: (params: {
    channelId?: string;
    messageTs?: string;
    responseUrl?: string;
    text: string;
    blocks: any[];
  }) => Promise<void>;
  sendEphemeralResponse?: (params: {
    channelId?: string;
    userId: string;
    text: string;
  }) => Promise<void>;
  recordAudit?: (params: {
    workspaceId: string;
    actionType: string;
    actorSlackUserId: string;
    targetEntity: string;
    details: Record<string, any>;
  }) => Promise<void>;
}

export interface DecisionActionClickInput {
  actionId: string;
  userId: string;
  planId: string;
  channelId?: string;
  messageTs?: string;
  responseUrl?: string;
}

export interface DecisionActionClickResult {
  success: boolean;
  status: 'RATIFIED' | 'ALREADY_RECORDED' | 'UNAUTHORIZED' | 'PLAN_NOT_FOUND' | 'INVALID_ACTION';
  message: string;
  decision?: DecisionType | string;
  ratifiedMessagePayload?: { text: string; blocks: any[] };
}

/**
 * Map Slack button action_id to DecisionType
 */
export function mapActionIdToDecision(actionId: string): DecisionType | null {
  switch (actionId) {
    case 'decision_make_remote':
      return 'REMOTE';
    case 'decision_keep_office':
      return 'OFFICE';
    case 'decision_individual':
      return 'INDIVIDUAL';
    default:
      return null;
  }
}

/**
 * Core decision action processing logic
 * Handles authorization, idempotency, persistence, UI update, and calendar dispatch
 */
export async function handleDecisionClick(
  input: DecisionActionClickInput,
  deps: DecisionHandlerDependencies
): Promise<DecisionActionClickResult> {
  const { actionId, userId, planId, channelId, messageTs, responseUrl } = input;

  // 1. Validate action ID
  const decisionType = mapActionIdToDecision(actionId);
  if (!decisionType) {
    return {
      success: false,
      status: 'INVALID_ACTION',
      message: `Unknown action: ${actionId}`,
    };
  }

  // 2. Fetch Plan
  const plan = await deps.findPlanById(planId);
  if (!plan) {
    return {
      success: false,
      status: 'PLAN_NOT_FOUND',
      message: `Plan with ID ${planId} was not found.`,
    };
  }

  // 3. Single Decision Maker Invariant:
  // Check body.user.id === plan.ownerSlackUserId
  if (userId !== plan.ownerSlackUserId) {
    const ownerDisplayName = plan.ownerName || plan.ownerSlackUserId;
    const unauthorizedText = `Only the plan owner (${ownerDisplayName}) can make the team office decision.`;

    if (deps.sendEphemeralResponse) {
      await deps.sendEphemeralResponse({
        channelId,
        userId,
        text: unauthorizedText,
      });
    }

    return {
      success: false,
      status: 'UNAUTHORIZED',
      message: unauthorizedText,
    };
  }

  // 4. Idempotency Guard:
  // If a decision has already been recorded for this plan, acknowledge without double-processing
  const existingDecision = await deps.findDecisionByPlanId(planId);
  if (existingDecision) {
    return {
      success: true,
      status: 'ALREADY_RECORDED',
      decision: existingDecision.decision,
      message: `A decision (*${existingDecision.decision}*) has already been recorded for this plan.`,
    };
  }

  // 5. Valid Decision: Record row in decisions table
  const decidedAt = new Date();
  const reasonSummary = `Team lead ratified decision ${decisionType} via Slack Block Kit action button`;

  await deps.createDecision({
    planId,
    decidedBySlackUserId: userId,
    decision: decisionType,
    reasonSummary,
    decidedAt,
  });

  // 6. Audit Logging (Rule 6)
  if (deps.recordAudit) {
    try {
      await deps.recordAudit({
        workspaceId: plan.workspaceId,
        actionType: 'DECISION_CLICK',
        actorSlackUserId: userId,
        targetEntity: `plan:${planId}`,
        details: {
          actionId,
          decision: decisionType,
          planId,
        },
      });
    } catch (auditErr) {
      console.error('Audit logging failed for decision click:', auditErr);
    }
  }

  // 7. Update channel message in-place to remove buttons and show ratification card
  const ratifiedCard = buildRatifiedDecisionCard({
    planId,
    ownerSlackUserId: plan.ownerSlackUserId,
    ownerName: plan.ownerName,
    decision: decisionType,
    ratifiedAt: decidedAt,
    isSimulated: plan.isSimulated,
  });

  if (deps.updateMessage) {
    await deps.updateMessage({
      channelId: channelId || plan.channelId,
      messageTs,
      responseUrl,
      text: ratifiedCard.text,
      blocks: ratifiedCard.blocks,
    });
  }

  // 8. If decision is REMOTE, dispatch calendar update handler
  if (decisionType === 'REMOTE' && deps.dispatchCalendarUpdate) {
    try {
      await deps.dispatchCalendarUpdate(planId);
    } catch (calErr) {
      console.error(`Calendar dispatch failed for remote plan ${planId}:`, calErr);
    }
  }

  return {
    success: true,
    status: 'RATIFIED',
    decision: decisionType,
    message: ratifiedCard.text,
    ratifiedMessagePayload: ratifiedCard,
  };
}

/**
 * Register button action listeners with Slack Bolt App
 */
export function registerDecisionButtonHandlers(
  app: any,
  deps: DecisionHandlerDependencies
): void {
  const actionIds = ['decision_make_remote', 'decision_keep_office', 'decision_individual'];

  for (const actionId of actionIds) {
    app.action(actionId, async ({ ack, body, action, respond, client }: any) => {
      await ack();

      const userId = body.user?.id;
      const planId = (action as any)?.value || (body as any)?.actions?.[0]?.value;
      const channelId = body.channel?.id;
      const messageTs = body.message?.ts;

      if (!planId) {
        console.error(`Missing planId for action ${actionId}`);
        return;
      }

      await handleDecisionClick(
        {
          actionId,
          userId,
          planId,
          channelId,
          messageTs,
        },
        {
          ...deps,
          sendEphemeralResponse: async ({ userId: targetUserId, text }: any) => {
            if (respond) {
              await respond({
                text,
                response_type: 'ephemeral',
                replace_original: false,
              });
            } else if (client && channelId) {
              await client.chat.postEphemeral({
                channel: channelId,
                user: targetUserId,
                text,
              });
            }
          },
          updateMessage: async ({ text, blocks }: any) => {
            if (respond) {
              await respond({
                text,
                blocks,
                replace_original: true,
              });
            } else if (client && channelId && messageTs) {
              await client.chat.update({
                channel: channelId,
                ts: messageTs,
                text,
                blocks,
              });
            }
          },
        }
      );
    });
  }
}
