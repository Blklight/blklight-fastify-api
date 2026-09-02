-- Migration: Phase 1 — Migrate document_likes and document_bookmarks from user_id to profile_id

-- =============================================================================
-- document_likes
-- =============================================================================

-- Step 1: Add nullable profile_id column
ALTER TABLE "document_likes" ADD COLUMN "profile_id" text;

-- Step 2: Backfill from profiles
UPDATE "document_likes" SET "profile_id" = (
  SELECT p."id" FROM "profiles" p WHERE p."user_id" = "document_likes"."user_id"
);

-- Step 2b: Verify no orphans before proceeding
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM "document_likes" WHERE "profile_id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % document_likes rows have no matching profile', orphan_count;
  END IF;
END $$;

-- Step 3: Drop old unique constraint
ALTER TABLE "document_likes" DROP CONSTRAINT "document_likes_user_id_document_id_key";

-- Step 4: Drop old user_id column (cascades FK)
ALTER TABLE "document_likes" DROP COLUMN "user_id";

-- Step 5: Make profile_id NOT NULL
ALTER TABLE "document_likes" ALTER COLUMN "profile_id" SET NOT NULL;

-- Step 6: Add FK to profiles
ALTER TABLE "document_likes" ADD CONSTRAINT "document_likes_profile_id_fk"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id");

-- Step 7: Add new unique constraint
ALTER TABLE "document_likes" ADD CONSTRAINT "document_likes_profile_id_document_id_key"
  UNIQUE ("profile_id", "document_id");

-- =============================================================================
-- document_bookmarks
-- =============================================================================

-- Step 1: Add nullable profile_id column
ALTER TABLE "document_bookmarks" ADD COLUMN "profile_id" text;

-- Step 2: Backfill from profiles
UPDATE "document_bookmarks" SET "profile_id" = (
  SELECT p."id" FROM "profiles" p WHERE p."user_id" = "document_bookmarks"."user_id"
);

-- Step 2b: Verify no orphans before proceeding
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM "document_bookmarks" WHERE "profile_id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % document_bookmarks rows have no matching profile', orphan_count;
  END IF;
END $$;

-- Step 3: Drop old unique constraint
ALTER TABLE "document_bookmarks" DROP CONSTRAINT "document_bookmarks_user_id_document_id_key";

-- Step 4: Drop old user_id column (cascades FK)
ALTER TABLE "document_bookmarks" DROP COLUMN "user_id";

-- Step 5: Make profile_id NOT NULL
ALTER TABLE "document_bookmarks" ALTER COLUMN "profile_id" SET NOT NULL;

-- Step 6: Add FK to profiles
ALTER TABLE "document_bookmarks" ADD CONSTRAINT "document_bookmarks_profile_id_fk"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id");

-- Step 7: Add new unique constraint
ALTER TABLE "document_bookmarks" ADD CONSTRAINT "document_bookmarks_profile_id_document_id_key"
  UNIQUE ("profile_id", "document_id");
