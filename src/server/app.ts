import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { getCreditUsage, getDb } from './db.js';
import { WorkerManager } from './worker.js';
import { SerpApiProvider } from './providers/serpapi.js';
import { YouProvider } from './providers/you.js';
import { NexconnProvider } from './providers/nexconn.js';
import { pactsRouter } from './routes/pacts.js';
import { venuesRouter } from './routes/venues.js';
import { sessionRouter } from './routes/session.js';
import { chatRouter } from './routes/chat.js';
import { simulationRouter } from './routes/simulation.js';
import { receiptsRouter } from './routes/receipts.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../../dist/client');

export const app = express();

app.use(cors());
app.use(express.json());

// Domain API routes
app.use('/api/pacts', pactsRouter);
app.use('/api/venues', venuesRouter);
app.use('/api/session', sessionRouter);
app.use('/api/chat', chatRouter);
app.use('/api/simulation', simulationRouter);
app.use('/api/receipts', receiptsRouter);

// Health & Status endpoint
app.get('/api/health', (_req, res) => {
  const db = getDb();
  const pactCountRow = db.prepare('SELECT COUNT(*) as count FROM pacts').get() as { count: number };
  const creditUsage = getCreditUsage();

  const serpStatus = SerpApiProvider.getStatus();
  const youStatus = YouProvider.getStatus();
  const nexconnStatus = NexconnProvider.getStatus();

  const isDegraded = !serpStatus.configured || !youStatus.configured || !nexconnStatus.configured;

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
      nexconn: nexconnStatus,
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
