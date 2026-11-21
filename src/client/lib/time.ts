/**
 * Time utility library for Tripwire: Office Pact.
 * All user-facing times must be formatted in Indian Standard Time (IST, UTC+5:30).
 */

export type DeadlineStatus = 'upcoming' | 'closing_soon' | 'expired';

/**
 * Formats an ISO string, epoch number, or Date into standard IST time: "HH:mm:ss IST" or "HH:mm IST".
 */
export function formatIstTime(
  timestamp?: string | number | Date | null,
  includeSeconds: boolean = true
): string {
  if (!timestamp) return '— IST';

  try {
    const date =
      typeof timestamp === 'number'
        ? new Date(timestamp > 1e11 ? timestamp : timestamp * 1000)
        : new Date(timestamp);

    if (isNaN(date.getTime())) {
      return String(timestamp);
    }

    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      ...(includeSeconds ? { second: '2-digit' } : {}),
      hour12: false,
    };

    return new Intl.DateTimeFormat('en-IN', options).format(date) + ' IST';
  } catch (err) {
    return '— IST';
  }
}

/**
 * Formats a short IST timestamp e.g. "08:50 IST".
 */
export function formatIstShort(timestamp?: string | number | Date | null): string {
  return formatIstTime(timestamp, false);
}

/**
 * Alias for formatIstShort / formatIstTime
 */
export function formatTimeIST(timestamp?: string | number | Date | null): string {
  return formatIstShort(timestamp);
}

/**
 * Formats a timestamp into full date and time in IST:
 * e.g. "21 Nov 2026, 08:50 IST"
 */
export function formatIstDateTime(
  timestamp?: string | number | Date | null,
  includeSeconds: boolean = false
): string {
  if (!timestamp) return '— IST';
  try {
    const date =
      typeof timestamp === 'number'
        ? new Date(timestamp > 1e11 ? timestamp : timestamp * 1000)
        : new Date(timestamp);

    if (isNaN(date.getTime())) return String(timestamp);

    const dateOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    };
    const timeOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      ...(includeSeconds ? { second: '2-digit' } : {}),
      hour12: false,
    };

    const datePart = new Intl.DateTimeFormat('en-GB', dateOptions).format(date);
    const timePart = new Intl.DateTimeFormat('en-IN', timeOptions).format(date);
    return `${datePart}, ${timePart} IST`;
  } catch {
    return '— IST';
  }
}

export function formatDateTimeIST(
  timestamp?: string | number | Date | null,
  includeSeconds: boolean = false
): string {
  return formatIstDateTime(timestamp, includeSeconds);
}

/**
 * Formats relative age string e.g. "2m ago", "just now", "12m ago"
 */
export function formatRelativeAge(
  timestamp?: string | number | Date | null,
  now: Date = new Date()
): string {
  if (!timestamp) return '—';

  try {
    const epochMs =
      typeof timestamp === 'number'
        ? timestamp > 1e11
          ? timestamp
          : timestamp * 1000
        : new Date(timestamp).getTime();

    if (isNaN(epochMs)) return '—';

    const diffSeconds = Math.max(0, Math.floor((now.getTime() - epochMs) / 1000));
    if (diffSeconds < 45) return 'just now';
    if (diffSeconds < 90) return '1m ago';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return `${Math.floor(diffSeconds / 86400)}d ago`;
  } catch {
    return '—';
  }
}

/**
 * Computes deadline status ('upcoming', 'closing_soon', 'expired') relative to now.
 * Invariants:
 * - 'expired': now >= deadline (deadline passed)
 * - 'closing_soon': deadline - now < 30 minutes (1800s)
 * - 'upcoming': deadline - now >= 30 minutes
 */
