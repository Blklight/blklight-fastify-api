import { eq, and, ne, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index';
import { embeddings } from './memory.schema';
import { notes } from '../notes/notes.schema';
import { generateEmbedding } from './memory.job';

export interface MemorySearchResult {
  sourceType: string;
  sourceId: string;
  title: string | null;
  snippet: string;
  similarity: number;
}

async function resolveNoteTitle(noteId: string): Promise<{ title: string | null; content: string } | null> {
  const [note] = await db
    .select({ title: notes.title, content: notes.content })
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);

  return note ? { title: note.title, content: note.content } : null;
}

function getSimilarityScore(distance: number): number {
  return Math.max(0, 1 - distance);
}

export async function semanticSearch(
  userId: string,
  query: string,
  limit: number
): Promise<MemorySearchResult[]> {
  try {
    const queryEmbedding = await generateEmbedding(query);
    const queryVector = `[${queryEmbedding.join(',')}]`;
    const distanceExpr = sql<number>`${embeddings.embedding} <=> ${queryVector}::vector`;

    const rows = await db
      .select({
        sourceType: embeddings.sourceType,
        sourceId: embeddings.sourceId,
        distance: distanceExpr,
      })
      .from(embeddings)
      .where(eq(embeddings.userId, userId))
      .orderBy(distanceExpr)
      .limit(limit);

    const resolved: MemorySearchResult[] = [];

    for (const row of rows) {
      let title: string | null = null;
      let snippet = '';

      if (row.sourceType === 'note') {
        const noteData = await resolveNoteTitle(row.sourceId);
        if (noteData) {
          title = noteData.title;
          snippet = noteData.content.slice(0, 200);
        }
      }

      resolved.push({
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        title,
        snippet,
        similarity: getSimilarityScore(Number(row.distance)),
      });
    }

    return resolved;
  } catch (err) {
    console.error('Semantic search failed:', err);
    return [];
  }
}

export async function getRelated(
  userId: string,
  sourceType: string,
  sourceId: string,
  limit: number
): Promise<MemorySearchResult[]> {
  const [source] = await db
    .select({ id: embeddings.id, embedding: embeddings.embedding })
    .from(embeddings)
    .where(
      and(
        eq(embeddings.userId, userId),
        eq(embeddings.sourceType, sourceType),
        eq(embeddings.sourceId, sourceId)
      )
    )
    .limit(1);

  if (!source) {
    return [];
  }

  const sourceVector = `[${source.embedding.join(',')}]`;
  const distanceExpr = sql<number>`${embeddings.embedding} <=> ${sourceVector}::vector`;

  const related = await db
    .select({
      sourceType: embeddings.sourceType,
      sourceId: embeddings.sourceId,
      distance: distanceExpr,
    })
    .from(embeddings)
    .where(
      and(
        eq(embeddings.userId, userId),
        eq(embeddings.sourceType, sourceType),
        ne(embeddings.id, source.id)
      )
    )
    .orderBy(distanceExpr)
    .limit(limit);

  const resolved: MemorySearchResult[] = [];

  for (const row of related) {
    let title: string | null = null;
    let snippet = '';

    if (row.sourceType === 'note') {
      const noteData = await resolveNoteTitle(row.sourceId);
      if (noteData) {
        title = noteData.title;
        snippet = noteData.content.slice(0, 200);
      }
    }

    resolved.push({
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      title,
      snippet,
      similarity: getSimilarityScore(Number(row.distance)),
    });
  }

  return resolved;
}

export async function getDigest(userId: string): Promise<MemorySearchResult[]> {
  const recentEmbeddings: Array<{ id: string; sourceId: string; embedding: number[] }> = await db
    .select({ id: embeddings.id, sourceId: embeddings.sourceId, embedding: embeddings.embedding })
    .from(embeddings)
    .where(
      and(
        eq(embeddings.userId, userId),
        eq(embeddings.sourceType, 'note')
      )
    )
    .orderBy(embeddings.indexedAt)
    .limit(5);

  if (recentEmbeddings.length < 2) {
    return [];
  }

  const first = recentEmbeddings[0]!;
  const firstVector = `[${first.embedding.join(',')}]`;
  const distanceExpr = sql<number>`${embeddings.embedding} <=> ${firstVector}::vector`;
  const candidateIds = recentEmbeddings.slice(1).map(row => row.id);

  const rows = await db
    .select({
      sourceType: embeddings.sourceType,
      sourceId: embeddings.sourceId,
      distance: distanceExpr,
    })
    .from(embeddings)
    .where(
      and(
        eq(embeddings.userId, userId),
        eq(embeddings.sourceType, 'note'),
        inArray(embeddings.id, candidateIds)
      )
    )
    .orderBy(distanceExpr)
    .limit(5);

  const resolved: MemorySearchResult[] = [];

  for (const row of rows) {
    const noteData = await resolveNoteTitle(row.sourceId);
    resolved.push({
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      title: noteData?.title ?? null,
      snippet: noteData?.content.slice(0, 200) ?? '',
      similarity: getSimilarityScore(Number(row.distance)),
    });
  }

  return resolved;
}