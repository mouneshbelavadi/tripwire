/**
 * Tripwire Teams - Member Setup & Privacy Consent Flow
 * 
 * Handles `/tripwire setup`:
 * 1. Opens Slack Modal asking for:
 *    - Home Area (free text e.g. "HSR Layout, Bengaluru")
 *    - Commute Travel Mode (Driving/Car, Two-Wheeler, Public Transit/Metro)
 *    - Personal Maximum Commute in minutes (number input, default 75)
 * 2. On submission:
 *    - Runs `geocodeAddress` to get approximate matched area and 2-decimal rounded coords.
 *    - Retrieves user's Slack email via `client.users.info`.
 *    - Encrypts rounded coordinates using `encrypt` from `../../config/encryption`.
 *    - Stores consent timestamp and member record in `members` table.
 *    - Presents confirmation view with matched area name and clear privacy consent disclosure.
 */

import type { ModalView, ViewOutput } from '@slack/bolt';
import type { PrismaClient, TravelMode } from '@prisma/client';
import { geocodeAddress, type GeocodingResult } from './geocoding.js';
import { encryptCoords } from '../../config/encryption.js';

export interface SetupModalValues {
  homeArea: string;
  travelMode: TravelMode;
  maxMinutes: number;
}

export interface SetupSubmissionResult {
  memberId: string;
  workspaceId: string;
  slackUserId: string;
  slackEmail: string | null;
  formattedAddress: string;
  travelMode: TravelMode;
  maxMinutes: number;
  consentGivenAt: Date;
}

/**
 * Builds the Slack Block Kit modal view for `/tripwire setup`.
 */
export function buildSetupModalView(): ModalView {
  return {
    type: 'modal',
    callback_id: 'tripwire_setup_modal',
    title: {
      type: 'plain_text',
      text: 'Tripwire Commute Setup',
    },
    submit: {
      type: 'plain_text',
      text: 'Save & Opt In',
    },
    close: {
      type: 'plain_text',
      text: 'Cancel',
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Set your approximate commute preferences. Tripwire monitors travel conditions so you and your team can decide whether to commute or work remotely.',
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'input',
        block_id: 'home_area_block',
        label: {
          type: 'plain_text',
          text: 'Approximate Home Area / Neighborhood',
        },
        hint: {
          type: 'plain_text',
          text: 'Enter a neighborhood or locality (e.g. "HSR Layout, Bengaluru" or "Indiranagar"). Exact house numbers are not required.',
        },
        element: {
          type: 'plain_text_input',
          action_id: 'home_area_input',
          placeholder: {
            type: 'plain_text',
            text: 'e.g. HSR Layout Sector 1, Bengaluru',
          },
        },
      },
      {
        type: 'input',
        block_id: 'travel_mode_block',
        label: {
          type: 'plain_text',
          text: 'Commute Travel Mode',
        },
        element: {
          type: 'static_select',
          action_id: 'travel_mode_input',
          placeholder: {
            type: 'plain_text',
            text: 'Select your primary travel mode',
          },
          initial_option: {
            text: {
              type: 'plain_text',
              text: '🚗 Driving / Car',
            },
            value: 'CAR',
          },
          options: [
            {
              text: {
                type: 'plain_text',
                text: '🚗 Driving / Car',
              },
              value: 'CAR',
            },
            {
              text: {
                type: 'plain_text',
                text: '🛵 Two-Wheeler / Bike',
              },
              value: 'TWO_WHEELER',
            },
            {
              text: {
                type: 'plain_text',
                text: '🚇 Public Transit / Metro',
              },
              value: 'TRANSIT',
            },
          ],
        },
      },
      {
        type: 'input',
        block_id: 'max_minutes_block',
        label: {
          type: 'plain_text',
          text: 'Personal Maximum Commute (Minutes)',
        },
        hint: {
          type: 'plain_text',
          text: 'If your predicted or live one-way commute exceeds this duration, you will be flagged as affected.',
        },
        element: {
          type: 'plain_text_input',
          action_id: 'max_minutes_input',
          initial_value: '75',
          placeholder: {
            type: 'plain_text',
            text: '75',
          },
        },
      },
    ],
  };
}

