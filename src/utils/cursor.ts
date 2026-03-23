import { ValidationError } from './errors';

export interface CursorData {
  timestamp: Date;
  id: string;
}

/**
 * Encode a cursor from a timestamp and ID.
 * @param timestamp - The entity's timestamp
 * @param id - The entity's ID
 * @returns Base64-encoded JSON cursor string
 */
export function encodeCursor(timestamp: Date, id: string): string {
  const data = {
    timestamp: timestamp.toISOString(),
    id,
  };
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

/**
 * Decode a base64-encoded cursor string.
 * @param cursor - The base64-encoded cursor string
 * @returns Decoded object with timestamp (Date) and id (string)
 * @throws ValidationError if cursor is malformed
 */
export function decodeCursor(cursor: string): CursorData {
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf8');
    const parsed = JSON.parse(json);

    if (!parsed.timestamp || !parsed.id) {
      throw new ValidationError('Invalid cursor format');
    }

    return {
      timestamp: new Date(parsed.timestamp),
      id: parsed.id,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Malformed cursor');
  }
}
