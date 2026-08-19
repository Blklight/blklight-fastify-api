import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { profiles } from '../features/profiles/profiles.schema';
import { NotFoundError } from './errors';

/**
 * Resolve the profile ID for a given user ID.
 * @param userId - The user's ID (from JWT payload)
 * @returns The corresponding profile ID
 * @throws NotFoundError if no profile exists for this user
 */
export async function resolveProfileIdFromUserId(userId: string): Promise<string> {
  const [profile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!profile) {
    throw new NotFoundError('Profile not found');
  }

  return profile.id;
}
