import bolt from '@slack/bolt';
const { App, LogLevel } = bolt;
import { env } from './config/env.js';

export const slackApp = new App({
  token: env.SLACK_BOT_TOKEN,
  appToken: env.SLACK_APP_TOKEN,
  signingSecret: env.SLACK_SIGNING_SECRET,
  socketMode: true,
  logLevel: env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
});

// Handle /tripwire command
slackApp.command('/tripwire', async ({ ack, respond }) => {
  await ack();
  await respond('Tripwire is alive');
});

/**
 * Start the Slack Bolt app in Socket Mode
 */
export async function startSlackApp(): Promise<void> {
  await slackApp.start();
  console.log('⚡️ Tripwire Slack Bolt app is running in Socket Mode!');
}

// Start immediately when run directly as main module
if (
  process.env.NODE_ENV !== 'test' &&
  process.argv[1] &&
  (process.argv[1].endsWith('slackApp.ts') || process.argv[1].endsWith('slackApp.js'))
) {
  startSlackApp().catch((err) => {
    console.error('Failed to start Tripwire Slack Bolt app:', err);
    process.exit(1);
  });
}
