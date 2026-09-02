-- Migration: Session 27 - Canvas, Platform Apps, Semantic Memory
-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pgcrypto for gen_random_bytes in the data migration below
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Platform Apps (app catalog)
CREATE TABLE "platform_apps" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- User Apps (apps activated per user)
CREATE TABLE "user_apps" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "app_id" text NOT NULL REFERENCES "platform_apps"("id"),
  "activated_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE ("user_id", "app_id")
);

-- Canvas (spatial container for notes)
CREATE TABLE "canvas" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL UNIQUE REFERENCES "workspaces"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Canvas Positions (spatial layout of notes)
CREATE TABLE "canvas_positions" (
  "id" text PRIMARY KEY NOT NULL,
  "canvas_id" text NOT NULL REFERENCES "canvas"("id"),
  "note_id" text NOT NULL UNIQUE REFERENCES "notes"("id"),
  "x" real NOT NULL DEFAULT 0,
  "y" real NOT NULL DEFAULT 0,
  "w" real DEFAULT 200,
  "h" real DEFAULT 150,
  "z" integer DEFAULT 0,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE ("canvas_id", "note_id")
);

-- Embeddings (semantic memory)
CREATE TABLE "embeddings" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "source_type" text NOT NULL,
  "source_id" text NOT NULL,
  "embedding" text NOT NULL,
  "indexed_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE ("user_id", "source_type", "source_id")
);

-- Data migration: Create canvas for existing workspaces and update notes
-- This only runs once and is safe to re-run (idempotent)
INSERT INTO "canvas" ("id", "workspace_id", "created_at", "updated_at")
SELECT 
  encode(gen_random_bytes(16), 'hex'),
  "id",
  now(),
  now()
FROM "workspaces"
WHERE NOT EXISTS (
  SELECT 1 FROM "canvas" WHERE "canvas"."workspace_id" = "workspaces"."id"
);

-- Update notes to reference canvas instead of workspace
-- First create a mapping from workspace to canvas
-- Then update notes.canvas_id based on this mapping
ALTER TABLE "notes" ADD COLUMN "canvas_id" text REFERENCES "canvas"("id");
UPDATE "notes"
SET "canvas_id" = (
  SELECT "canvas"."id" 
  FROM "canvas" 
  INNER JOIN "workspaces" ON "canvas"."workspace_id" = "workspaces"."id"
  WHERE "workspaces"."id" = "notes"."workspace_id"
  LIMIT 1
)
WHERE "canvas_id" IS NULL AND "workspace_id" IS NOT NULL;

-- Now drop the workspace_id column from notes (after data is migrated)
ALTER TABLE "notes" DROP COLUMN "workspace_id";

-- canvas_id is NOT NULL in the schema; every note now has a mapping
ALTER TABLE "notes" ALTER COLUMN "canvas_id" SET NOT NULL;