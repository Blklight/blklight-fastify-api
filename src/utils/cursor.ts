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

export type FeedSort = 'recent' | 'popular';

export type FeedCursorData =
  | { sort: 'recent'; publishedAt: Date; id: string; legacy: boolean }
  | { sort: 'popular'; likesCount: number; id: string; legacy: boolean };

/**
 * Encode a keyset cursor for the public feed.
 * Carries the sort mode so a page request can detect a cursor produced under a
 * different ordering instead of applying the wrong keyset.
 * @param sort - Ordering the cursor belongs to
 * @param value - publishedAt Date for 'recent', likesCount number for 'popular'
 * @param id - Last item's ID (tie-breaker)
 */
export function encodeFeedCursor(sort: FeedSort, value: Date | number, id: string): string {
  const data = sort === 'popular'
    ? { sort, likesCount: value, id }
    : { sort, publishedAt: (value as Date).toISOString(), id };
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

/**
 * Decode a public-feed keyset cursor.
 * Legacy cursors emitted before keyset support (`{ timestamp, id }`, no sort) are
 * read as sort='recent' so already-issued cursors stay valid. Anything else is
 * rejected with ValidationError.
 * @param cursor - Base64-encoded cursor string
 * @throws ValidationError if the cursor is malformed or has an unknown shape
 */
export function decodeFeedCursor(cursor: string): FeedCursorData {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));

    if (parsed.sort === 'recent' && parsed.publishedAt && parsed.id) {
      const publishedAt = new Date(parsed.publishedAt);
      if (Number.isNaN(publishedAt.getTime())) {
        throw new ValidationError('Invalid cursor format');
      }
      return { sort: 'recent', publishedAt, id: parsed.id, legacy: false };
    }

    if (parsed.sort === 'popular' && typeof parsed.likesCount === 'number' && parsed.id) {
      return { sort: 'popular', likesCount: parsed.likesCount, id: parsed.id, legacy: false };
    }

    if (parsed.timestamp && parsed.id) {
      const publishedAt = new Date(parsed.timestamp);
      if (Number.isNaN(publishedAt.getTime())) {
        throw new ValidationError('Invalid cursor format');
      }
      return { sort: 'recent', publishedAt, id: parsed.id, legacy: true };
    }

    throw new ValidationError('Invalid cursor format');
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Malformed cursor');
  }
}
