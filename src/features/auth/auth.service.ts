import { createId } from '@paralleldrive/cuid2';
import { eq, and, lt, isNull, gt, or } from 'drizzle-orm';
import { db } from '../../db/index';
import { users, sessions, NewUser, NewSession, User } from './auth.schema';
import { profiles } from '../profiles/profiles.schema';
import { signatures } from '../signatures/signatures.schema';
import { workspaces } from '../workspace/workspace.schema';
import { hashPassword, verifyPassword, generateSecret, generateUserHash, encryptSecret } from '../../utils/crypto';
import { ConflictError, UnauthorizedError } from '../../utils/errors';
import { env } from '../../config/env';
import { sendVerificationEmail } from '../email/email.service';
import { features } from '../../config/features';
import type { FastifyReply } from 'fastify';

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

export interface RegisterUserResult {
  user: User;
  refreshToken: string;
}

export interface CreateUserResult {
  user: User;
}

export interface LoginUserResult {
  user: User;
  refreshToken: string;
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

async function createSession(userId: string): Promise<string> {
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
  const expiresAt = parseExpiration(env.JWT_REFRESH_EXPIRES_IN);

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

export async function createSessionWithReply(userId: string, reply: FastifyReply): Promise<void> {
  const refreshToken = await createSession(userId);
  const maxAge = parseExpiration(env.JWT_REFRESH_EXPIRES_IN);
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
 * @returns User object and refresh token
 * @throws UnauthorizedError if credentials are invalid
 */
export async function loginUser(
  identifier: string,
  password: string
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

  if (!user.onboardingComplete) {
    throw new UnauthorizedError('Please complete your account setup first.');
  }

  const refreshToken = await createSession(user.id);

  return { user, refreshToken };
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
