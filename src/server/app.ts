import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { getCreditUsage, getDb } from './db.js';
import { WorkerManager } from './worker.js';
import { SerpApiProvider } from './providers/serpapi.js';
import { YouProvider } from './providers/you.js';
import { TeamChannelProvider } from './providers/teamChannel.js';
import { pactsRouter } from './routes/pacts.js';
import { venuesRouter } from './routes/venues.js';
import { placesRouter } from './routes/places.js';
import { sessionRouter } from './routes/session.js';
import { chatRouter } from './routes/chat.js';
import { simulationRouter } from './routes/simulation.js';
import { receiptsRouter } from './routes/receipts.js';
import { streamRouter } from './routes/stream.js';
import { alertsRouter } from './routes/alerts.js';
import { usageRouter } from './routes/usage.js';
import { notificationsRouter } from './routes/notifications.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../../dist/client');

export const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors());
app.use(express.json());

// Domain API routes
app.use('/api/pacts', pactsRouter);
app.use('/api/venues', venuesRouter);
app.use('/api/places', placesRouter);
app.use('/api/session', sessionRouter);
app.use('/api/chat', chatRouter);
app.use('/api/simulation', simulationRouter);
app.use('/api/receipts', receiptsRouter);
app.use('/api/stream', streamRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/usage', usageRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);

// Health & Status endpoint
app.get('/api/health', (_req, res) => {
  const db = getDb();
  const pactCountRow = db.prepare('SELECT COUNT(*) as count FROM pacts').get() as { count: number };
  const creditUsage = getCreditUsage();

  const serpStatus = SerpApiProvider.getStatus();
  const youStatus = YouProvider.getStatus();
  const teamChannelStatus = TeamChannelProvider.getStatus();

  const isDegraded = !serpStatus.configured;

  res.json({
    status: isDegraded ? 'degraded' : 'ok',
    mode: config.mode,
    timestamp: new Date().toISOString(),
    worker: WorkerManager.getStatus(),
    budget: {
      researchCeiling: config.budget.researchCap,
      researchSpent: creditUsage.researchSpent,
      plannedMaxSpend: config.budget.plannedMaxSpend,
      untouchedReserve: config.budget.untouchedReserve,
      totalAccountBudget: config.budget.totalAccountBudget,
    },
    providers: {
      serpapi: serpStatus,
      you: youStatus,
      teamChannel: teamChannelStatus,
    },
    activePactsCount: pactCountRow ? Number(pactCountRow.count) : 0,
  });
});

// Serve static client bundle if it exists
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}