/**
 * Builds the Slack Block Kit confirmation modal view presented upon successful submission.
 * Clearly articulates privacy consent disclosures.
 */
export function buildConfirmationView(params: {
  formattedAddress: string;
  travelMode: TravelMode;
  maxMinutes: number;
}): ModalView {
  const modeLabels: Record<TravelMode, string> = {
    CAR: '🚗 Driving / Car',
    TWO_WHEELER: '🛵 Two-Wheeler / Bike',
    TRANSIT: '🚇 Public Transit / Metro',
  };

  return {
    type: 'modal',
    callback_id: 'tripwire_setup_confirmation_view',
    title: {
      type: 'plain_text',
      text: 'Tripwire Opt-In Active',
    },
    close: {
      type: 'plain_text',
      text: 'Done',
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🎉 *You are now opted in to Tripwire Teams commute checks!*',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Matched Area:*\n${params.formattedAddress}`,
          },
          {
            type: 'mrkdwn',
            text: `*Travel Mode:*\n${modeLabels[params.travelMode] || params.travelMode}`,
          },
          {
            type: 'mrkdwn',
            text: `*Max Commute Tolerance:*\n${params.maxMinutes} minutes`,
          },
          {
            type: 'mrkdwn',
            text: '*Status:*\n✅ Active & Protected',
          },
        ],
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*🔒 Privacy Consent & Data Protection:*' +
            '\n• *Approximate Coordinates:* Your location is rounded to 2 decimal places (~1.1 km precision) and encrypted with AES-256-GCM at rest.' +
            '\n• *Aggregate Invariant:* Your team lead only sees aggregate counts (e.g. _"4 of 7 affected"_). Your individual home area and travel mode are NEVER revealed to your lead or coworkers.' +
            '\n• *Right to be Forgotten:* You can permanently delete all your data anytime by running `/tripwire forget`.' +
            '\n• *Day Skipping:* You can skip any office day by running `/tripwire skip <date>` without leaving the team.',
        },
      },
    ],
  };
}

/**
 * Extracts and validates inputs from the setup modal submission view.
 */
export function extractSetupModalValues(view: ViewOutput): SetupModalValues {
  const values = view.state.values;

  const homeArea = values.home_area_block?.home_area_input?.value?.trim() || '';
  if (!homeArea) {
    throw new Error('Home area cannot be empty');
  }

  const selectedMode = values.travel_mode_block?.travel_mode_input?.selected_option?.value as TravelMode;
  const travelMode: TravelMode = selectedMode && ['CAR', 'TWO_WHEELER', 'TRANSIT'].includes(selectedMode)
    ? selectedMode
    : 'CAR';

  const rawMinutes = values.max_minutes_block?.max_minutes_input?.value?.trim() || '75';
  const parsedMinutes = parseInt(rawMinutes, 10);
  const maxMinutes = Number.isFinite(parsedMinutes) && parsedMinutes > 0 ? parsedMinutes : 75;

  return {
    homeArea,
    travelMode,
    maxMinutes,
  };
}

/**
 * Core business handler for member setup submission.
 * Encrypts rounded coordinates and persists consent timestamp in the database.
 */
