import { Request, Response, NextFunction } from 'express';

export interface RateLimitOptions {
  windowMs: number; // Duration of the rate limit window in milliseconds
  max: number; // Max number of connections/requests per window
  message?: string;
}

export interface RateLimiterInstance {
  (req: Request, res: Response, next: NextFunction): void;
  reset: () => void;
  getHitCount: (key: string) => number;
}

/**
 * Creates an in-memory sliding-window rate limiter middleware.
 */
export function createRateLimiter(options: RateLimitOptions): RateLimiterInstance {
  const { windowMs, max, message = 'Too many requests. Please try again later.' } = options;
  const hits = new Map<string, number[]>();

  // Periodic pruning of expired window records
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits.entries()) {
      const active = timestamps.filter((t) => now - t < windowMs);
      if (active.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, active);
      }
    }
  }, windowMs);
  timer.unref();

  const middleware: any = (req: Request, res: Response, next: NextFunction) => {
    const rawIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    const key = rawIp;
    const now = Date.now();

    const currentTimestamps = hits.get(key) || [];
    const recent = currentTimestamps.filter((t) => now - t < windowMs);

    res.setHeader('X-RateLimit-Limit', String(max));

    if (recent.length >= max) {
      const oldest = recent[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(Math.ceil((oldest + windowMs) / 1000)));

      res.status(429).json({
        error: message,
        retryAfter: retryAfterSeconds,
      });
      return;
    }

    recent.push(now);
    hits.set(key, recent);

    res.setHeader('X-RateLimit-Remaining', String(max - recent.length));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil((recent[0] + windowMs) / 1000)));
    next();
  };

  middleware.reset = () => {
    hits.clear();
  };

  middleware.getHitCount = (key: string) => {
    const current = hits.get(key) || [];
    const now = Date.now();
    return current.filter((t) => now - t < windowMs).length;
  };

  return middleware as RateLimiterInstance;
}

/**
 * Standard write endpoint rate limiter: 60 write operations per minute per IP.
 */
export const writeRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Write rate limit exceeded. Please wait before submitting additional changes.',
});
