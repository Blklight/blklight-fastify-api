import { createId } from '@paralleldrive/cuid2';
import { eq, and, lt, isNull, gt, or, ne } from 'drizzle-orm';
import { db } from '../../db/index';
import { users, sessions, NewUser, NewSession, User } from './auth.schema';
import { profiles } from '../profiles/profiles.schema';
import { signatures } from '../signatures/signatures.schema';
import { workspaces } from '../workspace/workspace.schema';
import { canvas } from '../canvas/canvas.schema';
import { getUserApps } from '../platform-apps/platform-apps.service';
import { hashPassword, verifyPassword, generateSecret, generateUserHash, encryptSecret } from '../../utils/crypto';
import { ConflictError, UnauthorizedError, NotFoundError, ValidationError } from '../../utils/errors';
import { env } from '../../config/env';
import { sendVerificationEmail } from '../email/email.service';
import { features } from '../../config/features';
import type { FastifyReply } from 'fastify';
import type { AuthSession } from './auth.zod';

export interface RegisterUserResult {
  user: User;
  refreshToken: string;
}

export interface CreateUserResult {
  user: User;
}

export interface LoginUserResult {
  userId: string;
  refreshToken: string;
  role: string;
  email: string;
}

export async function buildAuthSession(
  userId: string,
  accessToken: string
): Promise<AuthSession> {
  const [userRow, profileRow] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)).limit(1),
    db
      .select({
        id: profiles.id,
        userId: profiles.userId,
        username: profiles.username,
        displayName: profiles.displayName,
        avatarUrl: profiles.avatarUrl,
        isPrivate: profiles.isPrivate,
      })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1),
  ]);

  const user = userRow[0];
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const profile = profileRow[0];
  const profileId = profile?.id;

  const userApps = profileId ? await getUserApps(profileId) : [];

  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role as 'user' | 'admin',
      emailVerified: user.emailVerified,
      onboardingComplete: user.onboardingComplete,
      createdAt: user.createdAt.toISOString(),
    },
    profile: {
      id: profile?.id ?? '',
      userId: profile?.userId ?? '',
      username: profile?.username ?? '',
      displayName: profile?.displayName ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      isPrivate: profile?.isPrivate ?? false,
    },
    apps: userApps.map(a => a.slug),
  };
}

export function getOnboardingStep(user: {
  username: string | null;
  onboardingComplete: boolean;
  passwordHash: string | null;
}): 'username' | 'apps' | 'complete' {
  if (user.onboardingComplete) {
    return 'complete';
  }
  if (user.passwordHash === null && isOAuthPlaceholderUsername(user.username)) {
    return 'username';
  }
  return 'apps';
}

/**
 * Detect the temporary username assigned by handleOAuthLogin
 * (`github_<id>` / `google_<id>`) to distinguish "needs a username"
 * from "picked a username, still onboarding".
 */
function isOAuthPlaceholderUsername(username: string | null): boolean {
  return !!username && /^(github|google)_[0-9]+$/.test(username);
}

function parseExpiration(expiresIn: string): Date {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match || !match[1] || !match[2]) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const msMap: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const ms = msMap[unit] ?? 86400000;
  return new Date(Date.now() + value * ms);
}

export async function registerUser(
  email: string,
  username: string,
  password: string
): Promise<RegisterUserResult> {
  const { user } = await createUser(email, username, password);
  const refreshToken = await createSession(user.id);
  return { user, refreshToken };
}

/**
 * Set the username for an OAuth account during onboarding.
 * Only callable while the account still has no password (OAuth placeholder).
 * @param userId - The user's ID
 * @param username - The chosen username
 * @throws NotFoundError if the user does not exist
 * @throws ValidationError if the account is complete or already has a password
 * @throws ConflictError if the username is already taken
 */
