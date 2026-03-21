import { eq, and, isNull, desc, lt, or, ilike, count, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '../../db/index';
import { documents, documentTypes, documentStyles, Document, NewDocument, NewDocumentStyle } from './documents.schema';
import { profiles } from '../profiles/profiles.schema';
import { users } from '../auth/auth.schema';
import { documentLikes } from '../likes/likes.schema';
import { categories, documentCategories } from '../categories/categories.schema';
import { tags as tagsTable, documentTags } from '../tags/tags.schema';
import { signDocument } from '../signatures/signatures.service';
import { ValidationError, NotFoundError } from '../../utils/errors';
import { encodeCursor, decodeCursor } from '../../utils/cursor';
import { getLikesCount } from '../likes/likes.service';
import { getDocumentTags, setDocumentTags } from '../tags/tags.service';
import { getDocumentCategory, setDocumentCategory } from '../categories/categories.service';
import type { CreateDocumentInput, UpdateDocumentInput } from './documents.zod';
import type { NewProfile } from '../profiles/profiles.schema';

export interface DocumentWithStyle {
  id: string;
  authorId: string;
  typeId: string;
  typeName: string;
  status: string;
  title: string;
  abstract: string | null;
  content: Record<string, unknown> | null;
  coverImageUrl: string | null;
  slug: string;
  authorship: Authorship | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  style: {
    typography: string;
    paperStyle: Record<string, unknown> | null;
    paperTexture: Record<string, unknown> | null;
    coverSettings: Record<string, unknown> | null;
    documentHeader: Record<string, unknown> | null;
    documentFooter: Record<string, unknown> | null;
    documentSignature: Record<string, unknown> | null;
  };
}

export interface DocumentSummary {
  id: string;
  title: string;
  abstract: string | null;
  status: string;
  typeName: string;
  slug: string;
  coverImageUrl: string | null;
  authorship: Authorship | null;
  publishedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

export interface Authorship {
  authorName: string;
  username: string;
  userHash: string;
  documentHash: string;
  publicIdentifier: string;
  hmac: string;
  signedAt: string;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

async function ensureUniqueSlug(authorId: string, slug: string, excludeId?: string): Promise<string> {
  let finalSlug = slug;
  let counter = 1;

  while (true) {
    const conditions = [
      eq(documents.authorId, authorId),
      eq(documents.slug, finalSlug),
    ];

    if (excludeId) {
      conditions.push(eq(documents.id, excludeId));
    }

    const existing = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(...conditions))
      .limit(1);

    if (existing.length === 0) {
      return finalSlug;
    }

    finalSlug = `${slug}-${counter}`;
    counter++;
  }
}

function getDefaultStyles(typeName: string): Partial<NewDocumentStyle> {
  const base = {
    typography: 'sans' as const,
    paperStyle: null,
    paperTexture: null,
    coverSettings: null,
    documentHeader: null,
    documentFooter: null,
    documentSignature: null,
  };

  if (typeName === 'article') {
    return {
      ...base,
      typography: 'serif',
      paperStyle: {},
      documentHeader: {},
      documentFooter: {},
    };
  }

  if (typeName === 'page') {
    return {
      ...base,
      typography: 'mono',
    };
  }

  return base;
}

export async function createDocument(
  authorId: string,
  data: CreateDocumentInput
): Promise<DocumentWithStyle> {
  const typeResult = await db
    .select()
    .from(documentTypes)
    .where(eq(documentTypes.name, data.type))
    .limit(1);

  if (typeResult.length === 0) {
    throw new ValidationError('Invalid document type');
  }

  const type = typeResult[0]!;
  const baseSlug = data.slug ?? generateSlug(data.title);
  const slug = await ensureUniqueSlug(authorId, baseSlug);
  const now = new Date();
  const documentId = createId();

  await db.transaction(async (tx) => {
    const newDocument: NewDocument = {
      id: documentId,
      authorId,
      typeId: type.id,
      title: data.title,
      abstract: data.abstract ?? null,
      content: data.content ?? null,
      coverImageUrl: data.coverImageUrl ?? null,
      slug,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    await tx.insert(documents).values(newDocument);

    const defaultStyles = getDefaultStyles(data.type);
    const newStyle: NewDocumentStyle = {
      id: createId(),
      documentId,
      typography: defaultStyles.typography ?? 'sans',
      paperStyle: defaultStyles.paperStyle ?? null,
      paperTexture: defaultStyles.paperTexture ?? null,
      coverSettings: defaultStyles.coverSettings ?? null,
      documentHeader: defaultStyles.documentHeader ?? null,
      documentFooter: defaultStyles.documentFooter ?? null,
      documentSignature: defaultStyles.documentSignature ?? null,
      updatedAt: now,
    };
    await tx.insert(documentStyles).values(newStyle);
  });

  if (data.categoryId || (data.tags && data.tags.length > 0)) {
    await db.transaction(async (tx) => {
      if (data.categoryId) {
        await setDocumentCategory(documentId, data.categoryId);
      }
      if (data.tags && data.tags.length > 0) {
        await setDocumentTags(documentId, data.tags);
      }
    });
  }

  return getDocumentById(documentId, authorId);
}

export async function updateDocument(
  authorId: string,
  documentId: string,
  data: UpdateDocumentInput
): Promise<DocumentWithStyle> {
  const doc = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), isNull(documents.deletedAt)))
    .limit(1);

  if (doc.length === 0 || doc[0]!.authorId !== authorId) {
    throw new NotFoundError('Document not found');
  }

  const existingDoc = doc[0]!;
  const now = new Date();
  const updates: Partial<NewDocument> = { updatedAt: now };
  const styleUpdates: Record<string, unknown> = { updatedAt: now };

  if (data.title !== undefined) {
    updates.title = data.title;
    if (data.slug === undefined && existingDoc.status !== 'published') {
      updates.slug = await ensureUniqueSlug(authorId, generateSlug(data.title), documentId);
    }
  }

  if (data.slug !== undefined) {
    updates.slug = await ensureUniqueSlug(authorId, data.slug, documentId);
  }

  if (data.abstract !== undefined) {
    updates.abstract = data.abstract;
  }

  if (data.coverImageUrl !== undefined) {
    updates.coverImageUrl = data.coverImageUrl;
  }

  if (data.type !== undefined) {
    const typeResult = await db
      .select()
      .from(documentTypes)
      .where(eq(documentTypes.name, data.type))
      .limit(1);

    if (typeResult.length === 0) {
      throw new ValidationError('Invalid document type');
    }
    updates.typeId = typeResult[0]!.id;
  }

  if (data.content !== undefined) {
    updates.content = data.content;
    if (existingDoc.status === 'published') {
      updates.authorship = null;
      updates.status = 'draft';
      updates.publishedAt = null;
    }
  }

  if (data.typography !== undefined) {
    styleUpdates.typography = data.typography;
  }
  if (data.paperStyle !== undefined) {
    styleUpdates.paperStyle = data.paperStyle;
  }
  if (data.paperTexture !== undefined) {
    styleUpdates.paperTexture = data.paperTexture;
  }
  if (data.coverSettings !== undefined) {
    styleUpdates.coverSettings = data.coverSettings;
  }
  if (data.documentHeader !== undefined) {
    styleUpdates.documentHeader = data.documentHeader;
  }
  if (data.documentFooter !== undefined) {
    styleUpdates.documentFooter = data.documentFooter;
  }

  await db.transaction(async (tx) => {
    await tx.update(documents).set(updates).where(eq(documents.id, documentId));

    if (Object.keys(styleUpdates).length > 1) {
      await tx.update(documentStyles).set(styleUpdates).where(eq(documentStyles.documentId, documentId));
    }
  });

  if (data.categoryId !== undefined || data.tags !== undefined) {
    if (data.categoryId !== undefined) {
      if (data.categoryId) {
        await setDocumentCategory(documentId, data.categoryId);
      } else {
        const { removeDocumentCategory } = await import('../categories/categories.service');
        await removeDocumentCategory(documentId);
      }
    }
    if (data.tags !== undefined) {
      if (data.tags.length > 0) {
        await setDocumentTags(documentId, data.tags);
      } else {
        const { db: txDb } = await import('../../db/index');
        const { documentTags: dt } = await import('../tags/tags.schema');
        await txDb.delete(dt).where(eq(dt.documentId, documentId));
      }
    }
  }

  return getDocumentById(documentId, authorId);
}

