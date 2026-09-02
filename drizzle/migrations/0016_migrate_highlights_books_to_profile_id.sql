-- Migration: Phase 2 — Migrate highlights, highlight_palette, book_progress, book_chapter_progress from user_id to profile_id

-- =============================================================================
-- highlights (no UNIQUE on profile_id — it's 1:N)
-- =============================================================================

ALTER TABLE "highlights" ADD COLUMN "profile_id" text;

UPDATE "highlights" SET "profile_id" = (
  SELECT p."id" FROM "profiles" p WHERE p."user_id" = "highlights"."user_id"
);

DO $$ DECLARE
  orphan_count integer;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM "highlights" WHERE "profile_id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % highlights rows have no matching profile', orphan_count;
  END IF;
END $$;

ALTER TABLE "highlights" DROP COLUMN "user_id";

ALTER TABLE "highlights" ALTER COLUMN "profile_id" SET NOT NULL;

ALTER TABLE "highlights" ADD CONSTRAINT "highlights_profile_id_fk"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id");

-- =============================================================================
-- highlight_palette (1:1 — UNIQUE on profile_id)
-- =============================================================================

ALTER TABLE "highlight_palette" ADD COLUMN "profile_id" text;

UPDATE "highlight_palette" SET "profile_id" = (
  SELECT p."id" FROM "profiles" p WHERE p."user_id" = "highlight_palette"."user_id"
);

DO $$ DECLARE
  orphan_count integer;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM "highlight_palette" WHERE "profile_id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % highlight_palette rows have no matching profile', orphan_count;
  END IF;
END $$;

ALTER TABLE "highlight_palette" DROP COLUMN "user_id";

ALTER TABLE "highlight_palette" ALTER COLUMN "profile_id" SET NOT NULL;

ALTER TABLE "highlight_palette" ADD CONSTRAINT "highlight_palette_profile_id_fk"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id");

ALTER TABLE "highlight_palette" ADD CONSTRAINT "highlight_palette_profile_id_key"
  UNIQUE ("profile_id");

-- =============================================================================
-- book_progress (UNIQUE on profile_id, book_id)
-- =============================================================================

ALTER TABLE "book_progress" ADD COLUMN "profile_id" text;

UPDATE "book_progress" SET "profile_id" = (
  SELECT p."id" FROM "profiles" p WHERE p."user_id" = "book_progress"."user_id"
);

DO $$ DECLARE
  orphan_count integer;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM "book_progress" WHERE "profile_id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % book_progress rows have no matching profile', orphan_count;
  END IF;
END $$;

ALTER TABLE "book_progress" DROP COLUMN "user_id";

ALTER TABLE "book_progress" ALTER COLUMN "profile_id" SET NOT NULL;

ALTER TABLE "book_progress" ADD CONSTRAINT "book_progress_profile_id_fk"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id");

ALTER TABLE "book_progress" ADD CONSTRAINT "book_progress_profile_id_book_id_key"
  UNIQUE ("profile_id", "book_id");

-- =============================================================================
-- book_chapter_progress (UNIQUE on profile_id, chapter_id)
-- =============================================================================

ALTER TABLE "book_chapter_progress" ADD COLUMN "profile_id" text;

UPDATE "book_chapter_progress" SET "profile_id" = (
  SELECT p."id" FROM "profiles" p WHERE p."user_id" = "book_chapter_progress"."user_id"
);

DO $$ DECLARE
  orphan_count integer;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM "book_chapter_progress" WHERE "profile_id" IS NULL;
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'ABORT: % book_chapter_progress rows have no matching profile', orphan_count;
  END IF;
END $$;

ALTER TABLE "book_chapter_progress" DROP COLUMN "user_id";

ALTER TABLE "book_chapter_progress" ALTER COLUMN "profile_id" SET NOT NULL;

ALTER TABLE "book_chapter_progress" ADD CONSTRAINT "book_chapter_progress_profile_id_fk"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id");

ALTER TABLE "book_chapter_progress" ADD CONSTRAINT "book_chapter_progress_profile_id_chapter_id_key"
  UNIQUE ("profile_id", "chapter_id");
