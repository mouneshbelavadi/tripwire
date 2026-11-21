/**
 * Log Scrubber & Output Sanitizer
 *
 * Strips secrets, Slack tokens, Google API keys, OAuth tokens,
 * and masks GPS coordinates and email addresses from all logs and outputs.
 * Enforces Rule 8: "Never log secrets, tokens or coordinates."
 */

export const REDACTION_LABELS = {
  SLACK_TOKEN: '[SLACK_TOKEN_REDACTED]',
  GOOGLE_API_KEY: '[GOOGLE_API_KEY_REDACTED]',
  OAUTH_TOKEN: '[OAUTH_TOKEN_REDACTED]',
  BEARER_TOKEN: 'Bearer [OAUTH_TOKEN_REDACTED]',
  JWT_TOKEN: '[JWT_TOKEN_REDACTED]',
  COORDINATES: '[COORDINATES_REDACTED]',
  COORDINATE: '[COORDINATE_REDACTED]',
  EMAIL: '[EMAIL_REDACTED]',
  SECRET: '[SECRET_REDACTED]',
} as const;

// Patterns for strings
const SLACK_TOKEN_PATTERN = /(?:xox[bpare]|xapp)-[0-9a-zA-Z-]{10,}/g;
const GOOGLE_API_KEY_PATTERN = /AIza[0-9A-Za-z-_]{35}/g;
const GOOGLE_OAUTH_TOKEN_PATTERN = /ya29\.[0-9A-Za-z-_]{20,}/g;
const BEARER_AUTH_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const JWT_PATTERN = /ey[A-Za-z0-9_-]{10,}\.ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const EMAIL_PATTERN = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;

// Coordinate pair patterns (e.g. "12.9716, 77.5946", "(12.971598, 77.594562)", "-33.8688, 151.2093")
const COORD_PAIR_PATTERN = /[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?)\s*,\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)/g;

// Key-value coordinate representations (e.g. "lat: 12.9716", "latitude: 12.9716", "lng: 77.5946", "lon: 77.5946")
const LAT_KEY_PATTERN = /(["']?(?:lat|latitude|origin_lat|home_lat|destination_lat)["']?\s*[:=]\s*)[-+]?\d{1,3}(?:\.\d+)?/gi;
const LON_KEY_PATTERN = /(["']?(?:lon|lng|longitude|origin_lon|home_lon|destination_lon)["']?\s*[:=]\s*)[-+]?\d{1,3}(?:\.\d+)?/gi;

// Sensitive object key patterns (checked case-insensitively)
const SENSITIVE_KEY_PATTERN = /(?:password|secret|token|api_key|client_secret|authorization|auth)/i;
const COORDINATE_KEY_PATTERN = /(?:lat|latitude|lon|lng|longitude|coord|coords|coordinates)/i;
const EMAIL_KEY_PATTERN = /(?:email)/i;

/**
 * Scrubs a single string by masking all sensitive tokens, coordinates, and emails.
 */
export function scrubString(input: string): string {
  if (typeof input !== 'string') {
    return input;
  }

  let scrubbed = input;

  // 1. Scrub Slack tokens (xoxb-, xapp-, xoxp-, xoxr-, xoxe-)
  scrubbed = scrubbed.replace(SLACK_TOKEN_PATTERN, REDACTION_LABELS.SLACK_TOKEN);

  // 2. Scrub Google API keys (AIza...)
  scrubbed = scrubbed.replace(GOOGLE_API_KEY_PATTERN, REDACTION_LABELS.GOOGLE_API_KEY);

  // 3. Scrub Google OAuth tokens (ya29....)
  scrubbed = scrubbed.replace(GOOGLE_OAUTH_TOKEN_PATTERN, REDACTION_LABELS.OAUTH_TOKEN);

  // 4. Scrub Bearer auth headers
  scrubbed = scrubbed.replace(BEARER_AUTH_PATTERN, REDACTION_LABELS.BEARER_TOKEN);

  // 5. Scrub JWT tokens
  scrubbed = scrubbed.replace(JWT_PATTERN, REDACTION_LABELS.JWT_TOKEN);

  // 6. Scrub key-value coordinate declarations in strings
  scrubbed = scrubbed.replace(LAT_KEY_PATTERN, `$1${REDACTION_LABELS.COORDINATE}`);
  scrubbed = scrubbed.replace(LON_KEY_PATTERN, `$1${REDACTION_LABELS.COORDINATE}`);

  // 7. Scrub coordinate pairs in strings (e.g. 12.9716, 77.5946)
  scrubbed = scrubbed.replace(COORD_PAIR_PATTERN, (match) => {
    // Only scrub if at least one number has decimal places typical of GPS coordinates
    if (match.includes('.')) {
      return REDACTION_LABELS.COORDINATES;
    }
    return match;
  });

  // 8. Scrub user emails
  scrubbed = scrubbed.replace(EMAIL_PATTERN, REDACTION_LABELS.EMAIL);

  return scrubbed;
}

/**
 * Deeply scrubs any data structure (objects, arrays, errors, primitives).
 * Safely handles circular references.
 */
export function scrubObject<T>(input: T, seen = new WeakSet<object>()): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    return scrubString(input) as unknown as T;
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    return input;
  }

  if (typeof input === 'function') {
    return input;
  }

  if (typeof input === 'object') {
    if (seen.has(input as object)) {
      return '[Circular]' as unknown as T;
    }
    seen.add(input as object);

    // Handle Error instances
    if (input instanceof Error) {
      const scrubbedError = new Error(scrubString(input.message));
      scrubbedError.name = input.name;
      if (input.stack) {
        scrubbedError.stack = scrubString(input.stack);
      }
      return scrubbedError as unknown as T;
    }

    // Handle Dates, RegExps
    if (input instanceof Date || input instanceof RegExp) {
      return input;
    }

    // Handle Arrays
    if (Array.isArray(input)) {
      return input.map((item) => scrubObject(item, seen)) as unknown as T;
    }

    // Handle plain objects
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      // Check sensitive key names
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = REDACTION_LABELS.SECRET;
      } else if (COORDINATE_KEY_PATTERN.test(key)) {
        result[key] = REDACTION_LABELS.COORDINATE;
      } else if (EMAIL_KEY_PATTERN.test(key)) {
        result[key] = REDACTION_LABELS.EMAIL;
      } else {
        result[key] = scrubObject(value, seen);
      }
    }
    return result as unknown as T;
  }

  return input;
}

/**
 * Main sanitizer function that scrubs arguments passed to logger outputs.
 */
export function scrubLog(...args: unknown[]): unknown[] {
  return args.map((arg) => scrubObject(arg));
}

export interface LoggerInterface {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  log: (...args: any[]) => void;
}

/**
 * Wraps a logger (e.g. console) so that every emitted log is sanitized automatically.
 */
export function createScrubbedLogger(baseLogger: LoggerInterface = console): LoggerInterface {
  return {
    info: (...args: any[]) => baseLogger.info(...(scrubLog(...args) as any[])),
    warn: (...args: any[]) => baseLogger.warn(...(scrubLog(...args) as any[])),
    error: (...args: any[]) => baseLogger.error(...(scrubLog(...args) as any[])),
    debug: (...args: any[]) => baseLogger.debug(...(scrubLog(...args) as any[])),
    log: (...args: any[]) => baseLogger.log(...(scrubLog(...args) as any[])),
  };
}
