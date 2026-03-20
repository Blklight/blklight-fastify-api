import { ValidationError } from './errors';

/**
 * Encode a cursor from published date and document ID.
 * @param publishedAt - The document's published timestamp
 * @param id - The document's ID
 * @returns Base64-encoded JSON cursor string
 */
export function encodeCursor(publishedAt: Date, id: string): string {
  const data = {
    publishedAt: publishedAt.toISOString(),
    id,
  };
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

/**
 * Decode a base64-encoded cursor string.
 * @param cursor - The base64-encoded cursor string
 * @returns Decoded object with publishedAt (Date) and id (string)
 * @throws ValidationError if cursor is malformed
 */
export function decodeCursor(cursor: string): { publishedAt: Date; id: string } {
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf8');
    const parsed = JSON.parse(json);

    if (!parsed.publishedAt || !parsed.id) {
      throw new ValidationError('Invalid cursor format');
    }

    return {
      publishedAt: new Date(parsed.publishedAt),
      id: parsed.id,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Malformed cursor');
  }
}
