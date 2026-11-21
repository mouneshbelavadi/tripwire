import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  encrypt,
  decrypt,
  resolveKey,
  roundCoordinate,
  encryptCoords,
  decryptCoords,
} from './encryption.js';

describe('AES-256-GCM Encryption Module', () => {
  const sampleText = 'Tripwire sensitive location payload: 12.9352, 77.6245';
  const customHexKey = crypto.randomBytes(32).toString('hex');
  const customBase64Key = crypto.randomBytes(32).toString('base64');
  const customBufferKey = crypto.randomBytes(32);

  describe('Key Resolution', () => {
    it('resolves 64-character hex key to 32 bytes', () => {
      const keyBuf = resolveKey(customHexKey);
      expect(keyBuf).toBeInstanceOf(Buffer);
      expect(keyBuf.length).toBe(32);
    });

    it('resolves base64 key to 32 bytes', () => {
      const keyBuf = resolveKey(customBase64Key);
      expect(keyBuf).toBeInstanceOf(Buffer);
      expect(keyBuf.length).toBe(32);
    });

    it('accepts raw 32-byte Buffer', () => {
      const keyBuf = resolveKey(customBufferKey);
      expect(keyBuf).toBe(customBufferKey);
      expect(keyBuf.length).toBe(32);
    });

    it('falls back to environment ENCRYPTION_KEY', () => {
      const keyBuf = resolveKey();
      expect(keyBuf).toBeInstanceOf(Buffer);
      expect(keyBuf.length).toBe(32);
    });

    it('throws on invalid key lengths or formats', () => {
      expect(() => resolveKey('too-short-key')).toThrow(/Invalid encryption key/);
      expect(() => resolveKey(Buffer.from('short'))).toThrow(/Invalid key Buffer length/);
    });
  });

  describe('Roundtrip Encryption & Decryption', () => {
    it('roundtrip encrypt then decrypt matches original string with default env key', () => {
      const encrypted = encrypt(sampleText);
      expect(encrypted).not.toBe(sampleText);
      expect(encrypted.split(':').length).toBe(3);

      const decrypted = decrypt(encrypted);
      expect(decrypted).toBe(sampleText);
    });

    it('roundtrip with custom hex key matches original string', () => {
      const encrypted = encrypt(sampleText, customHexKey);
      const decrypted = decrypt(encrypted, customHexKey);
      expect(decrypted).toBe(sampleText);
    });

    it('roundtrip with custom base64 key matches original string', () => {
      const encrypted = encrypt(sampleText, customBase64Key);
      const decrypted = decrypt(encrypted, customBase64Key);
      expect(decrypted).toBe(sampleText);
    });

    it('roundtrip with custom buffer key matches original string', () => {
      const encrypted = encrypt(sampleText, customBufferKey);
      const decrypted = decrypt(encrypted, customBufferKey);
      expect(decrypted).toBe(sampleText);
    });

    it('handles empty string and unicode characters', () => {
      const emptyEncrypted = encrypt('');
      expect(decrypt(emptyEncrypted)).toBe('');

      const unicodeText = 'Bengaluru Outer Ring Road 🌧️ 🚗 12.92° N, 77.68° E';
      const unicodeEncrypted = encrypt(unicodeText);
      expect(decrypt(unicodeEncrypted)).toBe(unicodeText);
    });
  });

  describe('Tampering and Authentication Error Detection', () => {
    it('tampered ciphertext throws authentication error', () => {
      const encrypted = encrypt(sampleText);
      const [iv, tag, ciphertext] = encrypted.split(':');

      // Tamper ciphertext by changing the last character
      const tamperedCiphertext =
        ciphertext.slice(0, -1) + (ciphertext.slice(-1) === 'a' ? 'b' : 'a');
      const tamperedPayload = `${iv}:${tag}:${tamperedCiphertext}`;

      expect(() => decrypt(tamperedPayload)).toThrow(/Authentication error/);
    });

    it('tampered authentication tag throws authentication error', () => {
      const encrypted = encrypt(sampleText);
      const [iv, tag, ciphertext] = encrypted.split(':');

      // Tamper auth tag
      const tamperedTag = (tag[0] === '0' ? '1' : '0') + tag.slice(1);
      const tamperedPayload = `${iv}:${tamperedTag}:${ciphertext}`;

      expect(() => decrypt(tamperedPayload)).toThrow(/Authentication error/);
    });

    it('tampered IV throws authentication error or invalid length', () => {
      const encrypted = encrypt(sampleText);
      const [iv, tag, ciphertext] = encrypted.split(':');

      // Tamper IV by modifying byte
      const tamperedIv = (iv[0] === '0' ? '1' : '0') + iv.slice(1);
      const tamperedPayload = `${tamperedIv}:${tag}:${ciphertext}`;

      expect(() => decrypt(tamperedPayload)).toThrow(/Authentication error/);
    });

    it('rejects decryption with a different key', () => {
      const otherKey = crypto.randomBytes(32).toString('hex');
      const encrypted = encrypt(sampleText, customHexKey);
      expect(() => decrypt(encrypted, otherKey)).toThrow(/Authentication error/);
    });

    it('rejects malformed payload strings', () => {
      expect(() => decrypt('not-a-valid-payload')).toThrow(/Malformed encrypted payload/);
      expect(() => decrypt('part1:part2')).toThrow(/Malformed encrypted payload/);
      expect(() => decrypt('')).toThrow(/non-empty string/);
    });
  });

  describe('Random IV Generation (NIST SP 800-38D)', () => {
    it('generates distinct IVs and distinct ciphertexts per encryption of identical plaintext', () => {
      const enc1 = encrypt(sampleText);
      const enc2 = encrypt(sampleText);
      const enc3 = encrypt(sampleText);

      expect(enc1).not.toBe(enc2);
      expect(enc2).not.toBe(enc3);

      const [iv1] = enc1.split(':');
      const [iv2] = enc2.split(':');
      const [iv3] = enc3.split(':');

      expect(iv1).not.toBe(iv2);
      expect(iv2).not.toBe(iv3);
      expect(iv1).not.toBe(iv3);

      // Verify all decrypt back to the same plaintext
      expect(decrypt(enc1)).toBe(sampleText);
      expect(decrypt(enc2)).toBe(sampleText);
      expect(decrypt(enc3)).toBe(sampleText);
    });
  });

  describe('Coordinate Privacy Helpers', () => {
    it('rounds coordinates to 2 decimal places (approx 1 km)', () => {
      expect(roundCoordinate(12.93524)).toBe(12.94);
      expect(roundCoordinate(77.62449)).toBe(77.62);
      expect(roundCoordinate(12.0)).toBe(12.0);
    });

    it('encryptCoords rounds and encrypts, and decryptCoords restores rounded coordinates', () => {
      const rawLat = 12.9348123;
      const rawLon = 77.6183921;

      const encrypted = encryptCoords(rawLat, rawLon);
      const coords = decryptCoords(encrypted);

      expect(coords.lat).toBe(12.93);
      expect(coords.lon).toBe(77.62);
    });
  });
});
