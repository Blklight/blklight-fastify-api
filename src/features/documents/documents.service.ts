import { eq, and, isNull, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '../../db/index';
import { documents, documentTypes, documentStyles, Document, NewDocument, NewDocumentStyle } from './documents.schema';
import { profiles } from '../profiles/profiles.schema';
import { signDocument } from '../signatures/signatures.service';
import { ValidationError, NotFoundError } from '../../utils/errors';
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

  if (typeName === 'note') {
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
