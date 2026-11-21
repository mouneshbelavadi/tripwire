/**
 * Tripwire Teams - Master Server Entrypoint
 *
 * Coordinates and boots all Tripwire Teams subsystems:
 * 1. Slack Bolt App (Socket Mode or HTTP Mode via SLACK_SOCKET_MODE).
 *    - Full slash command router (/tripwire [setup | plan | preview | skip | forget | connect-calendar])
 *    - Modal view submission handlers (tripwire_setup_modal, tripwire_plan_modal)
 *    - Interactive decision button handlers (decision_make_remote, decision_keep_office, decision_individual)
 *    - Lifecycle event purges (app_uninstalled, tokens_revoked)
 * 2. Express HTTP Server on PORT:
 *    - Public Astra Design System landing page (/)
 *    - Uptime & telemetry health check (/health)
 *    - Public Privacy & Security compliance documents (/privacy, /security)
 *    - Slack App Installation Gateway (/slack/install)
 *    - Google OAuth2 Authorization & Callback handlers (/connect, /oauth/google/callback)
 * 3. pg-boss Distributed Queue Worker:
 *    - PostgreSQL backed background queue for commute baseline and cadence checks
 *    - Automatic recovery of scheduled jobs on restart
 * 4. Graceful Shutdown (SIGINT, SIGTERM):
 *    - Closes HTTP server
 *    - Flushes pg-boss queue workers
 *    - Stops Slack Bolt client
 *    - Disconnects Prisma database client cleanly
 */

import express, { type Application } from 'express';
import cors from 'cors';
import type { Server } from 'node:http';
import bolt from '@slack/bolt';
const { App, ExpressReceiver, LogLevel } = bolt;
import PgBoss from 'pg-boss';
import { PrismaClient, TravelMode } from '@prisma/client';

import { env } from './config/env.js';
import { createLandingRouter } from './landing/server.js';
import { oauthRouter } from './features/calendar/oauthRoutes.js';
import { GoogleRoutesProvider } from './features/commute/googleRoutes.js';
import { initPgBossScheduler } from './features/scheduler/pgBossScheduler.js';
import {
  buildSetupModalView,
  handleSetupSubmission,
  extractSetupModalValues,
  type SetupModalValues,
} from './features/members/setup.js';
import {
  buildPlanModalView,
  handlePlanModalSubmission,
  extractPlanModalValues,
  validatePlanTimes,
} from './features/scheduler/planModal.js';
import { executePlanPreview } from './features/demo/preview.js';
import { skipOfficeDay } from './features/members/skip.js';
import { forgetMember } from './features/members/forget.js';
import { registerWorkspaceEventHandlers } from './features/members/events.js';
import {
  registerDecisionButtonHandlers,
  type DecisionType,
} from './features/slack-ui/buttonHandlers.js';
import { switchEventToRemote } from './features/calendar/calendarService.js';
import { recordAudit, AuditAction } from './features/security/auditLog.js';

// 1. Initialize Prisma Database Client
export const prisma = new PrismaClient();

// 2. Determine Slack Connection Mode
const isSocketMode = process.env.SLACK_SOCKET_MODE !== 'false';

let expressReceiver: InstanceType<typeof ExpressReceiver> | undefined;
export let boltApp: InstanceType<typeof App>;

if (isSocketMode) {
  boltApp = new App({
    token: env.SLACK_BOT_TOKEN,
    appToken: env.SLACK_APP_TOKEN,
    signingSecret: env.SLACK_SIGNING_SECRET,
    socketMode: true,
    logLevel: env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  });
} else {
  expressReceiver = new ExpressReceiver({
    signingSecret: env.SLACK_SIGNING_SECRET,
    processBeforeResponse: true,
  });
  boltApp = new App({
    token: env.SLACK_BOT_TOKEN,
    receiver: expressReceiver,
    logLevel: env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  });
}

// 3. Initialize Express Web Server
export const expressApp: Application = express();
expressApp.use(cors());

// If in HTTP mode, mount Slack receiver first
if (!isSocketMode && expressReceiver) {
  expressApp.use(expressReceiver.router);
}

expressApp.use(express.json());
expressApp.use(express.urlencoded({ extended: true }));

// Mount Landing Page & Static Assets (includes /health, /, /privacy, /security, /slack/install)
expressApp.use(createLandingRouter());