export function getDeadlineStatus(
  deadlineUtc?: string | number | Date | null,
  nowInput: string | number | Date = new Date(),
  closingSoonWindowSeconds = 1800
): DeadlineStatus {
  if (!deadlineUtc) return 'upcoming';

  const parseMs = (val: string | number | Date): number => {
    if (typeof val === 'number') {
      return val > 1e11 ? val : val * 1000;
    }
    if (val instanceof Date) {
      return val.getTime();
    }
    const ms = Date.parse(val);
    return isNaN(ms) ? NaN : ms;
  };

  const deadlineMs = parseMs(deadlineUtc);
  if (isNaN(deadlineMs)) return 'upcoming';

  const nowMs = parseMs(nowInput);
  if (isNaN(nowMs)) return 'upcoming';

  const diffMs = deadlineMs - nowMs;
  if (diffMs <= 0) return 'expired';
  if (diffMs < closingSoonWindowSeconds * 1000) return 'closing_soon';
  return 'upcoming';
}

/**
 * Returns a human-friendly display for deadline.
 * If expired, returns "Deadline passed".
 */
export function formatDeadlineDisplay(
  deadlineUtc?: string | number | Date | null,
  now: Date = new Date()
): string {
  if (!deadlineUtc) return '—';
  if (getDeadlineStatus(deadlineUtc, now) === 'expired') {
    return 'Deadline passed';
  }
  return formatIstShort(deadlineUtc);
}

/**
 * Formats relative age / freshness:
 * e.g. "fresh (18s ago)", "1m ago", "12m ago (stale)"
 */
export function formatFreshness(
  timestamp?: string | number | Date | null,
  maxAgeSeconds: number = 300
): { text: string; isFresh: boolean; ageSeconds: number } {
  if (!timestamp) {
    return { text: 'Unknown', isFresh: false, ageSeconds: Infinity };
  }

  try {
    const epochMs =
      typeof timestamp === 'number'
        ? timestamp > 1e11
          ? timestamp
          : timestamp * 1000
        : new Date(timestamp).getTime();

    if (isNaN(epochMs)) {
      return { text: 'Invalid time', isFresh: false, ageSeconds: Infinity };
    }

    const ageSeconds = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
    const isFresh = ageSeconds <= maxAgeSeconds;

    let text: string;
    if (ageSeconds < 60) {
      text = `${ageSeconds}s ago`;
    } else if (ageSeconds < 3600) {
      const minutes = Math.floor(ageSeconds / 60);
      text = `${minutes}m ago`;
    } else {
      const hours = Math.floor(ageSeconds / 3600);
      text = `${hours}h ago`;
    }

    if (isFresh) {
      text = `${text} · fresh`;
    } else {
      text = `${text} · stale`;
    }

    return { text, isFresh, ageSeconds };
  } catch {
    return { text: 'Unknown', isFresh: false, ageSeconds: Infinity };
  }
}

/**
 * Returns true if the timestamp exceeds the max allowed freshness window (default 5 minutes / 300s).
 */
export function isDataStale(
  timestamp?: string | number | Date | null,
  maxAgeSeconds: number = 300
): boolean {
  if (!timestamp) return true;
  const { isFresh } = formatFreshness(timestamp, maxAgeSeconds);
  return !isFresh;
}

/**
 * Calculates human-readable margin relative to threshold:
 * e.g., duration 68m, limit 60m -> "+8m over"
 * e.g., duration 42m, limit 60m -> "-18m under"
 */
export function formatMargin(durationMinutes: number, limitMinutes: number): {
  text: string;
  isBreach: boolean;
  isRecoveryBand: boolean;
  diffMinutes: number;
} {
  const diff = durationMinutes - limitMinutes;
  const isBreach = diff > 0;
  // Recovery band is between (limit - 5m) and limit (e.g. 55m to 60m)
  const isRecoveryBand = diff <= 0 && diff >= -5;

  let text = '';
  if (diff > 0) {
    text = `+${diff}m over`;
  } else if (diff < 0) {
    text = `${diff}m under`; // e.g. "-12m under"
  } else {
    text = '0m at limit';
  }

  return {
    text,
    isBreach,
    isRecoveryBand,
    diffMinutes: diff,
  };
}
