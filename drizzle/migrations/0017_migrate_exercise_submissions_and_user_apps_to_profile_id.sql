-- Phase 1: exercise_submissions (user_id → profile_id)

-- 1. Add nullable profile_id column
ALTER TABLE exercise_submissions ADD COLUMN profile_id TEXT;

-- 2. Backfill from profiles
UPDATE exercise_submissions es
SET profile_id = p.id
FROM profiles p
WHERE es.user_id = p.user_id;

-- 3. Orphan check
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM exercise_submissions WHERE profile_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Orphaned exercise_submissions rows found';
  END IF;
END $$;

-- 4. Drop old column
ALTER TABLE exercise_submissions DROP COLUMN user_id;

-- 5. Set NOT NULL
ALTER TABLE exercise_submissions ALTER COLUMN profile_id SET NOT NULL;

-- 6. Add FK + UNIQUE
ALTER TABLE exercise_submissions
  ADD CONSTRAINT exercise_submissions_profile_id_fk
  FOREIGN KEY (profile_id) REFERENCES profiles(id);

ALTER TABLE exercise_submissions
  ADD CONSTRAINT exercise_submissions_profile_id_exercise_id_unique
  UNIQUE (profile_id, exercise_id);


-- Phase 2: user_apps (user_id → profile_id)

-- 1. Add nullable profile_id column
ALTER TABLE user_apps ADD COLUMN profile_id TEXT;

-- 2. Backfill from profiles
UPDATE user_apps ua
SET profile_id = p.id
FROM profiles p
WHERE ua.user_id = p.user_id;

-- 3. Orphan check
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM user_apps WHERE profile_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Orphaned user_apps rows found';
  END IF;
END $$;

-- 4. Drop old column
ALTER TABLE user_apps DROP COLUMN user_id;

-- 5. Set NOT NULL
ALTER TABLE user_apps ALTER COLUMN profile_id SET NOT NULL;

-- 6. Add FK + UNIQUE
ALTER TABLE user_apps
  ADD CONSTRAINT user_apps_profile_id_fk
  FOREIGN KEY (profile_id) REFERENCES profiles(id);

ALTER TABLE user_apps
  ADD CONSTRAINT user_apps_profile_id_app_id_unique
  UNIQUE (profile_id, app_id);