// Mount Google OAuth2 routes (/oauth/google/callback, /oauth/google/connect, /callback, /connect)
expressApp.use(oauthRouter);

// 4. Initialize pg-boss Job Queue Instance
export const boss = new PgBoss(env.DATABASE_URL);
boss.on('error', (err: any) => {
  console.error('[pg-boss] Error:', err?.message || err);
});

// 5. Register Slack Bolt Interactive Features & Slash Commands

// A. Unified /tripwire Slash Command Dispatcher
boltApp.command('/tripwire', async ({ command, ack, respond, client }: any) => {
  await ack();
  const text = (command.text || '').trim();
  const parts = text.split(/\s+/);
  const subCommand = parts[0]?.toLowerCase() || '';

  // 1. Default Alive & Help Check
  if (!subCommand || subCommand === 'help' || subCommand === 'status' || subCommand === 'alive') {
    await respond({
      text: [
        '⚡ *Tripwire Teams* is active and monitoring commute corridors.',
        '',
        '*Available Slash Commands:*',
        '• `/tripwire setup` — Configure your personal home area and travel mode',
        '• `/tripwire plan` — Schedule an office day for your team (Team Lead)',
        '• `/tripwire preview` — Private live dry-run check of commute conditions',
        '• `/tripwire skip <date>` — Skip an office day (e.g. `/tripwire skip 2026-11-23` or `/tripwire skip tomorrow`)',
        '• `/tripwire forget` — Instantly wipe all your personal data (GDPR compliant)',
        '• `/tripwire connect-calendar` — Connect your Google Calendar for Meet fallbacks',
      ].join('\n'),
      response_type: 'ephemeral',
    });
    return;
  }

  // 2. /tripwire setup
  if (subCommand === 'setup') {
    try {
      const view = buildSetupModalView();
      await client.views.open({
        trigger_id: command.trigger_id,
        view,
      });
    } catch (err: any) {
      console.error('[Setup] Failed to open setup modal:', err?.message || err);
      await respond({
        text: `❌ Could not open setup modal: ${err?.message || 'Unexpected error'}`,
        response_type: 'ephemeral',
      });
    }
    return;
  }

  // 3. /tripwire plan
  if (subCommand === 'plan') {
    try {
      const view = buildPlanModalView();
      await client.views.open({
        trigger_id: command.trigger_id,
        view,
      });
    } catch (err: any) {
      console.error('[PlanModal] Failed to open plan modal:', err?.message || err);
      await respond({
        text: `❌ Could not open plan modal: ${err?.message || 'Unexpected error'}`,
        response_type: 'ephemeral',
      });
    }
    return;
  }

  // 4. /tripwire preview
  if (subCommand === 'preview') {
    try {
      const planId = parts[1] || undefined;
      const preview = await executePlanPreview({
        planId,
        workspaceId: command.team_id,
        callingSlackUserId: command.user_id,
        dbClient: prisma,
      });
      await respond(preview.slackResponse);
    } catch (err: any) {
      console.error('[Preview] Error executing preview:', err?.message || err);
      await respond({
        text: `❌ Preview failed: ${err?.message || 'Unexpected error'}`,
        response_type: 'ephemeral',
      });
    }
    return;
  }

  // 5. /tripwire skip <date>
  if (subCommand === 'skip') {
    try {
      const dateInput = parts.slice(1).join(' ');
      const result = await skipOfficeDay(prisma, {
        workspaceId: command.team_id,
        slackUserId: command.user_id,
        dateInput,
      });
      await respond({
        text: result.message,
        response_type: 'ephemeral',
      });
    } catch (err: any) {
      console.error('[Skip] Error handling skip command:', err?.message || err);
      await respond({
        text: `❌ Error processing skip request: ${err?.message || 'Unexpected error'}`,
        response_type: 'ephemeral',
      });
    }
    return;
  }

  // 6. /tripwire forget
  if (subCommand === 'forget') {
    try {
      const result = await forgetMember(prisma, {
        workspaceId: command.team_id,
        slackUserId: command.user_id,
      });
      await respond({
        text: result.message,
        response_type: 'ephemeral',
      });
    } catch (err: any) {
      console.error('[Forget] Error processing forget request:', err?.message || err);
      await respond({
        text: `❌ Error erasing data: ${err?.message || 'Unexpected error'}`,
        response_type: 'ephemeral',
      });
    }
    return;
  }

  // 7. /tripwire connect-calendar
  if (subCommand === 'connect-calendar') {
    const port = env.PORT || 3000;
    const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
    const authUrl = `${baseUrl}/oauth/google/connect?workspaceId=${encodeURIComponent(
      command.team_id
    )}&slackUserId=${encodeURIComponent(command.user_id)}`;
    await respond({
      text: [
        '📅 *Tripwire Teams — Google Calendar Integration*',
        'Connect your Google Calendar so Tripwire can manage office day events and convert them to remote syncs with Google Meet links when severe commute disruptions occur.',
        '',
        `👉 <${authUrl}|*Click here to connect Google Calendar*>`,
      ].join('\n'),
      response_type: 'ephemeral',
    });
    return;
  }

  // Fallback for unknown subcommands
  await respond({
    text: `❓ Unknown command \`/tripwire ${subCommand}\`. Run \`/tripwire\` to see available options.`,
    response_type: 'ephemeral',
  });
});

