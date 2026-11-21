import { app } from './app.js';
import { config } from './config.js';
import { getDb } from './db.js';
import { WorkerManager } from './worker.js';

// Initialize persistent SQLite database
const db = getDb();
console.log(`[Office Pact] SQLite initialized at: ${config.databasePath}`);

// Start persistent scheduler worker
WorkerManager.start();
console.log(`[Office Pact] Background worker started.`);

// Start Express server
const server = app.listen(config.port, () => {
  console.log(`[Office Pact] Server running at http://localhost:${config.port}`);
  console.log(`[Office Pact] Mode: ${config.mode}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n[Office Pact] Shutting down gracefully...');
  WorkerManager.stop();
  server.close(() => {
    try {
      db.close();
      console.log('[Office Pact] Database connection closed.');
    } catch (err) {
      // Ignore if already closed
    }
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
