-- Migration: 0019_baseline_profile_id_migration
-- Purpose: Formalizes in the drizzle-kit journal changes already applied MANUALLY
-- via 0015-0018 (2026-08-19 to 2026-09-01). This file documents the aggregate
-- 0014 -> current schema.ts drift (user_id -> profile_id on likes/bookmarks/
-- highlights/books/progress/exercise_submissions/user_apps, platform_apps
-- expansion, and the app_invites table).
--
-- IMPORTANT: This migration is recorded as APPLIED WITHOUT EXECUTION. It must
-- NOT be run via db:migrate. Its hash was inserted directly into
-- drizzle.__drizzle_migrations; the DDL it describes already exists in the DB.
--
-- NAMING DIVERGENCE: Constraint names in this file reflect the .references()
-- convention from src/features/**/*.schema.ts and MAY DIVERGE from the real
-- constraint names in the database (e.g. real document_likes_profile_id_fk vs
-- generated document_likes_profile_id_profiles_id_fk). See
-- docs/MIGRATION_0015_0018_GITIGNORE_REPORT.md for the actual applied names.
CREATE TABLE "app_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"invited_by" text NOT NULL,
	"status" text DEFAULT 'accepted' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	CONSTRAINT "app_invites_app_id_profile_id_unique" UNIQUE("app_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "document_bookmarks" DROP CONSTRAINT "document_bookmarks_user_id_document_id_unique";--> statement-breakpoint
ALTER TABLE "book_chapter_progress" DROP CONSTRAINT "book_chapter_progress_user_id_chapter_id_unique";--> statement-breakpoint
ALTER TABLE "book_progress" DROP CONSTRAINT "book_progress_user_id_book_id_unique";--> statement-breakpoint
ALTER TABLE "highlight_palette" DROP CONSTRAINT "highlight_palette_user_id_unique";--> statement-breakpoint
ALTER TABLE "document_likes" DROP CONSTRAINT "document_likes_user_id_document_id_unique";--> statement-breakpoint
ALTER TABLE "user_apps" DROP CONSTRAINT "user_apps_user_id_app_id_unique";--> statement-breakpoint
ALTER TABLE "exercise_submissions" DROP CONSTRAINT "exercise_submissions_user_id_exercise_id_unique";--> statement-breakpoint
ALTER TABLE "document_bookmarks" DROP CONSTRAINT "document_bookmarks_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "book_chapter_progress" DROP CONSTRAINT "book_chapter_progress_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "book_progress" DROP CONSTRAINT "book_progress_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "highlight_palette" DROP CONSTRAINT "highlight_palette_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "highlights" DROP CONSTRAINT "highlights_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "document_likes" DROP CONSTRAINT "document_likes_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "user_apps" DROP CONSTRAINT "user_apps_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "exercise_submissions" DROP CONSTRAINT "exercise_submissions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "document_bookmarks" ADD COLUMN "profile_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "book_chapter_progress" ADD COLUMN "profile_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "book_progress" ADD COLUMN "profile_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "highlight_palette" ADD COLUMN "profile_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "highlights" ADD COLUMN "profile_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "document_likes" ADD COLUMN "profile_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_apps" ADD COLUMN "access_mode" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_apps" ADD COLUMN "icon_url" text;--> statement-breakpoint
ALTER TABLE "platform_apps" ADD COLUMN "tagline" text;--> statement-breakpoint
ALTER TABLE "platform_apps" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "user_apps" ADD COLUMN "profile_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_submissions" ADD COLUMN "profile_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "app_invites" ADD CONSTRAINT "app_invites_app_id_platform_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."platform_apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_invites" ADD CONSTRAINT "app_invites_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_invites" ADD CONSTRAINT "app_invites_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_bookmarks" ADD CONSTRAINT "document_bookmarks_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_chapter_progress" ADD CONSTRAINT "book_chapter_progress_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_progress" ADD CONSTRAINT "book_progress_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlight_palette" ADD CONSTRAINT "highlight_palette_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_likes" ADD CONSTRAINT "document_likes_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_apps" ADD CONSTRAINT "user_apps_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_submissions" ADD CONSTRAINT "exercise_submissions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_bookmarks" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "book_chapter_progress" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "book_progress" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "highlight_palette" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "highlights" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "document_likes" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "user_apps" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "exercise_submissions" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "document_bookmarks" ADD CONSTRAINT "document_bookmarks_profile_id_document_id_unique" UNIQUE("profile_id","document_id");--> statement-breakpoint
ALTER TABLE "book_chapter_progress" ADD CONSTRAINT "book_chapter_progress_profile_id_chapter_id_unique" UNIQUE("profile_id","chapter_id");--> statement-breakpoint
ALTER TABLE "book_progress" ADD CONSTRAINT "book_progress_profile_id_book_id_unique" UNIQUE("profile_id","book_id");--> statement-breakpoint
ALTER TABLE "highlight_palette" ADD CONSTRAINT "highlight_palette_profile_id_unique" UNIQUE("profile_id");--> statement-breakpoint
ALTER TABLE "document_likes" ADD CONSTRAINT "document_likes_profile_id_document_id_unique" UNIQUE("profile_id","document_id");--> statement-breakpoint
ALTER TABLE "user_apps" ADD CONSTRAINT "user_apps_profile_id_app_id_unique" UNIQUE("profile_id","app_id");--> statement-breakpoint
ALTER TABLE "exercise_submissions" ADD CONSTRAINT "exercise_submissions_profile_id_exercise_id_unique" UNIQUE("profile_id","exercise_id");