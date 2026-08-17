import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index';
import { platformApps, userApps, NewUserApp } from './platform-apps.schema';

export async function listApps() {
  return db
    .select()
    .from(platformApps)
    .where(eq(platformApps.isActive, true));
}

export async function getUserApps(userId: string) {
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
    .where(eq(userApps.userId, userId));
}

export async function activateApps(userId: string, appSlugs: string[]) {
  if (appSlugs.length === 0) {
    throw new Error('No apps provided');
  }

  const apps = await db
    .select()
    .from(platformApps)
    .where(eq(platformApps.isActive, true));

  const validSlugs = new Set(apps.map(a => a.slug));
  const invalidSlugs = appSlugs.filter(s => !validSlugs.has(s));

  if (invalidSlugs.length > 0) {
    throw new Error(`Invalid app slugs: ${invalidSlugs.join(', ')}`);
  }

  const appIdsBySlug = new Map(apps.map(a => [a.slug, a.id]));

  const userAppRows: NewUserApp[] = appSlugs.map(slug => ({
    id: createId(),
    userId,
    appId: appIdsBySlug.get(slug)!,
    activatedAt: new Date(),
  }));

  for (const row of userAppRows) {
    await db
      .insert(userApps)
      .values(row)
      .onConflictDoUpdate({
        target: [userApps.userId, userApps.appId],
        set: { activatedAt: new Date() },
      });
  }
}

export async function deactivateApp(userId: string, appId: string) {
  const [existing] = await db
    .select()
    .from(userApps)
    .where(eq(userApps.id, appId))
    .limit(1);

  if (!existing || existing.userId !== userId) {
    throw new Error('App not found or not owned by user');
  }

  await db
    .delete(userApps)
    .where(eq(userApps.id, appId));
}

export type ListAppsResult = Awaited<ReturnType<typeof listApps>>;
export type GetUserAppsResult = Awaited<ReturnType<typeof getUserApps>>;