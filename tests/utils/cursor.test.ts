import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor } from '../../src/utils/cursor';
import { ValidationError } from '../../src/utils/errors';

describe('cursor', () => {
  describe('encodeCursor', () => {
    it('encodeCursor returns base64 string', () => {
      const cursor = encodeCursor(new Date('2024-01-01T00:00:00.000Z'), 'abc123');
      expect(typeof cursor).toBe('string');
      expect(cursor.length).toBeGreaterThan(0);
    });
  });

  describe('decodeCursor', () => {
    it('decodeCursor reverses encodeCursor correctly', () => {
      const timestamp = new Date('2024-06-15T12:30:00.000Z');
      const id = 'doc_abc123';
      const encoded = encodeCursor(timestamp, id);
      const decoded = decodeCursor(encoded);
      expect(decoded.timestamp.toISOString()).toBe(timestamp.toISOString());
      expect(decoded.id).toBe(id);
    });

    it('decodeCursor malformed input throws ValidationError', () => {
      expect(() => decodeCursor('not-valid-base64!')).toThrow(ValidationError);
      expect(() => decodeCursor('')).toThrow(ValidationError);
    });

    it('encodeCursor + decodeCursor roundtrip preserves date and id', () => {
      const originalDate = new Date();
      const originalId = 'test-id-123';
      const encoded = encodeCursor(originalDate, originalId);
      const decoded = decodeCursor(encoded);
      expect(decoded.timestamp.getTime()).toBe(originalDate.getTime());
      expect(decoded.id).toBe(originalId);
    });
  });
});
