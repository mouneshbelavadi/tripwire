import crypto from 'node:crypto';
import { env } from './env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // NIST SP 800-38D recommended for GCM
const AUTH_TAG_LENGTH_BYTES = 16;

/**
 * Resolves a 32-byte encryption key from a Buffer or string (hex, base64, or 32 raw chars).
 */
export function resolveKey(keyInput?: string | Buffer): Buffer {
  const candidate = keyInput ?? env?.ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY;
  if (!candidate) {
    throw new Error('ENCRYPTION_KEY is not defined and no keyOverride provided');
  }

  if (Buffer.isBuffer(candidate)) {
    if (candidate.length !== 32) {
      throw new Error(`Invalid key Buffer length: expected 32 bytes, received ${candidate.length}`);
    }
    return candidate;
  }

  if (typeof candidate === 'string') {
    // 64 hex characters = 32 bytes
    if (candidate.length === 64 && /^[0-9a-fA-F]+$/.test(candidate)) {
      return Buffer.from(candidate, 'hex');
    }

    // Try base64 decoding
    try {
      const b64 = Buffer.from(candidate, 'base64');
      if (b64.length === 32) {
        return b64;
      }
    } catch {
      // not base64
    }

    // 32-character UTF-8 string = 32 bytes
    const utf8 = Buffer.from(candidate, 'utf8');
    if (utf8.length === 32) {
      return utf8;
    }
  }

  throw new Error('Invalid encryption key: must be exactly 32 bytes (64 hex characters, base64-encoded 32 bytes, or 32-character string)');
}

/**
 * Encrypts a UTF-8 plaintext string using AES-256-GCM.
 * Returns payload in the format: `iv:authTag:ciphertext` (all hex encoded).
 */
export function encrypt(plaintext: string, keyOverride?: string | Buffer): string {
  const key = resolveKey(keyOverride);
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts an AES-256-GCM encrypted payload (`iv:authTag:ciphertext`).
 * Verifies authentication tag and rejects tampering.
 */
export function decrypt(encryptedPayload: string, keyOverride?: string | Buffer): string {
  if (typeof encryptedPayload !== 'string' || !encryptedPayload) {
    throw new Error('Encrypted payload must be a non-empty string');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted payload: expected format "iv:authTag:ciphertext"');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  if (!ivHex || !authTagHex) {
    throw new Error('Malformed encrypted payload: missing IV or authTag');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  if (iv.length !== IV_LENGTH_BYTES) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH_BYTES} bytes, received ${iv.length}`);
  }

  if (authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH_BYTES} bytes, received ${authTag.length}`);
  }

  const key = resolveKey(keyOverride);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  });

  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (err) {
    throw new Error(`Authentication error: payload tampering or invalid key (${(err as Error).message})`);
  }
}

/**
 * Helper to round latitude and longitude to 2 decimal places (approx 1 km precision)
 * in accordance with Tripwire privacy requirements.
 */
export function roundCoordinate(val: number): number {
  return Math.round(val * 100) / 100;
}

/**
 * Encrypts geographic coordinates after rounding to 2 decimal places.
 */
export function encryptCoords(lat: number, lon: number, keyOverride?: string | Buffer): string {
  const roundedLat = roundCoordinate(lat);
  const roundedLon = roundCoordinate(lon);
  const payload = JSON.stringify({ lat: roundedLat, lon: roundedLon });
  return encrypt(payload, keyOverride);
}

/**
 * Decrypts geographic coordinates from encrypted payload.
 */
export function decryptCoords(encryptedPayload: string, keyOverride?: string | Buffer): { lat: number; lon: number } {
  const decrypted = decrypt(encryptedPayload, keyOverride);
  try {
    const parsed = JSON.parse(decrypted);
    if (typeof parsed.lat !== 'number' || typeof parsed.lon !== 'number') {
      throw new Error('Coordinates payload does not contain numeric lat and lon');
    }
    return { lat: parsed.lat, lon: parsed.lon };
  } catch (err) {
    throw new Error(`Failed to parse decrypted coordinates: ${(err as Error).message}`);
  }
}
