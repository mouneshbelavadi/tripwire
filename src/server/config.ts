import dotenv from 'dotenv';
import path from 'path';

// Load .env if present (process env takes precedence)
dotenv.config();

export interface ServerConfig {
  port: number;
  environment: 'development' | 'production' | 'test';
  databasePath: string;
  serpApi: {
    apiKey?: string;
    isConfigured: boolean;
  };
  youCom: {
    apiKey?: string;
    isConfigured: boolean;
  };
  nexconn: {
    appKey?: string;
    appSecret?: string;
    apiBase?: string;
    isConfigured: boolean;
  };
  mode: 'LIVE' | 'SIMULATION' | 'REPLAY';
  budget: {
    researchCap: number;
    devPoolCeiling: number;
    plannedMaxSpend: number;
    untouchedReserve: number;
    totalAccountBudget: number;
  };
}

const serpApiKey = process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY;
const youApiKey = process.env.YDC_API_KEY || process.env.YOU_API_KEY || process.env.YOU_COM_API_KEY;
const nexconnAppKey = process.env.NEXCONN_APP_KEY;
const nexconnAppSecret = process.env.NEXCONN_APP_SECRET;
const nexconnApiBase = process.env.NEXCONN_API_BASE;

const isSerpConfigured = Boolean(serpApiKey);
const isYouConfigured = Boolean(youApiKey);
const isNexconnConfigured = Boolean(nexconnAppKey && nexconnAppSecret && nexconnApiBase);

// Track 1 (SerpApi) mode resolution: LIVE whenever SerpApi key is configured!
const mode: 'LIVE' | 'SIMULATION' | 'REPLAY' = isSerpConfigured
  ? 'LIVE'
  : (process.env.APP_MODE === 'REPLAY' ? 'REPLAY' : 'SIMULATION');

export const config: ServerConfig = {
  port: Number(process.env.PORT) || 3000,
  environment: (process.env.NODE_ENV as any) || 'development',
  databasePath: process.env.DATABASE_PATH || path.resolve(process.cwd(), 'officepact.sqlite3'),
  serpApi: {
    apiKey: serpApiKey,
    isConfigured: isSerpConfigured,
  },
  youCom: {
    apiKey: youApiKey,
    isConfigured: isYouConfigured,
  },
  nexconn: {
    appKey: nexconnAppKey,
    appSecret: nexconnAppSecret,
    apiBase: nexconnApiBase,
    isConfigured: isNexconnConfigured,
  },
  mode,
  budget: {
    researchCap: 40,
    devPoolCeiling: 50,
    plannedMaxSpend: 240,
    untouchedReserve: 260,
    totalAccountBudget: 500,
  },
};