export async function handleSetupSubmission(
  prisma: PrismaClient,
  client: any,
  params: {
    workspaceId: string;
    slackUserId: string;
    homeArea: string;
    travelMode: TravelMode;
    maxMinutes: number;
    apiKey: string;
  }
): Promise<SetupSubmissionResult> {
  // 1. Geocode home area (strictly rounded to 2 decimals)
  const geo: GeocodingResult = await geocodeAddress(params.homeArea, params.apiKey);

  // 2. Fetch Slack email via client.users.info
  let slackEmail: string | null = null;
  if (client?.users?.info) {
    try {
      const userInfo = await client.users.info({ user: params.slackUserId });
      if (userInfo.ok && userInfo.user?.profile?.email) {
        slackEmail = userInfo.user.profile.email;
      }
    } catch {
      // Graceful fallback if Slack users.info fails or email scope is unavailable
    }
  }

  // 3. Encrypt 2-decimal rounded coordinates using AES-256-GCM
  const encryptedCoords = encryptCoords(geo.lat, geo.lon);

  // 4. Ensure workspace exists
  await prisma.workspace.upsert({
    where: { id: params.workspaceId },
    update: {},
    create: {
      id: params.workspaceId,
      name: 'Tripwire Workspace',
      botToken: process.env.SLACK_BOT_TOKEN || 'xoxb-default',
    },
  });

  const consentGivenAt = new Date();

  // 5. Upsert member record
  const member = await prisma.member.upsert({
    where: {
      workspaceId_slackUserId: {
        workspaceId: params.workspaceId,
        slackUserId: params.slackUserId,
      },
    },
    create: {
      workspaceId: params.workspaceId,
      slackUserId: params.slackUserId,
      slackEmail,
      homeAreaLabel: geo.formattedAddress,
      encryptedCoords,
      travelMode: params.travelMode,
      maxMinutes: params.maxMinutes,
      consentGivenAt,
    },
    update: {
      slackEmail,
      homeAreaLabel: geo.formattedAddress,
      encryptedCoords,
      travelMode: params.travelMode,
      maxMinutes: params.maxMinutes,
      consentGivenAt,
    },
  });

  return {
    memberId: member.id,
    workspaceId: params.workspaceId,
    slackUserId: params.slackUserId,
    slackEmail,
    formattedAddress: geo.formattedAddress,
    travelMode: params.travelMode,
    maxMinutes: params.maxMinutes,
    consentGivenAt,
  };
}

/**
 * Registers Slack Bolt handlers for `/tripwire setup`.
 */
export function registerSetupHandlers(app: any, prisma: PrismaClient, apiKey?: string): void {
  const resolvedApiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY || '';

  // Handle `/tripwire setup` slash command
  app.command('/tripwire', async ({ command, ack, client }: any) => {
    const text = command.text?.trim() || '';
    if (text === 'setup' || text.startsWith('setup')) {
      await ack();
      try {
        const view = buildSetupModalView();
        await client.views.open({
          trigger_id: command.trigger_id,
          view,
        });
      } catch (err: any) {
        console.error('[Setup] Failed to open setup modal:', err?.message || err);
      }
    }
  });

  // Handle modal submission
  app.view('tripwire_setup_modal', async ({ ack, body, view, client }: any) => {
    const workspaceId = body.team?.id || '';
    const slackUserId = body.user?.id || '';

    let formValues: SetupModalValues;
    try {
      formValues = extractSetupModalValues(view);
    } catch (err: any) {
      await ack({
        response_action: 'errors',
        errors: {
          home_area_block: err?.message || 'Invalid home area',
        },
      });
      return;
    }

    try {
      // Process submission, geocode, encrypt coordinates, persist in DB
      const result = await handleSetupSubmission(prisma, client, {
        workspaceId,
        slackUserId,
        homeArea: formValues.homeArea,
        travelMode: formValues.travelMode,
        maxMinutes: formValues.maxMinutes,
        apiKey: resolvedApiKey,
      });

      // Update modal to confirmation view with privacy disclosures
      const confirmationView = buildConfirmationView({
        formattedAddress: result.formattedAddress,
        travelMode: result.travelMode,
        maxMinutes: result.maxMinutes,
      });

      await ack({
        response_action: 'update',
        view: confirmationView,
      });
    } catch (err: any) {
      console.error('[Setup] Geocoding or setup failure:', err?.message || err);
      await ack({
        response_action: 'errors',
        errors: {
          home_area_block: err?.message || 'Unable to locate this address. Please try a different neighborhood name.',
        },
      });
    }
  });
}
