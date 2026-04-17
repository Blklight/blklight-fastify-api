import { eq, and } from 'drizzle-orm';
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
    const queryJson = JSON.stringify(queryEmbedding);

    const results = await db
      .select()
      .from(embeddings)
      .where(eq(embeddings.userId, userId))
      .limit(limit);

    const withScores = results.map(row => {
      const emb = JSON.parse(row.embedding);
      const distance = cosineDistance(queryEmbedding, emb);
      return {
        ...row,
        distance,
        similarity: getSimilarityScore(distance),
      };
    }).sort((a, b) => b.similarity - a.similarity);

    const resolved: MemorySearchResult[] = [];

    for (const row of withScores) {
      let title: string | null = null;
      let snippet = '';

      if (row.sourceType === 'note') {
        const noteData = await resolveNoteTitle(row.sourceId);
        if (noteData) {
          title = noteData.title;
          snippet = noteData.content.slice(0, 200);
        }
      } else {
        title = null;
        snippet = '';
      }

      resolved.push({
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        title,
        snippet,
        similarity: row.similarity,
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
  const [embedding] = await db
    .select()
    .from(embeddings)
    .where(
      and(
        eq(embeddings.userId, userId),
        eq(embeddings.sourceType, sourceType),
        eq(embeddings.sourceId, sourceId)
      )
    )
    .limit(1);

  if (!embedding) {
    return [];
  }

  const embArray = JSON.parse(embedding.embedding);

  const related = await db
    .select()
    .from(embeddings)
    .where(
      and(
        eq(embeddings.userId, userId),
        eq(embeddings.sourceType, sourceType)
      )
    );

  const withScores = related
    .filter(r => r.id !== embedding.id)
    .map(row => {
      const emb = JSON.parse(row.embedding);
      const distance = cosineDistance(embArray, emb);
      return {
        ...row,
        distance,
        similarity: getSimilarityScore(distance),
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  const resolved: MemorySearchResult[] = [];

  for (const row of withScores) {
    let title: string | null = null;
    let snippet = '';

    if (row.sourceType === 'note') {
      const noteData = await resolveNoteTitle(row.sourceId);
      if (noteData) {
        title = noteData.title;
        snippet = noteData.content.slice(0, 200);
      }
    } else {
      title = null;
      snippet = '';
    }

    resolved.push({
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      title,
      snippet,
      similarity: row.similarity,
    });
  }

  return resolved;
}

export async function getDigest(userId: string): Promise<MemorySearchResult[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentEmbeddings = await db
    .select()
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
  const firstEmbedding = JSON.parse(first.embedding);

  const withScores = recentEmbeddings.slice(1).map(row => {
    const emb = JSON.parse(row.embedding);
    const distance = cosineDistance(firstEmbedding, emb);
    return {
      ...row,
      distance,
      similarity: getSimilarityScore(distance),
    };
  }).sort((a, b) => b.similarity - a.similarity);

  const resolved: MemorySearchResult[] = [];

  for (const row of withScores.slice(0, 5)) {
    const noteData = await resolveNoteTitle(row.sourceId);
    resolved.push({
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      title: noteData?.title ?? null,
      snippet: noteData?.content.slice(0, 200) ?? '',
      similarity: row.similarity,
    });
  }

  return resolved;
}

function cosineDistance(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dotProduct += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }

  if (normA === 0 || normB === 0) {
    return 1;
  }

  return 1 - (dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)));
}