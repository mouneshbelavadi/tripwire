/**
 * Private Heads-Up Direct Message (DM) for Tripwire Teams
 *
 * Enforces Decision Policy (Rule 28):
 * - If someone is affected but the team-wide 40% threshold was not met,
 *   send only that individual person a private heads-up DM:
 *   "Heads up: Your personal commute to the office tomorrow is currently estimated at {duration}m (exceeding your preferred {limit}m limit). The team office day remains on, but you may want to coordinate with your lead or use `/tripwire skip` if needed."
 *
 * Privacy by design:
 * - Only the affected teammate receives this.
 * - Home location or reason is never shared publicly in the team channel.
 */

import { SIMULATED_BANNER_TEXT } from './decisionCard.js';

export interface HeadsUpDmParams {
  durationMinutes: number;
  limitMinutes: number;
  isSimulated?: boolean;
  demoMode?: boolean;
}

export interface SendPersonalHeadsUpParams extends HeadsUpDmParams {
  slackUserId: string;
}

export interface SendDmResult {
  slackUserId: string;
  success: boolean;
  channelId?: string;
  error?: string;
}

/**
 * Builds the exact required heads-up plain text
 */
export function buildHeadsUpDmText(durationMinutes: number, limitMinutes: number): string {
  return `Heads up: Your personal commute to the office tomorrow is currently estimated at ${durationMinutes}m (exceeding your preferred ${limitMinutes}m limit). The team office day remains on, but you may want to coordinate with your lead or use \`/tripwire skip\` if needed.`;
}

/**
 * Builds the Slack Block Kit payload for the private DM
 */
export function buildHeadsUpDm(params: HeadsUpDmParams): {
  text: string;
  blocks: any[];
} {
  const isSimulated = Boolean(params.isSimulated || params.demoMode);
  const coreText = buildHeadsUpDmText(params.durationMinutes, params.limitMinutes);
  const blocks: any[] = [];

  if (isSimulated) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${SIMULATED_BANNER_TEXT}*`,
      },
    });
  }

  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: '🚗 Personal Commute Heads-Up',
      emoji: true,
    },
  });

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: coreText,
    },
  });

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: 'This alert was sent only to you because your personal commute exceeds your limit, while the overall team commute threshold was not reached.',
      },
    ],
  });

  const fallbackText = isSimulated
    ? `[SIMULATED] ${coreText}`
    : coreText;

  return {
    text: fallbackText,
    blocks,
  };
}

/**
 * Send a private DM to a single user using Slack Bolt client
 */
export async function sendPersonalHeadsUpDm(
  slackClient: any,
  params: SendPersonalHeadsUpParams
): Promise<SendDmResult> {
  try {
    const payload = buildHeadsUpDm(params);

    // Open direct message conversation with the user
    const openRes = await slackClient.conversations.open({
      users: params.slackUserId,
    });

    const dmChannelId = openRes.channel?.id;
    if (!dmChannelId) {
      return {
        slackUserId: params.slackUserId,
        success: false,
        error: 'Failed to open DM channel with user',
      };
    }

    await slackClient.chat.postMessage({
      channel: dmChannelId,
      text: payload.text,
      blocks: payload.blocks,
    });

    return {
      slackUserId: params.slackUserId,
      success: true,
      channelId: dmChannelId,
    };
  } catch (err: any) {
    return {
      slackUserId: params.slackUserId,
      success: false,
      error: err?.message || String(err),
    };
  }
}

/**
 * Send private heads-up DMs to multiple affected teammates in batch
 */
export async function sendPrivateHeadsUpDms(
  slackClient: any,
  items: SendPersonalHeadsUpParams[]
): Promise<SendDmResult[]> {
  const results: SendDmResult[] = [];
  for (const item of items) {
    const res = await sendPersonalHeadsUpDm(slackClient, item);
    results.push(res);
  }
  return results;
}