export async function setOnboardingUsername(userId: string, username: string): Promise<void> {
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

  if (user.passwordHash !== null) {
    throw new ValidationError('Username already set');
  }

  const trimmedUsername = username.trim();

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
        ne(users.id, userId),
        or(
          isNull(users.deletedAt),
          gt(users.deletedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        )
      )
    )
    .limit(1);

  if (existingUsername.length > 0) {
    throw new ConflictError('Username already taken');
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ username: trimmedUsername, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await tx
      .update(profiles)
      .set({ username: trimmedUsername, updatedAt: new Date() })
      .where(eq(profiles.userId, userId));
  });
}

/**
 * Create the remaining onboarding records for an account.
 * Email accounts already have profile, signature, workspace, and canvas from
 * createUser — this is a no-op for them. OAuth accounts get all four created
 * atomically using the username chosen via setOnboardingUsername.
 * @param userId - The user's ID
 * @returns The user row
 * @throws NotFoundError if the user does not exist
 * @throws ValidationError if the username is still an OAuth placeholder
 */
export async function completeOnboarding(userId: string): Promise<User> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (isOAuthPlaceholderUsername(user.username)) {
    throw new ValidationError('Set a username before completing onboarding');
  }

  const existingProfile = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (existingProfile.length > 0) {
    await db.update(users).set({ onboardingComplete: true, updatedAt: new Date() }).where(eq(users.id, userId));
    return { ...user, onboardingComplete: true };
  }

  const now = new Date();
  const secret = generateSecret();
  const userHash = generateUserHash(user.id, user.email, user.createdAt, secret);
  const secretEncrypted = encryptSecret(secret);

  await db.transaction(async (tx) => {
    await tx.insert(profiles).values({
      id: createId(),
      userId,
      username: user.username,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(signatures).values({
      id: createId(),
      userId,
      userHash,
      secretEncrypted,
      createdAt: now,
    });

    await tx.insert(workspaces).values({
      id: createId(),
      ownerId: userId,
      type: 'personal',
      name: `${user.username}'s workspace`,
      isPersonal: true,
      colorLabels: null,
      createdAt: now,
      updatedAt: now,
    });

    const [newWorkspace] = await tx
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, userId))
      .limit(1);

    if (!newWorkspace) {
      throw new Error('Failed to create workspace');
    }

    await tx.insert(canvas).values({
      id: createId(),
      workspaceId: newWorkspace.id,
      createdAt: now,
      updatedAt: now,
    });

    await tx.update(users).set({ onboardingComplete: true, updatedAt: now }).where(eq(users.id, userId));
  });

  if (features.email) {
    sendVerificationEmail(userId, user.email, user.username).catch((err) =>
      console.error('Verification email enqueue failed:', err)
    );
  }

  return user;
}

async function createSession(userId: string, rememberMe?: boolean): Promise<string> {
  const now = new Date();

  await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        lt(sessions.expiresAt, now)
      )
    );

  const activeSessions = await db
    .select({ id: sessions.id, createdAt: sessions.createdAt })
    .from(sessions)
    .where(eq(sessions.userId, userId));

  if (activeSessions.length >= env.MAX_SESSIONS_PER_USER) {
    const oldest = activeSessions.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )[0];
    if (oldest) {
      await db.delete(sessions).where(eq(sessions.id, oldest.id));
    }
  }

  const refreshToken = createId() + createId();
  const ttl = rememberMe ? env.JWT_REFRESH_REMEMBER_TTL : env.JWT_REFRESH_EXPIRES_IN;
  const expiresAt = parseExpiration(ttl);

  const newSession: NewSession = {
    id: createId(),
    userId,
    refreshToken,
    expiresAt,
    createdAt: now,
  };

  await db.insert(sessions).values(newSession);

  return refreshToken;
}

