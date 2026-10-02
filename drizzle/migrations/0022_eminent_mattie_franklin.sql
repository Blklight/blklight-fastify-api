-- Session rotation families (family_id / rotated_at / remember_me).
--
-- Hand-edited after `drizzle-kit generate`: the generator emits
-- `ADD COLUMN family_id text NOT NULL` with no default, which aborts on any
-- table that already has rows (63 sessions existed on the dev DB).
--
-- Strategy: add the column nullable, backfill every existing row with its own
-- id so each legacy session starts as its own single-token family, then set
-- NOT NULL. This keeps every pre-existing session usable and does not require
-- re-login. Same documented pattern used in 0020 (backfill before the type
-- change) and consistent with the manual-migration rule in AGENTS.md: this
-- file stays in _journal.json and is applied by `npm run db:migrate`.
ALTER TABLE "sessions" ADD COLUMN "family_id" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "rotated_at" timestamp;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "remember_me" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "sessions" SET "family_id" = "id" WHERE "family_id" IS NULL;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "family_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_family_id_idx" ON "sessions" USING btree ("family_id");
