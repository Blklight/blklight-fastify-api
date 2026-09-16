-- Migration: Session 32 — Memory embeddings move to native pgvector.
-- embeddings.embedding changes from text (a JSON.stringify'd number array, with
-- cosine distance computed in JS) to native vector(768) — the dimension of the
-- Gemini text-embedding-004 model. This enables the native <=> operator and the
-- HNSW cosine index declared in memory.schema.ts.
--
-- DOCUMENTED EXCEPTION (pattern: manual migrations 0015-0018): `drizzle-kit
-- generate` produced statement 2 (ALTER COLUMN) and statement 3 (HNSW index),
-- but it cannot express a data backfill. Statement 1 below was added by hand and
-- runs inside this journaled migration (via db:migrate). It re-emits the stored
-- JSON-array text as a compact vector literal before the type change. The USING
-- clause on statement 2 was also added by hand so the text -> vector conversion
-- is explicit. See AGENTS.md > Migration Process.

-- 1) Backfill (hand-added): JSON array text -> compact vector literal text.
--    Casting through jsonb validates the payload and re-serializes it; the
--    whitespace strip guarantees the compact literal pgvector accepts.
UPDATE "embeddings"
SET "embedding" = regexp_replace("embedding"::jsonb::text, '\s+', '', 'g');

--> statement-breakpoint
-- 2) Type change (drizzle-kit generated; USING clause added by hand).
ALTER TABLE "embeddings" ALTER COLUMN "embedding" SET DATA TYPE vector(768) USING "embedding"::vector;

--> statement-breakpoint
-- 3) HNSW cosine index (drizzle-kit generated from memory.schema.ts).
CREATE INDEX "embeddings_embedding_hnsw_index" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);
