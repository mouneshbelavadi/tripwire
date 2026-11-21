import express, { Request, Response, NextFunction, Router, Application } from 'express';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolves the absolute path to the public landing page assets directory.
 * Robustly checks both compiled (dist) and source (src) locations.
 */
export function getLandingPublicDir(): string {
  const candidates = [
    path.resolve(__dirname, 'public'),
    path.resolve(__dirname, '../../src/landing/public'),
    path.resolve(process.cwd(), 'src/landing/public'),
    path.resolve(process.cwd(), 'dist/landing/public'),
    path.resolve(process.cwd(), 'public')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  // Fallback to local sibling 'public'
  return path.resolve(__dirname, 'public');
}

/**
 * Creates and configures the Express router for public landing pages.
 */
export function createLandingRouter(): Router {
  const router = Router();
  const publicDir = getLandingPublicDir();

  // Basic security and caching headers for public static assets
  router.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // Serve static assets (CSS, images, icons, scripts)
  router.use(express.static(publicDir, {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true
  }));

  // Route: GET /health
  router.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      service: 'tripwire-teams'
    });
  });

  // Route: GET / (Homepage)
  router.get('/', (_req: Request, res: Response) => {
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(200).send('<h1>Tripwire Teams</h1><p>Landing page initializing...</p>');
    }
  });

  // Route: GET /privacy (Privacy Policy)
  router.get('/privacy', (_req: Request, res: Response) => {
    const privacyPath = path.join(publicDir, 'privacy.html');
    if (fs.existsSync(privacyPath)) {
      res.sendFile(privacyPath);
    } else {
      res.status(404).send('<h1>Privacy Policy not found</h1>');
    }
  });

  // Route: GET /security (Security & Architecture)
  router.get('/security', (_req: Request, res: Response) => {
    const securityPath = path.join(publicDir, 'security.html');
    if (fs.existsSync(securityPath)) {
      res.sendFile(securityPath);
    } else {
      res.status(404).send('<h1>Security documentation not found</h1>');
    }
  });

  // Route: GET /slack/install (Slack App Installation Gateway)
  router.get('/slack/install', (_req: Request, res: Response) => {
    const clientId = process.env.SLACK_CLIENT_ID;
    const scopes = 'commands,chat:write,chat:write.public,channels:read,groups:read,im:write';
    
    if (clientId) {
      const redirectUrl = `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scopes)}`;
      res.redirect(redirectUrl);
    } else {
      res.status(200).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Install Tripwire Teams</title>
          <link rel="stylesheet" href="/style.css">
        </head>
        <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;">
          <div class="card" style="max-width:560px;width:100%;text-align:center;padding:40px;">
            <div style="font-size:40px;margin-bottom:16px;">⚡</div>
            <h1 style="font-size:24px;margin-bottom:12px;">Add Tripwire Teams to Slack</h1>
            <p style="color:#4B5563;margin-bottom:24px;line-height:1.6;">
              To install Tripwire into your Slack workspace, ensure your workspace admin has configured <code>SLACK_CLIENT_ID</code> or install via your custom Slack App Manifest.
            </p>
            <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;text-align:left;font-size:14px;color:#374151;margin-bottom:24px;">
              <strong>Quick Local Install:</strong>
              <ol style="margin-left:20px;margin-top:8px;line-height:1.6;">
                <li>Open your Slack App at <a href="https://api.slack.com/apps" target="_blank" style="color:#2563EB;">api.slack.com/apps</a></li>
                <li>Go to <strong>Install App</strong> and click <strong>Install to Workspace</strong></li>
                <li>Invite the bot to your channel using <code>/invite @Tripwire</code></li>
              </ol>
            </div>
            <a href="/" class="btn btn-secondary">← Back to Tripwire Home</a>
          </div>
        </body>
        </html>
      `);
    }
  });

  return router;
}

/**
 * Creates a standalone Express application for the landing page.
 */
export function createLandingApp(): Application {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/', createLandingRouter());
  return app;
}

/**
 * Starts the landing server on the specified port.
 */
export function startLandingServer(port: number = Number(process.env.PORT) || 3000) {
  const app = createLandingApp();
  const server = app.listen(port, () => {
    console.log(`[Tripwire Landing] Server running on http://localhost:${port}`);
    console.log(`[Tripwire Landing] Serving assets from: ${getLandingPublicDir()}`);
  });
  return server;
}

// Auto-run when executed directly via Node / tsx
const isDirectExecution = process.argv[1] && (
  pathToFileURL(process.argv[1]).href === import.meta.url ||
  process.argv[1].endsWith('server.ts') ||
  process.argv[1].endsWith('server.js')
);

if (isDirectExecution) {
  startLandingServer();
}

export const landingRouter = createLandingRouter();
export default createLandingApp;
