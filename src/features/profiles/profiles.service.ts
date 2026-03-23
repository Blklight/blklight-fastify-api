import { eq, and, isNull, or, gt, ne } from 'drizzle-orm';
import { db } from '../../db/index';
import { users } from '../auth/auth.schema';
import { profiles } from './profiles.schema';
import { NotFoundError, ConflictError } from '../../utils/errors';
import type { UpdateProfileInput } from './profiles.zod';

export interface PublicProfile {
  username: string;
  displayName: string | null;
  bio: string | null;
  bioPrivate: string | null;
  avatarUrl: string | null;
  socialLinks: Record<string, unknown> | null;
  createdAt: Date;
  isPrivate: boolean;
  isFollowing: boolean | null;
  followStatus: 'accepted' | 'pending' | 'rejected' | null;
}

export interface FullProfile {
  username: string;
  displayName: string | null;
  bio: string | null;
  bioPrivate: string | null;
  avatarUrl: string | null;
  socialLinks: Record<string, unknown> | null;
  createdAt: Date;
  isPrivate: boolean;
  isFollowing: boolean | null;
  followStatus: 'accepted' | 'pending' | 'rejected' | null;
  email: string;
  emailVerified: boolean;
  role: string;
}

/**
 * Get a public profile by username.
 * @param username - The username to search for
 * @param viewerUserId - Optional authenticated user's ID for follow status
 * @returns Public profile data
 * @throws NotFoundError if user or profile is deleted or doesn't exist
 */
export async function getPublicProfile(
  username: string,
  viewerUserId?: string
): Promise<PublicProfile> {
  const result = await db
    .select({
      id: profiles.id,
      username: profiles.username,
      displayName: profiles.displayName,
      bio: profiles.bio,
      bioPrivate: profiles.bioPrivate,
      avatarUrl: profiles.avatarUrl,
      socialLinks: profiles.socialLinks,
      createdAt: profiles.createdAt,
      isPrivate: profiles.isPrivate,
      deletedAt: users.deletedAt,
    })
    .from(profiles)
    .innerJoin(users, eq(profiles.userId, users.id))
    .where(eq(profiles.username, username))
    .limit(1);

  if (result.length === 0) {
    throw new NotFoundError('Profile not found');
  }

  const profile = result[0]!;

  if (profile.deletedAt !== null) {
    throw new NotFoundError('Profile not found');
  }

  let isFollowing = null;
  let followStatus = null;
  let viewerProfileId: string | null = null;

  if (viewerUserId) {
    const { resolveProfileIdFromUserId } = await import('../follows/follows.service');
    try {
      viewerProfileId = await resolveProfileIdFromUserId(viewerUserId);
    } catch {
      viewerProfileId = null;
    }
  }

  if (viewerProfileId && viewerProfileId !== profile.id) {
    const { getFollowStatus } = await import('../follows/follows.service');
    followStatus = await getFollowStatus(viewerProfileId, profile.id);
    isFollowing = followStatus === 'accepted';
  }

  if (profile.isPrivate && followStatus !== 'accepted') {
    return {
      username: profile.username,
      displayName: profile.displayName,
      bio: null,
      bioPrivate: profile.bioPrivate,
      avatarUrl: profile.avatarUrl,
      socialLinks: null,
      createdAt: new Date(0),
      isPrivate: profile.isPrivate,
      isFollowing,
      followStatus,
    };
  }

  return {
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    bioPrivate: profile.bioPrivate,
    avatarUrl: profile.avatarUrl,
    socialLinks: profile.socialLinks as Record<string, unknown> | null,
    createdAt: profile.createdAt,
    isPrivate: profile.isPrivate,
    isFollowing,
    followStatus,
  };
}

/**
 * Get the authenticated user's full profile.
 * @param userId - The authenticated user's ID
 * @returns Full profile data including account info
 * @throws NotFoundError if profile doesn't exist
 */
export async function getOwnProfile(userId: string): Promise<FullProfile> {
  const result = await db
    .select({
      username: profiles.username,
      displayName: profiles.displayName,
      bio: profiles.bio,
      bioPrivate: profiles.bioPrivate,
      avatarUrl: profiles.avatarUrl,
      socialLinks: profiles.socialLinks,
      createdAt: profiles.createdAt,
      isPrivate: profiles.isPrivate,
      email: users.email,
      emailVerified: users.emailVerified,
      role: users.role,
    })
    .from(profiles)
    .innerJoin(users, eq(profiles.userId, users.id))
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (result.length === 0) {
    throw new NotFoundError('Profile not found');
  }

  const profile = result[0]!;

  return {
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio,
    bioPrivate: profile.bioPrivate,
    avatarUrl: profile.avatarUrl,
    socialLinks: profile.socialLinks as Record<string, unknown> | null,
    createdAt: profile.createdAt,
    isPrivate: profile.isPrivate,
    isFollowing: null,
    followStatus: null,
    email: profile.email,
    emailVerified: profile.emailVerified,
    role: profile.role,
  };
}

/**
 * Update the authenticated user's profile.
 * @param userId - The authenticated user's ID
 * @param data - Partial update data
 * @returns Updated full profile
 * @throws ConflictError if username is already taken
 */
export async function updateProfile(
  userId: string,
  data: Partial<UpdateProfileInput>
): Promise<FullProfile> {
  if (data.username !== undefined) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const existingUsername = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.username, data.username),
          ne(users.id, userId),
          or(
            isNull(users.deletedAt),
            gt(users.deletedAt, thirtyDaysAgo)
          )
        )
      )
      .limit(1);

    if (existingUsername.length > 0) {
      throw new ConflictError('Username already taken');
    }
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    if (data.username !== undefined) {
      await tx
        .update(users)
        .set({ username: data.username, updatedAt: now })
        .where(eq(users.id, userId));

      await tx
        .update(profiles)
        .set({ username: data.username, updatedAt: now })
        .where(eq(profiles.userId, userId));
    }

    const profileUpdates: Record<string, unknown> = { updatedAt: now };

    if (data.displayName !== undefined) {
      profileUpdates.displayName = data.displayName;
    }
    if (data.bio !== undefined) {
      profileUpdates.bio = data.bio;
    }
    if (data.bioPrivate !== undefined) {
      profileUpdates.bioPrivate = data.bioPrivate;
    }
    if (data.avatarUrl !== undefined) {
      profileUpdates.avatarUrl = data.avatarUrl;
    }
    if (data.socialLinks !== undefined) {
      profileUpdates.socialLinks = data.socialLinks;
    }
    if (data.isPrivate !== undefined) {
      profileUpdates.isPrivate = data.isPrivate;
    }

    const hasProfileUpdates = Object.keys(profileUpdates).length > 1;
    if (hasProfileUpdates) {
      await tx
        .update(profiles)
        .set(profileUpdates)
        .where(eq(profiles.userId, userId));
    }
  });

  return getOwnProfile(userId);
}

/**
 * Soft delete the authenticated user's account.
 * Sets users.deleted_at and deletes all sessions.
 * Does not touch profiles.deleted_at.
 * @param userId - The authenticated user's ID
 */
export async function deleteAccount(userId: string): Promise<void> {
  const { sessions } = await import('../auth/auth.schema');

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId));

    await tx
      .delete(sessions)
      .where(eq(sessions.userId, userId));
  });
}