export async function createSessionWithReply(userId: string, reply: FastifyReply, rememberMe?: boolean): Promise<void> {
  const refreshToken = await createSession(userId, rememberMe);
  const ttl = rememberMe ? env.JWT_REFRESH_REMEMBER_TTL : env.JWT_REFRESH_EXPIRES_IN;
  const maxAge = parseExpiration(ttl);
  const maxAgeMs = maxAge.getTime() - Date.now();
  const maxAgeSeconds = Math.floor(maxAgeMs / 1000);
  
  reply.setCookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeSeconds,
  });
}

export async function createUser(
  email: string,
  username: string,
  password: string
): Promise<CreateUserResult> {
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    throw new ConflictError('Email already in use');
  }

  const existingUsername = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.username, username),
        or(
          isNull(users.deletedAt),
          gt(users.deletedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        )
      )
    )
    .limit(1);

  if (existingUsername.length > 0) {
    throw new ConflictError('Username already taken');
  }

  const { hash, salt } = hashPassword(password);
  const userId = createId();
  const now = new Date();

  await db.transaction(async (tx) => {
    const newUser: NewUser = {
      id: userId,
      email,
      username,
      passwordHash: hash,
      salt,
      emailVerified: false,
      role: 'user',
      onboardingComplete: false,
      createdAt: now,
      updatedAt: now,
    };
    await tx.insert(users).values(newUser);

    await tx.insert(profiles).values({
      id: createId(),
      userId,
      username,
      createdAt: now,
      updatedAt: now,
    });

    const secret = generateSecret();
    const userHash = generateUserHash(userId, email, now, secret);
    const secretEncrypted = encryptSecret(secret);

    await tx.insert(signatures).values({
      id: createId(),
      userId,
      userHash,
      secretEncrypted,
      createdAt: now,
    });

    await tx.insert(workspaces).values({
      id: createId(),
      ownerId: userId,
      type: 'personal',
      name: `${username}'s workspace`,
      isPersonal: true,
      colorLabels: null,
      createdAt: now,
      updatedAt: now,
    });

    const [newWorkspace] = await tx
      .select()
      .from(workspaces)
      .where(eq(workspaces.ownerId, userId))
      .limit(1);

    await tx.insert(canvas).values({
      id: createId(),
      workspaceId: newWorkspace!.id,
      createdAt: now,
      updatedAt: now,
    });
  });

  const createdUser = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (features.email) {
    sendVerificationEmail(createdUser[0]!.id, email, username).catch((err) =>
      console.error('Verification email enqueue failed:', err)
    );
  }

  return { user: createdUser[0]! };
}

/**
 * Authenticate a user with email or username.
 * @param identifier - Email address or username
 * @param password - Account password
 * @param rememberMe - Whether to extend refresh token TTL
 * @returns User ID, refresh token, role, and email
 * @throws UnauthorizedError if credentials are invalid
 */
export async function loginUser(
  identifier: string,
  password: string,
  rememberMe?: boolean
): Promise<LoginUserResult> {
  const isEmail = identifier.includes('@');
  const normalizedIdentifier = isEmail ? identifier.toLowerCase().trim() : identifier.trim();

  const condition = isEmail ? eq(users.email, normalizedIdentifier) : eq(users.username, normalizedIdentifier);

  const userRows = await db
    .select()
    .from(users)
    .where(condition)
    .limit(1);

  if (userRows.length === 0) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const user = userRows[0]!;

  if (!user.passwordHash || !user.salt) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isValid = verifyPassword(password, user.passwordHash, user.salt);
  if (!isValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const refreshToken = await createSession(user.id, rememberMe);

  return { userId: user.id, refreshToken, role: user.role, email: user.email };
}

export async function refreshSession(refreshToken: string): Promise<User> {
  const sessionRows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.refreshToken, refreshToken))
    .limit(1);

  if (sessionRows.length === 0) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const session = sessionRows[0]!;
  if (session.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    throw new UnauthorizedError('Refresh token expired');
  }

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (userRows.length === 0) {
    throw new UnauthorizedError('User not found');
  }

  return userRows[0]!;
}

export async function logout(refreshToken: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.refreshToken, refreshToken));
}
