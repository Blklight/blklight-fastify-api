import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../../db/index';
import { users } from './auth.schema';
import { profiles } from '../profiles/profiles.schema';
import { signatures } from '../signatures/signatures.schema';
import { workspaces } from '../workspace/workspace.schema';
import { canvas } from '../canvas/canvas.schema';
import { createId } from '@paralleldrive/cuid2';
import { generateUserHash, encryptSecret } from '../../utils/crypto';
import { ValidationError, NotFoundError, ConflictError } from '../../utils/errors';
import { env } from '../../config/env';
import { sendVerificationEmail } from '../email/email.service';
import { features } from '../../config/features';
import type { FastifyInstance, FastifyReply } from 'fastify';

let appInstance: FastifyInstance | null = null;

async function getApp(): Promise<FastifyInstance> {
  if (!appInstance) {
    const { buildApp } = await import('../../app');
    appInstance = await buildApp();
  }
  return appInstance;
}

export interface OAuthUser {
  id: string;
  email: string;
  name: string;
  login?: string;
}

export interface OAuthLoginResult {
  userId: string;
  onboardingComplete: boolean;
  isNew: boolean;
}

async function generateUserSecret(): Promise<string> {
  const crypto = await import('node:crypto');
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Fetch user data from GitHub API.
 * @param accessToken - GitHub access token
 * @returns GitHub user data
 */
export async function fetchGitHubUser(accessToken: string): Promise<OAuthUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch GitHub user');
  }

  const data = await response.json() as {
    id: number;
    email: string | null;
    name: string | null;
    login: string;
  };

  let email: string | null | undefined = data.email;
  if (!email) {
    const emailsResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (emailsResponse.ok) {
      const emails = await emailsResponse.json() as Array<{ primary: boolean; email: string }>;
      const primaryEmail = emails.find((e) => e.primary);
      email = primaryEmail?.email;
    }
  }

  return {
    id: String(data.id),
    email: email ?? '',
    name: data.name || data.login || '',
    login: data.login,
  };
}

/**
 * Fetch user data from Google API.
 * @param accessToken - Google access token
 * @returns Google user data
 */
export async function fetchGoogleUser(accessToken: string): Promise<OAuthUser> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Google user');
  }

  const data = await response.json() as {
    id: string;
    email: string | null;
    name: string | null;
  };

  return {
    id: data.id,
    email: data.email || '',
    name: data.name || '',
  };
}

/**
 * Handle OAuth login or registration.
 * @param provider - OAuth provider ('github' or 'google')
 * @param providerUserId - The provider's user ID
 * @param email - User's email from provider
 * @returns Login result with user ID and onboarding status
 */
export async function handleOAuthLogin(
  provider: 'github' | 'google',
  providerUserId: string,
  email: string
): Promise<OAuthLoginResult> {
  const providerIdField = provider === 'github' ? users.githubId : users.googleId;

  const existingByProvider = await db
    .select()
    .from(users)
    .where(eq(providerIdField, providerUserId))
    .limit(1);

  if (existingByProvider.length > 0) {
    const user = existingByProvider[0]!;
    if (!user.onboardingComplete) {
      return { userId: user.id, onboardingComplete: false, isNew: false };
    }
    return { userId: user.id, onboardingComplete: true, isNew: false };
  }

  const existingByEmail = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existingByEmail.length > 0) {
    throw new ConflictError(
      'An account with this email already exists. Please log in and link your GitHub/Google account instead.'
    );
  }

  const userId = createId();

  await db.insert(users).values({
    id: userId,
    email: email.toLowerCase(),
    username: `${provider}_${providerUserId}`,
    [provider === 'github' ? 'githubId' : 'googleId']: providerUserId,
    onboardingComplete: false,
    passwordHash: null,
    salt: null,
  });

  return { userId, onboardingComplete: false, isNew: true };
}

/**
 * Link an OAuth provider to an existing user account.
 * @param userId - The user's ID
 * @param provider - OAuth provider ('github' or 'google')
 * @param providerUserId - The provider's user ID
 */
export async function handleOAuthLink(
  userId: string,
  provider: 'github' | 'google',
  providerUserId: string
): Promise<void> {
  const providerIdField = provider === 'github' ? users.githubId : users.googleId;

  const existing = await db
    .select()
    .from(users)
    .where(eq(providerIdField, providerUserId))
    .limit(1);

  if (existing.length > 0 && existing[0]!.id !== userId) {
    throw new ConflictError(
      `This ${provider === 'github' ? 'GitHub' : 'Google'} account is already linked to another user`
    );
  }

  const currentUser = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (currentUser.length === 0) {
    throw new NotFoundError('User not found');
  }

  await db
    .update(users)
    .set({
      [provider === 'github' ? 'githubId' : 'googleId']: providerUserId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Complete the OAuth onboarding process.
 * @param userId - The user's ID
 * @param username - Chosen username
 * @returns Access token
 */
export async function completeOnboarding(
  userId: string,
  username: string
): Promise<{ accessToken: string }> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (user.onboardingComplete) {
    throw new ValidationError('Onboarding already complete');
  }

  const trimmedUsername = username.trim().toLowerCase();

  if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
    throw new ValidationError('Username must be 3-30 characters');
  }

  if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
    throw new ValidationError('Username can only contain letters, numbers, and underscores');
  }

  const existingUsername = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.username, trimmedUsername),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (existingUsername.length > 0) {
    throw new ConflictError('Username already taken');
  }

  const userSecret = await generateUserSecret();
  const userHash = generateUserHash(user.id, user.email, user.createdAt, userSecret);
  const encryptedSecret = encryptSecret(userSecret);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        username: trimmedUsername,
        onboardingComplete: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    await tx.insert(profiles).values({
      id: createId(),
      userId,
      username: trimmedUsername,
    });

    await tx.insert(signatures).values({
      id: createId(),
      userId,
      userHash,
      secretEncrypted: encryptedSecret,
    });

    await tx.insert(workspaces).values({
      id: createId(),
      ownerId: userId,
      type: 'personal',
      name: 'My Workspace',
      isPersonal: true,
    });

    await tx.insert(canvas).values({
      id: createId(),
      workspaceId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  const app = await getApp();
  const accessToken = await app.jwt.sign(
    { userId, email: '', role: 'user' },
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );

  if (features.email) {
    sendVerificationEmail(userId, user.email, trimmedUsername).catch((err) =>
      console.error('Verification email enqueue failed:', err)
    );
  }

  return { accessToken };
}

/**
 * Unlink an OAuth provider from a user account.
 * @param userId - The user's ID
 * @param provider - OAuth provider ('github' or 'google')
 */
export async function unlinkProvider(
  userId: string,
  provider: 'github' | 'google'
): Promise<void> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const hasPassword = user.passwordHash !== null;
  const hasGitHub = user.githubId !== null;
  const hasGoogle = user.googleId !== null;

  const methodsCount = [hasPassword, hasGitHub, hasGoogle].filter(Boolean).length;

  if (methodsCount <= 1) {
    throw new ValidationError(
      'Cannot unlink your only login method. Add a password or another provider first.'
    );
  }

  const updateField = provider === 'github' ? 'githubId' : 'googleId';

  await db
    .update(users)
    .set({
      [updateField]: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