// B. Modal View Submissions
boltApp.view('tripwire_setup_modal', async ({ ack, body, view, client }: any) => {
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
    const result = await handleSetupSubmission(prisma, client, {
      workspaceId,
      slackUserId,
      homeArea: formValues.homeArea,
      travelMode: formValues.travelMode,
      maxMinutes: formValues.maxMinutes,
      apiKey: env.GOOGLE_MAPS_API_KEY,
    });

    await ack({
      response_action: 'update',
      view: {
        type: 'modal',
        title: { type: 'plain_text', text: 'Setup Complete' },
        close: { type: 'plain_text', text: 'Done' },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ *Preferences Saved!*\n\nMatched locality: *${result.formattedAddress}*\nMode: *${result.travelMode}*\nMax acceptable duration: *${result.maxMinutes} mins*`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '🔒 *Privacy by Design:* Your coordinates are rounded to ~1 km and encrypted at rest. Team leads only see aggregate counts.',
              },
            ],
          },
        ],
      },
    });
  } catch (err: any) {
    console.error('[Setup] Error handling setup submission:', err?.message || err);
    await ack({
      response_action: 'errors',
      errors: {
        home_area_block: err?.message || 'Failed to save commute preferences. Please try again.',
      },
    });
  }
});

boltApp.view('tripwire_plan_modal', async ({ ack, body, view, client }: any) => {
  const workspaceId = body.team?.id || '';
  const ownerSlackUserId = body.user?.id || '';

  const submissionData = extractPlanModalValues(view, workspaceId, ownerSlackUserId);
  const validation = validatePlanTimes(submissionData.arriveByTime, submissionData.decisionTime);

  if (!validation.valid) {
    await ack({
      response_action: 'errors',
      errors: {
        decision_time_block: validation.error || 'Invalid decision cutoff time',
      },
    });
    return;
  }

  await ack();

  try {
    const result = await handlePlanModalSubmission(submissionData, prisma, boss);
    if (result.channelId && client?.chat?.postMessage) {
      await client.chat.postMessage({
        channel: result.channelId,
        text: result.announcementText,
      });
    }
  } catch (err: any) {
    console.error('[PlanModal] Error processing plan submission:', err?.message || err);
  }
});

// C. Interactive Button Actions
registerDecisionButtonHandlers(boltApp, {
  findPlanById: async (planId: string) => {
    return prisma.plan.findUnique({
      where: { id: planId },
      select: {
        id: true,
        workspaceId: true,
        channelId: true,
        ownerSlackUserId: true,
      },
    });
  },
  findDecisionByPlanId: async (planId: string) => {
    const decision = await prisma.decision.findFirst({
      where: { planId },
      orderBy: { decidedAt: 'desc' },
    });
    if (!decision) return null;
    return {
      id: decision.id,
      planId: decision.planId,
      decidedBySlackUserId: decision.decidedBySlackUserId,
      decision: decision.decision as DecisionType,
      reasonSummary: decision.reasonSummary,
      decidedAt: decision.decidedAt,
    };
  },
  createDecision: async (data) => {
    return prisma.decision.create({
      data: {
        planId: data.planId,
        decidedBySlackUserId: data.decidedBySlackUserId,
        decision: data.decision,
        reasonSummary: data.reasonSummary,
        decidedAt: data.decidedAt,
      },
    });
  },
  dispatchCalendarUpdate: async (planId: string) => {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });
    if (plan) {
      await switchEventToRemote(planId, plan.ownerSlackUserId, { db: prisma });
    }
  },
  recordAudit: async (params) => {
    await recordAudit(
      params.workspaceId,
      params.actionType,
      params.actorSlackUserId,
      params.targetEntity,
      params.details
    );
  },
});

// D. Lifecycle Events (App Uninstalled, Tokens Revoked)
registerWorkspaceEventHandlers(boltApp, prisma);

// 6. Server Lifecycle Management
export let httpServer: Server | null = null;
let isShuttingDown = false;

/**
 * Boots the master Tripwire Teams server
 */
export async function startServer(): Promise<{
  httpServer: Server;
  boltApp: InstanceType<typeof App>;
  boss: InstanceType<typeof PgBoss>;
}> {
  console.log('🚀 Starting Tripwire Teams Master Server...');

  // 1. Connect Prisma
  try {
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL database via Prisma.');
  } catch (dbErr: any) {
    console.warn('⚠️ PostgreSQL connection warning:', dbErr?.message || dbErr);
  }

  // 2. Start Express HTTP Server
  const port = env.PORT || 3000;
  await new Promise<void>((resolve) => {
    httpServer = expressApp.listen(port, () => {
      console.log(`🌐 Express HTTP server listening on http://localhost:${port}`);
      console.log(`   • Landing Page:      http://localhost:${port}/`);
      console.log(`   • Health Check:      http://localhost:${port}/health`);
      console.log(`   • Privacy Policy:    http://localhost:${port}/privacy`);
      console.log(`   • Security Policy:   http://localhost:${port}/security`);
      console.log(`   • Google OAuth Flow: http://localhost:${port}/oauth/google/callback`);
      resolve();
    });
  });

  // 3. Start Slack Bolt App
  try {
    if (isSocketMode) {
      await boltApp.start();
      console.log('⚡️ Slack Bolt App connected in Socket Mode.');
    } else {
      console.log('⚡️ Slack Bolt App running in HTTP Mode on Express receiver.');
    }
  } catch (slackErr: any) {
    console.warn('⚠️ Slack Bolt startup warning:', slackErr?.message || slackErr);
  }

  // 4. Start pg-boss Job Scheduler & Workers
  try {
    await boss.start();
    console.log('📦 pg-boss background queue worker started.');
    const routesProvider = new GoogleRoutesProvider({ apiKey: env.GOOGLE_MAPS_API_KEY });
    await initPgBossScheduler(boss, {
      prisma,
      routesProvider,
      slackClient: boltApp.client,
    });
    console.log('⏱️ pg-boss commute baseline and cadence workers registered.');
  } catch (bossErr: any) {
    console.warn('⚠️ pg-boss worker startup warning (check PostgreSQL):', bossErr?.message || bossErr);
  }

  console.log('🟢 Tripwire Teams is fully initialized and operational!');
  return { httpServer: httpServer!, boltApp, boss };
}

