-- 0018: Expand platform_apps + create app_invites table
-- Applied manually via: docker cp ... && docker exec psql

-- 1. Add new columns to platform_apps (nullable, safe on existing rows)
ALTER TABLE platform_apps ADD COLUMN access_mode text NOT NULL DEFAULT 'open';
ALTER TABLE platform_apps ADD COLUMN icon_url text;
ALTER TABLE platform_apps ADD COLUMN tagline text;
ALTER TABLE platform_apps ADD COLUMN category text;

-- 2. Create app_invites table
CREATE TABLE app_invites (
  id text PRIMARY KEY,
  app_id text NOT NULL REFERENCES platform_apps(id) ON DELETE CASCADE,
  profile_id text NOT NULL REFERENCES profiles(id),
  invited_by text NOT NULL REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'accepted',
  created_at timestamp NOT NULL DEFAULT now(),
  decided_at timestamp,
  CONSTRAINT app_invites_app_id_profile_id_unique UNIQUE (app_id, profile_id)
);

-- 3. Index for fast invite lookups (activateApps beta check)
CREATE INDEX idx_app_invites_lookup ON app_invites (app_id, profile_id, status);
