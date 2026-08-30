import { createId } from '@paralleldrive/cuid2';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index';
import { platformApps, userApps, appInvites, NewUserApp } from './platform-apps.schema';
import { profiles } from '../profiles/profiles.schema';
import { NotFoundError, ConflictError, ValidationError } from '../../utils/errors';

export async function listApps() {
  return db
    .select()
    .from(platformApps)
    .where(eq(platformApps.isActive, true));
}

export async function listAllApps() {
  return db
    .select()
    .from(platformApps)
    .orderBy(platformApps.createdAt);
}

export async function getUserApps(profileId: string) {
  return db
    .select({
      id: userApps.id,
      appId: userApps.appId,
      activatedAt: userApps.activatedAt,
      slug: platformApps.slug,
      name: platformApps.name,
      description: platformApps.description,
    })
    .from(userApps)
    .innerJoin(platformApps, eq(userApps.appId, platformApps.id))
    .where(eq(userApps.profileId, profileId));
}

export async function activateApps(profileId: string, appSlugs: string[]) {
  if (appSlugs.length === 0) {
    throw new ValidationError('No apps provided');
  }

  const apps = await db
    .select()
    .from(platformApps)
    .where(eq(platformApps.isActive, true));

  const validSlugs = new Set(apps.map(a => a.slug));
  const invalidSlugs = appSlugs.filter(s => !validSlugs.has(s));

  // Beta check: require accepted invite for beta apps
  const appBySlug = new Map(apps.map(a => [a.slug, a]));
  for (const slug of appSlugs) {
    const app = appBySlug.get(slug);
    if (app && app.accessMode === 'beta') {
      const [invite] = await db
        .select()
        .from(appInvites)
        .where(
          and(
            eq(appInvites.appId, app.id),
            eq(appInvites.profileId, profileId),
            eq(appInvites.status, 'accepted')
          )
        )
        .limit(1);

      if (!invite) {
        invalidSlugs.push(slug);
      }
    }
  }

  if (invalidSlugs.length > 0) {
    throw new ValidationError(`Invalid app slugs: ${invalidSlugs.join(', ')}`);
  }

  const appIdsBySlug = new Map(apps.map(a => [a.slug, a.id]));

  const userAppRows: NewUserApp[] = appSlugs.map(slug => ({
    id: createId(),
    profileId,
    appId: appIdsBySlug.get(slug)!,
    activatedAt: new Date(),
  }));

  for (const row of userAppRows) {
    await db
      .insert(userApps)
      .values(row)
      .onConflictDoUpdate({
        target: [userApps.profileId, userApps.appId],
        set: { activatedAt: new Date() },
      });
  }
}

export async function deactivateApp(profileId: string, appId: string) {
  const [existing] = await db
    .select()
    .from(userApps)
    .where(eq(userApps.id, appId))
    .limit(1);

  if (!existing || existing.profileId !== profileId) {
    throw new NotFoundError('App not found or not owned by user');
  }

  await db
    .delete(userApps)
    .where(eq(userApps.id, appId));
}

export async function createApp(data: {
  slug: string;
  name: string;
  description?: string | null;
  accessMode?: string;
  iconUrl?: string | null;
  tagline?: string | null;
  category?: string | null;
}) {
  const [existing] = await db
    .select({ id: platformApps.id })
    .from(platformApps)
    .where(eq(platformApps.slug, data.slug))
    .limit(1);

  if (existing) {
    throw new ConflictError('App slug already exists');
  }

  const [created] = await db
    .insert(platformApps)
    .values({
      id: createId(),
      slug: data.slug,
      name: data.name,
      description: data.description ?? null,
      accessMode: data.accessMode ?? 'open',
      iconUrl: data.iconUrl ?? null,
      tagline: data.tagline ?? null,
      category: data.category ?? null,
      isActive: true,
      createdAt: new Date(),
    })
    .returning();

  return created!;
}

export async function updateApp(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    accessMode?: string;
    iconUrl?: string | null;
    tagline?: string | null;
    category?: string | null;
    isActive?: boolean;
  }
) {
  const [existing] = await db
    .select({ id: platformApps.id })
    .from(platformApps)
    .where(eq(platformApps.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('App not found');
  }

  const [updated] = await db
    .update(platformApps)
    .set(data)
    .where(eq(platformApps.id, id))
    .returning();

  return updated!;
}

export async function createInvite(appId: string, profileId: string, invitedByProfileId: string) {
  const [app] = await db
    .select({ id: platformApps.id })
    .from(platformApps)
    .where(eq(platformApps.id, appId))
    .limit(1);

  if (!app) {
    throw new NotFoundError('App not found');
  }

  const [profile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  if (!profile) {
    throw new NotFoundError('Profile not found');
  }

  const [created] = await db
    .insert(appInvites)
    .values({
      id: createId(),
      appId,
      profileId,
      invitedBy: invitedByProfileId,
      status: 'accepted',
      createdAt: new Date(),
      decidedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [appInvites.appId, appInvites.profileId],
      set: { status: 'accepted', decidedAt: new Date() },
    })
    .returning();

  return created!;
}

export async function listInvites(appId: string) {
  const [app] = await db
    .select({ id: platformApps.id })
    .from(platformApps)
    .where(eq(platformApps.id, appId))
    .limit(1);

  if (!app) {
    throw new NotFoundError('App not found');
  }

  return db
    .select({
      id: appInvites.id,
      appId: appInvites.appId,
      profileId: appInvites.profileId,
      invitedBy: appInvites.invitedBy,
      status: appInvites.status,
      createdAt: appInvites.createdAt,
      decidedAt: appInvites.decidedAt,
      username: profiles.username,
      displayName: profiles.displayName,
    })
    .from(appInvites)
    .innerJoin(profiles, eq(appInvites.profileId, profiles.id))
    .where(eq(appInvites.appId, appId))
    .orderBy(appInvites.createdAt);
}

export type ListAppsResult = Awaited<ReturnType<typeof listApps>>;
export type ListAllAppsResult = Awaited<ReturnType<typeof listAllApps>>;
export type GetUserAppsResult = Awaited<ReturnType<typeof getUserApps>>;