/**
 * Graceful shutdown handler
 */
export async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  // Close HTTP server
  if (httpServer) {
    await new Promise<void>((resolve) => {
      httpServer!.close(() => {
        console.log('✅ Express HTTP server closed.');
        resolve();
      });
    });
  }

  // Stop Slack Bolt client
  try {
    if (isSocketMode && boltApp) {
      await boltApp.stop();
      console.log('✅ Slack Bolt App stopped.');
    }
  } catch (err: any) {
    console.warn('Warning stopping Slack Bolt App:', err?.message || err);
  }

  // Flush and stop pg-boss
  try {
    if (boss) {
      await boss.stop({ graceful: true, timeout: 5000 });
      console.log('✅ pg-boss queues flushed and stopped.');
    }
  } catch (err: any) {
    console.warn('Warning stopping pg-boss:', err?.message || err);
  }

  // Disconnect database
  try {
    await prisma.$disconnect();
    console.log('✅ Prisma database connection closed cleanly.');
  } catch (err: any) {
    console.warn('Warning disconnecting Prisma:', err?.message || err);
  }

  console.log('✨ Tripwire Teams shutdown complete.');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Execute when invoked directly
if (
  process.env.NODE_ENV !== 'test' &&
  process.argv[1] &&
  (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'))
) {
  startServer().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