export async function publishDocument(
  authorId: string,
  documentId: string
): Promise<DocumentWithStyle> {
  const doc = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), isNull(documents.deletedAt)))
    .limit(1);

  if (doc.length === 0 || doc[0]!.authorId !== authorId) {
    throw new NotFoundError('Document not found');
  }

  const existingDoc = doc[0]!;

  if (existingDoc.status === 'published') {
    throw new ValidationError('Document is already published');
  }

  if (!existingDoc.content) {
    throw new ValidationError('Cannot publish empty document');
  }

  const category = await getDocumentCategory(documentId);
  if (!category) {
    throw new ValidationError('A category is required to publish');
  }

  const profileResult = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, authorId))
    .limit(1);

  if (profileResult.length === 0) {
    throw new NotFoundError('Profile not found');
  }

  const profile = profileResult[0]!;
  const contentString = JSON.stringify(existingDoc.content);
  const signed = await signDocument(profile.userId, contentString);

  const authorship: Authorship = {
    authorName: profile.displayName ?? profile.username,
    username: profile.username,
    userHash: signed.userHash,
    documentHash: signed.documentHash,
    publicIdentifier: signed.publicIdentifier,
    hmac: signed.signature,
    signedAt: new Date().toISOString(),
  };

  const now = new Date();
  await db
    .update(documents)
    .set({
      status: 'published',
      authorship,
      publishedAt: now,
      updatedAt: now,
    })
    .where(eq(documents.id, documentId));

  return getDocumentById(documentId, authorId);
}

