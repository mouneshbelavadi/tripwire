export interface QuotaTrackerOptions {
  maxDailyRequests?: number;
}

/**
 * Tracks daily Google Routes API requests to enforce a strict daily cap.
 * Defaults to process.env.ROUTES_DAILY_MAX_REQUESTS or 500 if unset.
 * Automatically resets count when day rolls over (UTC date YYYY-MM-DD).
 */
export class DailyQuotaTracker {
  private count = 0;
  private currentDay = '';
  private customLimit: number | null = null;

  constructor(options?: QuotaTrackerOptions) {
    if (options?.maxDailyRequests !== undefined) {
      this.customLimit = options.maxDailyRequests;
    }
    this.currentDay = this.getTodayDateString();
  }

  private getTodayDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private checkDayRollover(): void {
    const today = this.getTodayDateString();
    if (this.currentDay !== today) {
      this.currentDay = today;
      this.count = 0;
    }
  }

  public getDailyLimit(): number {
    if (this.customLimit !== null && this.customLimit !== undefined) {
      return this.customLimit;
    }
    const envVal = process.env.ROUTES_DAILY_MAX_REQUESTS;
    if (envVal !== undefined && envVal.trim() !== '') {
      const parsed = parseInt(envVal, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        return parsed;
      }
    }
    return 500;
  }

  public getCurrentCount(): number {
    this.checkDayRollover();
    return this.count;
  }

  public getRemainingQuota(): number {
    this.checkDayRollover();
    return Math.max(0, this.getDailyLimit() - this.count);
  }

  public canMakeRequest(cost = 1): boolean {
    this.checkDayRollover();
    return this.count + cost <= this.getDailyLimit();
  }

  /**
   * Attempts to consume quota units. Returns true if permitted, false if daily limit reached.
   */
  public consume(cost = 1): boolean {
    this.checkDayRollover();
    if (this.count + cost <= this.getDailyLimit()) {
      this.count += cost;
      return true;
    }
    return false;
  }

  public reset(): void {
    this.count = 0;
    this.currentDay = this.getTodayDateString();
  }

  public setLimit(limit: number | null): void {
    this.customLimit = limit;
  }
}

export const dailyQuota = new DailyQuotaTracker();
