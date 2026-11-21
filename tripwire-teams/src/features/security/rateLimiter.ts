/**
 * In-Memory Sliding Window Rate Limiter
 *
 * Enforces per-user rate limiting on Slack slash commands (e.g. max 10 commands per minute)
 * to prevent command spam, abuse, and upstream API quota exhaustion.
 */

export interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  totalInWindow: number;
  retryAfterSeconds: number;
}

export class RateLimitExceededError extends Error {
  public readonly userId: string;
  public readonly retryAfterSeconds: number;
  public readonly limit: number;
  public readonly windowMs: number;

  constructor(userId: string, retryAfterSeconds: number, limit: number, windowMs: number) {
    super(
      `Rate limit exceeded for user ${userId}. Maximum ${limit} requests per ${windowMs / 1000}s allowed. Try again in ${retryAfterSeconds}s.`
    );
    this.name = 'RateLimitExceededError';
    this.userId = userId;
    this.retryAfterSeconds = retryAfterSeconds;
    this.limit = limit;
    this.windowMs = windowMs;
    Object.setPrototypeOf(this, RateLimitExceededError.prototype);
  }
}

export class SlidingWindowRateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly requestLog: Map<string, number[]> = new Map();

  constructor(options: RateLimiterOptions = {}) {
    this.windowMs = options.windowMs ?? 60_000; // 1 minute default
    this.maxRequests = options.maxRequests ?? 10; // 10 commands default
  }

  /**
   * Evaluates if a request from userId is permitted under the sliding window.
   * If permitted, records the timestamp and decrements remaining quota.
   */
  public check(userId: string, now = Date.now()): RateLimitResult {
    if (!userId || typeof userId !== 'string') {
      throw new Error('RateLimiter error: userId is required');
    }

    const windowStart = now - this.windowMs;
    const timestamps = this.requestLog.get(userId) ?? [];

    // Filter out timestamps outside the current sliding window
    const activeTimestamps = timestamps.filter((t) => t > windowStart);

    if (activeTimestamps.length >= this.maxRequests) {
      // Oldest timestamp determines when the first slot frees up
      const oldestTimestamp = activeTimestamps[0];
      const resetMs = Math.max(0, oldestTimestamp + this.windowMs - now);
      const retryAfterSeconds = Math.ceil(resetMs / 1000);

      // Keep active list clean in memory
      this.requestLog.set(userId, activeTimestamps);

      return {
        allowed: false,
        remaining: 0,
        resetMs,
        totalInWindow: activeTimestamps.length,
        retryAfterSeconds,
      };
    }

    // Request is allowed: record timestamp
    activeTimestamps.push(now);
    this.requestLog.set(userId, activeTimestamps);

    const remaining = Math.max(0, this.maxRequests - activeTimestamps.length);
    const oldestTimestamp = activeTimestamps[0];
    const resetMs = Math.max(0, oldestTimestamp + this.windowMs - now);

    return {
      allowed: true,
      remaining,
      resetMs,
      totalInWindow: activeTimestamps.length,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Asserts that a user has not exceeded the rate limit.
   * Throws RateLimitExceededError if rate limited.
   */
  public assertNotRateLimited(userId: string, now = Date.now()): RateLimitResult {
    const result = this.check(userId, now);
    if (!result.allowed) {
      throw new RateLimitExceededError(
        userId,
        result.retryAfterSeconds,
        this.maxRequests,
        this.windowMs
      );
    }
    return result;
  }

  /**
   * Resets rate limit records for a specific user or all users.
   */
  public reset(userId?: string): void {
    if (userId) {
      this.requestLog.delete(userId);
    } else {
      this.requestLog.clear();
    }
  }

  /**
   * Inspects recorded timestamps for a user.
   */
  public getUserHistory(userId: string): number[] {
    return [...(this.requestLog.get(userId) ?? [])];
  }

  /**
   * Garbage-collects stale user histories older than windowMs to prevent memory leak.
   */
  public cleanupExpired(now = Date.now()): number {
    const windowStart = now - this.windowMs;
    let evictedUsers = 0;

    for (const [userId, timestamps] of this.requestLog.entries()) {
      const active = timestamps.filter((t) => t > windowStart);
      if (active.length === 0) {
        this.requestLog.delete(userId);
        evictedUsers++;
      } else {
        this.requestLog.set(userId, active);
      }
    }

    return evictedUsers;
  }
}

// Global default limiter instance for slash commands (10 commands per minute)
export const slashCommandRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
});

/**
 * Convenience helper to check slash command rate limit for a user.
 */
export function checkSlashCommandRateLimit(userId: string): RateLimitResult {
  return slashCommandRateLimiter.check(userId);
}

/**
 * Convenience helper that throws RateLimitExceededError if slash command limit reached.
 */
export function assertSlashCommandNotRateLimited(userId: string): RateLimitResult {
  return slashCommandRateLimiter.assertNotRateLimited(userId);
}

/**
 * Convenience helper to reset all slash command limits.
 */
export function resetSlashCommandRateLimits(userId?: string): void {
  slashCommandRateLimiter.reset(userId);
}
