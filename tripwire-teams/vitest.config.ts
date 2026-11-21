import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      PORT: '3000',
      SLACK_BOT_TOKEN: 'xoxb-mock-test-token-1234567890',
      SLACK_APP_TOKEN: 'xapp-mock-test-token-1234567890',
      SLACK_SIGNING_SECRET: 'mock-signing-secret-test-12345',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/tripwire_test',
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      GOOGLE_MAPS_API_KEY: 'mock-google-maps-api-key',
      GOOGLE_CLIENT_ID: 'mock-google-client-id',
      GOOGLE_CLIENT_SECRET: 'mock-google-client-secret',
    },
  },
});
