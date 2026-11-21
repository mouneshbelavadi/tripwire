/**
 * Slack Block Kit Decision Cards for Tripwire Teams
 *
 * Implements:
 * 1. RECOMMEND_REMOTE interactive card with aggregate disruption reasons and 3 action buttons
 * 2. CANNOT_ASSESS notification card when provider readings are unavailable (>30% unknown)
 * 3. Ratified decision in-place update message
 *
 * Enforces:
 * - Privacy by design: Aggregate reasons only, no individual home areas or names by default.
 * - Truth in telemetry: Prominent SIMULATED banner if demoMode or isSimulated is true.
 */

export interface BlockKitTextObject {
  type: 'plain_text' | 'mrkdwn';
  text: string;
  emoji?: boolean;
}

export interface BlockKitElement {
  type: string;
  action_id?: string;
  text?: BlockKitTextObject;
  style?: 'primary' | 'danger';
  value?: string;
  url?: string;
}

export interface BlockKitBlock {
  type: string;
  block_id?: string;
  text?: BlockKitTextObject;
  elements?: (BlockKitElement | BlockKitTextObject)[];
  fields?: BlockKitTextObject[];
}

export interface BlockKitMessagePayload {
  text: string;
  blocks: BlockKitBlock[];
}

export interface RecommendRemoteCardParams {
  planId: string;
  affectedCount: number;
  totalEligibleCount: number;
  reasons: string[];
  checkedAt?: Date | string;
  isSimulated?: boolean;
  demoMode?: boolean;
}

export interface CannotAssessCardParams {
  planId?: string;
  unknownPercent?: number;
  checkedAt?: Date | string;
  isSimulated?: boolean;
  demoMode?: boolean;
  customExplanation?: string;
}

export interface RatifiedDecisionParams {
  planId: string;
  ownerSlackUserId: string;
  ownerName?: string;
  decision: 'REMOTE' | 'OFFICE' | 'INDIVIDUAL' | string;
  ratifiedAt?: Date | string;
  isSimulated?: boolean;
  demoMode?: boolean;
}

/**
 * Format timestamp into clean human-readable time string (e.g. "08:15 AM" or "08:15:00 UTC")
 */
export function formatTime(timeInput?: Date | string): string {
  if (!timeInput) {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  if (typeof timeInput === 'string') {
    return timeInput;
  }
  return timeInput.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export const SIMULATED_BANNER_TEXT = '🚨 [SIMULATED TEST DATA - FOR DEMO ONLY]';
export const RECOMMEND_REMOTE_HEADER = "⚠️ Commute Disruption Detected for Tomorrow's In-Office Day";

/**
 * Builds Slack Block Kit message payload for RECOMMEND_REMOTE
 */
export function buildRecommendRemoteCard(params: RecommendRemoteCardParams): BlockKitMessagePayload {
  const isSimulated = Boolean(params.isSimulated || params.demoMode);
  const blocks: BlockKitBlock[] = [];

  // Prominent bold banner if simulated
  if (isSimulated) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${SIMULATED_BANNER_TEXT}*`,
      },
    });
  }

  // Header block
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: RECOMMEND_REMOTE_HEADER,
      emoji: true,
    },
  });

  // Bold headline: "{affectedCount} of {totalEligibleCount} teammates are likely to face very long commutes tomorrow"
  const headline = `"${params.affectedCount} of ${params.totalEligibleCount} teammates are likely to face very long commutes tomorrow"`;
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${params.affectedCount} of ${params.totalEligibleCount} teammates are likely to face very long commutes tomorrow*`,
    },
  });

  // Reasons block in plain English (aggregates only, no individual home areas, no names by default)
  const formattedReasons =
    params.reasons && params.reasons.length > 0
      ? params.reasons.map((r) => (r.trim().startsWith('•') ? r.trim() : `• ${r.trim()}`)).join('\n')
      : '• Commute travel times significantly exceed normal baselines for multiple routes.';

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: formattedReasons,
    },
  });

  // Timestamp metadata: "Checked live at {time}. Two consecutive fresh checks verified."
  const timeFormatted = formatTime(params.checkedAt);
  const checkPrefix = isSimulated ? 'Checked (simulated)' : 'Checked live';
  const timestampText = `${checkPrefix} at ${timeFormatted}. Two consecutive fresh checks verified.`;

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: timestampText,
      },
    ],
  });

  // 3 interactive action buttons:
  // 1. "Make it remote" (primary style / green)
  // 2. "Keep in office" (danger style / red)
  // 3. "Let individuals decide" (default)
  blocks.push({
    type: 'actions',
    block_id: 'tripwire_decision_actions',
    elements: [
      {
        type: 'button',
        action_id: 'decision_make_remote',
        text: {
          type: 'plain_text',
          text: 'Make it remote',
          emoji: true,
        },
        style: 'primary',
        value: params.planId,
      },
      {
        type: 'button',
        action_id: 'decision_keep_office',
        text: {
          type: 'plain_text',
          text: 'Keep in office',
          emoji: true,
        },
        style: 'danger',
        value: params.planId,
      },
      {
        type: 'button',
        action_id: 'decision_individual',
        text: {
          type: 'plain_text',
          text: 'Let individuals decide',
          emoji: true,
        },
        value: params.planId,
      },
    ],
  });

  const fallbackText = isSimulated
    ? `[SIMULATED] ⚠️ Commute Disruption Detected: ${headline}`
    : `⚠️ Commute Disruption Detected: ${headline}`;

  return {
    text: fallbackText,
    blocks,
  };
}

