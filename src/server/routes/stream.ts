import { Router } from 'express';
import { eventBus, type AppEvent } from '../domain/eventBus.js';

export const streamRouter = Router();

// GET /api/stream - Server-Sent Events endpoint
streamRouter.get('/', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  // Initial connection acknowledgement event
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Event listener for AppEvents from the domain EventBus
  const onEvent = (event: AppEvent) => {
    try {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
    } catch {
      // Stream could be closed
    }
  };

  const unsubscribe = eventBus.onEvent(onEvent);

  // Keep connection open with regular heartbeat comments
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeatTimer);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    unsubscribe();
  });
});
