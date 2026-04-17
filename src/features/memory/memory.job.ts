import { env } from '../../config/env';
import { features } from '../../config/features';

const GEMINI_EMBEDDING_URL = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!features.memory || !env.GEMINI_API_KEY) {
    throw new Error('Memory feature is disabled or API key missing');
  }

  const response = await fetch(`${GEMINI_EMBEDDING_URL}?key=${env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: {
        parts: [{ text }],
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as { embedding?: { values: number[] } };
  
  if (!data.embedding?.values) {
    throw new Error('Invalid response from Gemini: missing embedding values');
  }

  return data.embedding.values;
}

export async function indexSource(
  sourceType: string,
  sourceId: string,
  userId: string,
  text: string
): Promise<void> {
  if (!features.memory) {
    return;
  }

  try {
    const embedding = await generateEmbedding(text);
    const embeddingJson = JSON.stringify(embedding);

    const { db } = await import('../../db/index');
    const { embeddings } = await import('./memory.schema');
    const { createId } = await import('@paralleldrive/cuid2');

    await db
      .insert(embeddings)
      .values({
        id: createId(),
        userId,
        sourceType,
        sourceId,
        embedding: embeddingJson,
        indexedAt: new Date(),
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [embeddings.userId, embeddings.sourceType, embeddings.sourceId],
        set: {
          embedding: embeddingJson,
          indexedAt: new Date(),
        },
      });
  } catch (err) {
    console.error('Failed to index source:', err);
  }
}

export async function removeSource(
  sourceType: string,
  sourceId: string,
  userId: string
): Promise<void> {
  if (!features.memory) {
    return;
  }

  const { db } = await import('../../db/index');
  const { embeddings } = await import('./memory.schema');
  const { and, eq } = await import('drizzle-orm');

  await db
    .delete(embeddings)
    .where(
      and(
        eq(embeddings.userId, userId),
        eq(embeddings.sourceType, sourceType),
        eq(embeddings.sourceId, sourceId)
      )
    );
}