/**
 * Builds Block Kit message for CANNOT_ASSESS
 * Short, honest notification explaining that provider readings were unavailable (>30% unknown)
 * and advising the team lead to decide manually.
 */
export function buildCannotAssessCard(params: CannotAssessCardParams = {}): BlockKitMessagePayload {
  const isSimulated = Boolean(params.isSimulated || params.demoMode);
  const blocks: BlockKitBlock[] = [];

  if (isSimulated) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${SIMULATED_BANNER_TEXT}*`,
      },
    });
  }

  // Header
  blocks.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: '⚠️ Commute Status: Cannot Assess',
      emoji: true,
    },
  });

  const unknownText =
    params.unknownPercent !== undefined ? `${params.unknownPercent}%` : 'more than 30%';

  const explanation =
    params.customExplanation ||
    `Commute conditions could not be assessed reliably because ${unknownText} of transit/weather provider readings were unavailable or stale.\n\nTripwire adheres strictly to the rule: *"Unknown is never fine"*. Because telemetry is incomplete, no automatic recommendation is made.\n\n👉 *Team lead, please evaluate local conditions and decide manually whether tomorrow's in-office day should proceed.*`;

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: explanation,
    },
  });

  const timeFormatted = formatTime(params.checkedAt);
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Checked at ${timeFormatted}. Telemetry threshold breached (>30% unknown).`,
      },
    ],
  });

  return {
    text: `⚠️ Commute Status: Cannot Assess provider readings (>30% unknown). Team lead manual decision required.`,
    blocks,
  };
}

/**
 * Builds Slack Block Kit message payload for in-place updated card after decision ratification
 * Format: "Decision Ratified by @{owner}: *{decision}* at {time}"
 */
export function buildRatifiedDecisionCard(params: RatifiedDecisionParams): BlockKitMessagePayload {
  const isSimulated = Boolean(params.isSimulated || params.demoMode);
  const blocks: BlockKitBlock[] = [];

  if (isSimulated) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${SIMULATED_BANNER_TEXT}*`,
      },
    });
  }

  const timeFormatted = formatTime(params.ratifiedAt);
  const ownerLabel = params.ownerName
    ? params.ownerName
    : params.ownerSlackUserId.startsWith('U')
    ? params.ownerSlackUserId
    : params.ownerSlackUserId;

  // Exact required phrase: "Decision Ratified by @{owner}: *{decision}* at {time}"
  const ratifiedHeadline = `Decision Ratified by @${ownerLabel}: *${params.decision}* at ${timeFormatted}`;

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `✅ *${ratifiedHeadline}*`,
    },
  });

  let decisionDetails = '';
  if (params.decision === 'REMOTE') {
    decisionDetails = 'Calendar event has been converted to Remote with a Google Meet link and attendees notified.';
  } else if (params.decision === 'OFFICE') {
    decisionDetails = 'Team office day remains on as planned.';
  } else {
    decisionDetails = 'Teammates may choose whether to commute or work remotely based on personal circumstances.';
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: decisionDetails,
      },
    ],
  });

  return {
    text: ratifiedHeadline,
    blocks,
  };
}
