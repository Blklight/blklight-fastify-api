-- Manual migration — NOT registered in drizzle/migrations/meta/_journal.json.
-- Applied manually, never by `npm run db:migrate` (see AGENTS.md > Migration Process).
--
-- Why: sessions.refresh_token now stores the SHA-256 digest of the refresh
-- token instead of the plaintext. Every row written before that change holds a
-- plaintext token, which can no longer match the digest this API computes when
-- reading the cookie, so those sessions would all fail authentication.
--
-- There is no way to backfill the digests: the plaintext is only known to the
-- browser cookie, not to the database. The only safe action is to drop them and
-- make those users log in again. Security-wise this is also the desired
-- outcome — those tokens were stored in the clear, so they are all considered
-- compromised and must not survive.
--
-- Applied on the dev DB with the sessions table holding 63 legacy rows.

DELETE FROM "sessions";
