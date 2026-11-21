import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  SLACK_BOT_TOKEN: z.string().min(1, 'SLACK_BOT_TOKEN is required'),
  SLACK_APP_TOKEN: z.string().min(1, 'SLACK_APP_TOKEN is required'),
  SLACK_SIGNING_SECRET: z.string().min(1, 'SLACK_SIGNING_SECRET is required'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  ENCRYPTION_KEY: z.string().min(1, 'ENCRYPTION_KEY is required').refine((key) => {
    // ENCRYPTION_KEY must resolve to exactly 32 bytes
    if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) return true;
    try {
      const b64 = Buffer.from(key, 'base64');
      if (b64.length === 32) return true;
    } catch {
      // not base64
    }
    const utf8 = Buffer.from(key, 'utf8');
    if (utf8.length === 32) return true;
    return false;
  }, {
    message: 'ENCRYPTION_KEY must resolve to 32 bytes (64 hex characters, 44 base64 characters, or 32-character utf-8 string)'
  }),
  GOOGLE_MAPS_API_KEY: z.string().min(1, 'GOOGLE_MAPS_API_KEY is required'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