export async function softDeleteDocument(
  authorId: string,
  documentId: string
): Promise<void> {
  const doc = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), isNull(documents.deletedAt)))
    .limit(1);

  if (doc.length === 0 || doc[0]!.authorId !== authorId) {
    throw new NotFoundError('Document not found');
  }

  await db
    .update(documents)
    .set({ deletedAt: new Date() })
    .where(eq(documents.id, documentId));
}

export async function getMyDocuments(
  authorId: string,
  limit: number = 20,
  offset: number = 0
): Promise<DocumentSummary[]> {
  const results = await db
    .select({
      id: documents.id,
      title: documents.title,
      abstract: documents.abstract,
      status: documents.status,
      typeName: documentTypes.name,
      slug: documents.slug,
      coverImageUrl: documents.coverImageUrl,
      authorship: documents.authorship,
      publishedAt: documents.publishedAt,
      updatedAt: documents.updatedAt,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .innerJoin(documentTypes, eq(documents.typeId, documentTypes.id))
    .where(and(eq(documents.authorId, authorId), isNull(documents.deletedAt)))
    .orderBy(desc(documents.updatedAt))
    .limit(limit)
    .offset(offset);

  return results.map((r) => ({
    id: r.id,
    title: r.title,
    abstract: r.abstract,
    status: r.status,
    typeName: r.typeName,
    slug: r.slug,
    coverImageUrl: r.coverImageUrl,
    authorship: r.authorship as Authorship | null,
    publishedAt: r.publishedAt,
    updatedAt: r.updatedAt,
    createdAt: r.createdAt,
  }));
}

async function getDocumentById(documentId: string, authorId: string): Promise<DocumentWithStyle> {
  const docResult = await db
    .select({
      id: documents.id,
      authorId: documents.authorId,
      typeId: documents.typeId,
      typeName: documentTypes.name,
      status: documents.status,
      title: documents.title,
      abstract: documents.abstract,
      content: documents.content,
      coverImageUrl: documents.coverImageUrl,
      slug: documents.slug,
      authorship: documents.authorship,
      publishedAt: documents.publishedAt,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .innerJoin(documentTypes, eq(documents.typeId, documentTypes.id))
    .where(eq(documents.id, documentId))
    .limit(1);

  if (docResult.length === 0 || docResult[0]!.authorId !== authorId) {
    throw new NotFoundError('Document not found');
  }

  const doc = docResult[0]!;

  const styleResult = await db
    .select()
    .from(documentStyles)
    .where(eq(documentStyles.documentId, documentId))
    .limit(1);

  const style = styleResult[0] ?? {
    typography: 'sans',
    paperStyle: null,
    paperTexture: null,
    coverSettings: null,
    documentHeader: null,
    documentFooter: null,
    documentSignature: null,
  };

  return {
    ...doc,
    content: doc.content as Record<string, unknown> | null,
    authorship: doc.authorship as Authorship | null,
    style: {
      typography: style.typography,
      paperStyle: style.paperStyle as Record<string, unknown> | null,
      paperTexture: style.paperTexture as Record<string, unknown> | null,
      coverSettings: style.coverSettings as Record<string, unknown> | null,
      documentHeader: style.documentHeader as Record<string, unknown> | null,
      documentFooter: style.documentFooter as Record<string, unknown> | null,
      documentSignature: style.documentSignature as Record<string, unknown> | null,
    },
  };
}

export interface FeedParams {
  cursor?: string;
  limit?: number;
  type?: string;
  author?: string;
  q?: string;
  sort?: 'recent' | 'popular';
  category?: string;
  tag?: string;
}

export interface FeedResult {
  items: DocumentCard[];
  nextCursor: string | null;
  total: number;
}

export interface DocumentCard {
  id: string;
  title: string;
  abstract: string | null;
  coverImageUrl: string | null;
  slug: string;
  publishedAt: Date;
  typeName: string;
  author: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  authorship: {
    publicIdentifier: string;
  };
  likesCount: number;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  tags: {
    id: string;
    name: string;
    slug: string;
  }[];
}

export interface AuthorFeedParams {
  cursor?: string;
  limit?: number;
  type?: string;
}

export interface DocumentFull {
  id: string;
  title: string;
  abstract: string | null;
  content: Record<string, unknown> | null;
  coverImageUrl: string | null;
  slug: string;
  publishedAt: Date;
  typeName: string;
  author: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  style: {
    typography: string;
    paperStyle: Record<string, unknown> | null;
    paperTexture: Record<string, unknown> | null;
    coverSettings: Record<string, unknown> | null;
    documentHeader: Record<string, unknown> | null;
    documentFooter: Record<string, unknown> | null;
    documentSignature: Record<string, unknown> | null;
  };
  authorship: Authorship;
  likes: {
    likesCount: number;
    likedByMe: boolean | null;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  tags: {
    id: string;
    name: string;
    slug: string;
  }[];
  exercises?: unknown[];
}

/**
 * Get public feed of published documents with cursor-based pagination.
 * @param params - Feed parameters (cursor, limit, type, author, q, sort, category, tag)
 * @returns Feed result with items, nextCursor, and total count
 */
export async function getPublicFeed(params: FeedParams): Promise<FeedResult> {
  const limit = Math.min(params.limit ?? 20, 50);
  const conditions: ReturnType<typeof eq>[] = [];

  conditions.push(eq(documents.status, 'published'));
  conditions.push(isNull(documents.deletedAt));

  if (params.type) {
    conditions.push(eq(documentTypes.name, params.type));
  }

  if (params.author) {
    conditions.push(eq(profiles.username, params.author));
  }

  if (params.cursor) {
    const { publishedAt, id } = decodeCursor(params.cursor);
    conditions.push(lt(documents.publishedAt, publishedAt));
  }

  const likesSubquery = sql<number>`(SELECT COUNT(*) FROM document_likes WHERE document_id = ${documents.id})`;

  let baseQuery = db
    .select({
      id: documents.id,
      title: documents.title,
      abstract: documents.abstract,
      coverImageUrl: documents.coverImageUrl,
      slug: documents.slug,
      publishedAt: documents.publishedAt,
      typeName: documentTypes.name,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      authorship: documents.authorship,
      likesCount: likesSubquery,
    })
    .from(documents)
    .innerJoin(documentTypes, eq(documents.typeId, documentTypes.id))
    .innerJoin(profiles, eq(documents.authorId, profiles.id))
    .innerJoin(users, eq(profiles.userId, users.id));

  let results: any[];

  if (params.q) {
    const searchPattern = `%${params.q}%`;
    results = await baseQuery
      .where(
        and(
          ...conditions,
          or(
            ilike(documents.title, searchPattern),
            ilike(documents.abstract, searchPattern)
          )
        )
      )
      .orderBy(params.sort === 'popular' ? desc(likesSubquery) : desc(documents.publishedAt), desc(documents.id))
      .limit(limit + 1);
  } else {
    results = await baseQuery
      .where(and(...conditions))
      .orderBy(params.sort === 'popular' ? desc(likesSubquery) : desc(documents.publishedAt), desc(documents.id))
      .limit(limit + 1);
  }

  if (params.category || params.tag) {
    let filtered: string[] = results.map((r) => r.id);
    if (params.category) {
      const catDocs = await db
        .select({ documentId: documentCategories.documentId })
        .from(documentCategories)
        .innerJoin(categories, eq(documentCategories.categoryId, categories.id))
        .where(eq(categories.slug, params.category));

      filtered = filtered.filter((id) => catDocs.some((c) => c.documentId === id));
    }
    if (params.tag) {
      const tagDocs = await db
        .select({ documentId: documentTags.documentId })
        .from(documentTags)
        .innerJoin(tagsTable, eq(documentTags.tagId, tagsTable.id))
        .where(eq(tagsTable.slug, params.tag));

      filtered = filtered.filter((id) => tagDocs.some((t) => t.documentId === id));
    }
    results = results.filter((r) => filtered.includes(r.id));
  }

  const hasMore = results.length > limit;
  if (hasMore) {
    results.pop();
  }

  const items: DocumentCard[] = await Promise.all(
    results.map(async (r) => {
      const authorship = r.authorship as Authorship | null;
      const docTags = await getDocumentTags(r.id);
      const docCategory = await getDocumentCategory(r.id);
      return {
        id: r.id,
        title: r.title,
        abstract: r.abstract,
        coverImageUrl: r.coverImageUrl,
        slug: r.slug,
        publishedAt: r.publishedAt as Date,
        typeName: r.typeName,
        author: {
          username: r.username,
          displayName: r.displayName,
          avatarUrl: r.avatarUrl,
        },
        authorship: {
          publicIdentifier: authorship?.publicIdentifier ?? '',
        },
        likesCount: Number(r.likesCount ?? 0),
        category: docCategory
          ? { id: docCategory.id, name: docCategory.name, slug: docCategory.slug }
          : null,
        tags: docTags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
      };
    })
  );

  const lastResult = results[results.length - 1];
  const nextCursor = hasMore && lastResult
    ? encodeCursor(lastResult.publishedAt as Date, lastResult.id)
    : null;

  let countConditions = [...conditions];
  let countQuery = db
    .select({ count: count() })
    .from(documents)
    .innerJoin(documentTypes, eq(documents.typeId, documentTypes.id))
    .innerJoin(profiles, eq(documents.authorId, profiles.id))
    .innerJoin(users, eq(profiles.userId, users.id))
    .where(and(...countConditions));

  if (params.q) {
    const searchPattern = `%${params.q}%`;
    countQuery = db
      .select({ count: count() })
      .from(documents)
      .innerJoin(documentTypes, eq(documents.typeId, documentTypes.id))
      .innerJoin(profiles, eq(documents.authorId, profiles.id))
      .innerJoin(users, eq(profiles.userId, users.id))
      .where(
        and(
          ...countConditions,
          or(
            ilike(documents.title, searchPattern),
            ilike(documents.abstract, searchPattern)
          )
        )
      ) as typeof countQuery;
  }

  const totalResult = await countQuery;
  let total = Number(totalResult[0]?.count ?? 0);

  if (params.category || params.tag) {
    const docIds = results.map((r) => r.id);
    total = docIds.length;
  }

  return { items, nextCursor, total };
}

/**
 * Get a full public document by username and slug.
 * @param username - The author's username
 * @param slug - The document's slug
 * @returns Full document with style, authorship, and exercises if tutorial
 * @throws NotFoundError if document not found, deleted, or not published
 */
export async function getPublicDocument(username: string, slug: string, userId?: string): Promise<DocumentFull> {
  const docResult = await db
    .select({
      id: documents.id,
      title: documents.title,
      abstract: documents.abstract,
      content: documents.content,
      coverImageUrl: documents.coverImageUrl,
      slug: documents.slug,
      publishedAt: documents.publishedAt,
      typeName: documentTypes.name,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      authorship: documents.authorship,
    })
    .from(documents)
    .innerJoin(documentTypes, eq(documents.typeId, documentTypes.id))
    .innerJoin(profiles, eq(documents.authorId, profiles.id))
    .innerJoin(users, eq(profiles.userId, users.id))
    .where(
      and(
        eq(profiles.username, username),
        eq(documents.slug, slug),
        eq(documents.status, 'published'),
        isNull(documents.deletedAt),
        isNull(profiles.deletedAt),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (docResult.length === 0) {
    throw new NotFoundError('Document not found');
  }

  const doc = docResult[0]!;
  const likesData = await getLikesCount(doc.id, userId);
  const docTags = await getDocumentTags(doc.id);
  const docCategory = await getDocumentCategory(doc.id);

  const styleResult = await db
    .select()
    .from(documentStyles)
    .where(eq(documentStyles.documentId, doc.id))
    .limit(1);

  const style = styleResult[0] ?? {
    typography: 'sans',
    paperStyle: null,
    paperTexture: null,
    coverSettings: null,
    documentHeader: null,
    documentFooter: null,
    documentSignature: null,
  };

  const result: DocumentFull = {
    id: doc.id,
    title: doc.title,
    abstract: doc.abstract,
    content: doc.content as Record<string, unknown> | null,
    coverImageUrl: doc.coverImageUrl,
    slug: doc.slug,
    publishedAt: doc.publishedAt as Date,
    typeName: doc.typeName,
    author: {
      username: doc.username,
      displayName: doc.displayName,
      avatarUrl: doc.avatarUrl,
    },
    style: {
      typography: style.typography,
      paperStyle: style.paperStyle as Record<string, unknown> | null,
      paperTexture: style.paperTexture as Record<string, unknown> | null,
      coverSettings: style.coverSettings as Record<string, unknown> | null,
      documentHeader: style.documentHeader as Record<string, unknown> | null,
      documentFooter: style.documentFooter as Record<string, unknown> | null,
      documentSignature: style.documentSignature as Record<string, unknown> | null,
    },
    authorship: doc.authorship as Authorship,
    likes: {
      likesCount: likesData.likesCount,
      likedByMe: likesData.likedByMe,
    },
    category: docCategory
      ? { id: docCategory.id, name: docCategory.name, slug: docCategory.slug }
      : null,
    tags: docTags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
  };

  if (doc.typeName === 'tutorial') {
    const { getExercises } = await import('../tutorial-exercises/tutorial-exercises.service');
    result.exercises = await getExercises(doc.id);
  }

  return result;
}

/**
 * Get published documents by a specific author with cursor-based pagination.
 * @param username - The author's username
 * @param params - Feed parameters (cursor, limit, type)
 * @returns Feed result with items, nextCursor, and total count
 * @throws NotFoundError if profile not found or deleted
 */
export async function getAuthorPublicDocuments(username: string, params: AuthorFeedParams): Promise<FeedResult> {
  const profileResult = await db
    .select()
    .from(profiles)
    .innerJoin(users, eq(profiles.userId, users.id))
    .where(
      and(
        eq(profiles.username, username),
        isNull(profiles.deletedAt),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (profileResult.length === 0) {
    throw new NotFoundError('Profile not found');
  }

  const profile = profileResult[0]!;
  const limit = Math.min(params.limit ?? 20, 50);
  const conditions: ReturnType<typeof eq>[] = [];

  conditions.push(eq(documents.authorId, profile.profiles.id));
  conditions.push(eq(documents.status, 'published'));
  conditions.push(isNull(documents.deletedAt));

  if (params.type) {
    conditions.push(eq(documentTypes.name, params.type));
  }

  if (params.cursor) {
    const { publishedAt, id } = decodeCursor(params.cursor);
    conditions.push(lt(documents.publishedAt, publishedAt));
  }

  const likesSubquery = sql<number>`(SELECT COUNT(*) FROM document_likes WHERE document_id = ${documents.id})`;

  const results = await db
    .select({
      id: documents.id,
      title: documents.title,
      abstract: documents.abstract,
      coverImageUrl: documents.coverImageUrl,
      slug: documents.slug,
      publishedAt: documents.publishedAt,
      typeName: documentTypes.name,
      username: profiles.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
      authorship: documents.authorship,
      likesCount: likesSubquery,
    })
    .from(documents)
    .innerJoin(documentTypes, eq(documents.typeId, documentTypes.id))
    .innerJoin(profiles, eq(documents.authorId, profiles.id))
    .where(and(...conditions))
    .orderBy(desc(documents.publishedAt), desc(documents.id))
    .limit(limit + 1);

  const hasMore = results.length > limit;
  if (hasMore) {
    results.pop();
  }

  const items: DocumentCard[] = await Promise.all(
    results.map(async (r) => {
      const authorship = r.authorship as Authorship | null;
      const docTags = await getDocumentTags(r.id);
      const docCategory = await getDocumentCategory(r.id);
      return {
        id: r.id,
        title: r.title,
        abstract: r.abstract,
        coverImageUrl: r.coverImageUrl,
        slug: r.slug,
        publishedAt: r.publishedAt as Date,
        typeName: r.typeName,
        author: {
          username: r.username,
          displayName: r.displayName,
          avatarUrl: r.avatarUrl,
        },
        authorship: {
          publicIdentifier: authorship?.publicIdentifier ?? '',
        },
        likesCount: Number(r.likesCount ?? 0),
        category: docCategory
          ? { id: docCategory.id, name: docCategory.name, slug: docCategory.slug }
          : null,
        tags: docTags.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
      };
    })
  );

  const lastResult = results[results.length - 1];
  const nextCursor = hasMore && lastResult
    ? encodeCursor(lastResult.publishedAt as Date, lastResult.id)
    : null;

  const totalResult = await db
    .select({ count: count() })
    .from(documents)
    .innerJoin(documentTypes, eq(documents.typeId, documentTypes.id))
    .where(and(...conditions));

  const total = Number(totalResult[0]?.count ?? 0);

  return { items, nextCursor, total };
}
