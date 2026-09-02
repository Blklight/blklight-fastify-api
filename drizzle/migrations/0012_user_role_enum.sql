-- Migration: Session 30 - User role enum + rememberMe
-- Create enum type for user roles
DO $$ BEGIN
  CREATE TYPE "public"."user_role" AS ENUM ('user', 'admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Alter the role column to use the new enum type
-- Step 1: Drop the default value
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

-- Step 2: Cast the column type (text -> user_role)
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."user_role" USING "role"::text::user_role;

-- Step 3: Restore the default
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user';
