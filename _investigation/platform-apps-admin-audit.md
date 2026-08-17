# Audit: `platform_apps` / `user_apps` — Schema, Service, Routes & Admin Conventions

> **Scope:** Full read-only audit of the `platform_apps`/`user_apps` domain in
> `blklight-fastify-api`. No code changes. Source references are inline.

---

## 1. Schema — `platform_apps`

**File:** `src/features/platform-apps/platform-apps.schema.ts:4-11`

```typescript
export const platformApps = pgTable('platform_apps', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

| Column      | Type      | Constraints            | Default   |
|-------------|-----------|------------------------|-----------|
| `id`        | `text`    | PK                     | —         |
| `slug`      | `text`    | `NOT NULL`, `UNIQUE`   | —         |
| `name`      | `text`    | `NOT NULL`             | —         |
| `description` | `text`  | nullable               | `NULL`    |
| `is_active` | `boolean` | `NOT NULL`             | `true`    |
| `created_at`| `timestamp`| `NOT NULL`            | `now()`   |

**No soft-delete column. No `updated_at`. Apps are immutable once seeded.**

Migration: `drizzle/migrations/0011_canvas_platform_apps_memory.sql:9-16`

```sql
CREATE TABLE "platform_apps" (
  "id" text PRIMARY KEY NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
```

---

## 2. Schema — `user_apps`

**File:** `src/features/platform-apps/platform-apps.schema.ts:13-20`

```typescript
export const userApps = pgTable('user_apps', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  appId: text('app_id').notNull().references(() => platformApps.id),
  activatedAt: timestamp('activated_at').defaultNow().notNull(),
}, (table) => ({
  userAppUnique: unique().on(table.userId, table.appId),
}));
```

| Column        | Type        | Constraints              | Default   |
|---------------|-------------|--------------------------|-----------|
| `id`          | `text`      | PK                       | —         |
| `user_id`     | `text`      | `NOT NULL`, FK → `users.id` | —      |
| `app_id`      | `text`      | `NOT NULL`, FK → `platform_apps.id` | — |
| `activated_at`| `timestamp` | `NOT NULL`               | `now()`   |

**Composite unique:** `(user_id, app_id)` — one row per user per app.

**No soft-delete column. No `deactivated_at`. No `role` or `status` field on the membership.**

Migration: `drizzle/migrations/0011_canvas_platform_apps_memory.sql:19-25`

```sql
CREATE TABLE "user_apps" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id"),
  "app_id" text NOT NULL REFERENCES "platform_apps"("id"),
  "activated_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE ("user_id", "app_id")
);
```

---

## 3. Service — `activateApps()` (post-revert `820f79e`)

**File:** `src/features/platform-apps/platform-apps.service.ts:28-63`

```typescript
export async function activateApps(userId: string, appSlugs: string[]) {
  if (appSlugs.length === 0) {
    throw new Error('No apps provided');
  }

  const apps = await db
    .select()
    .from(platformApps)
    .where(eq(platformApps.isActive, true));

  const validSlugs = new Set(apps.map(a => a.slug));
  const invalidSlugs = appSlugs.filter(s => !validSlugs.has(s));

  if (invalidSlugs.length > 0) {
    throw new Error(`Invalid app slugs: ${invalidSlugs.join(', ')}`);
  }

  const appIdsBySlug = new Map(apps.map(a => [a.slug, a.id]));

  const userAppRows: NewUserApp[] = appSlugs.map(slug => ({
    id: createId(),
    userId,
    appId: appIdsBySlug.get(slug)!,
    activatedAt: new Date(),
  }));

  for (const row of userAppRows) {
    await db
      .insert(userApps)
      .values(row)
      .onConflictDoUpdate({
        target: [userApps.userId, userApps.appId],
        set: { activatedAt: new Date() },
      });
  }
}
```

**Behaviour summary:**
- Validates slugs against all active `platform_apps` rows.
- Throws plain `Error` (not `ValidationError`) on invalid slugs.
- Upserts one `user_apps` row per slug — idempotent, safe to re-call.
- **Does NOT touch `users.onboarding_complete`** (reverted in commit `820f79e`).

All 4 service functions in `platform-apps.service.ts`:

| Function          | Lines  | Purpose                                    |
|-------------------|--------|--------------------------------------------|
| `listApps()`      | 6-11   | All active `platform_apps` rows            |
| `getUserApps()`   | 13-26  | User's activated apps joined with catalog  |
| `activateApps()`  | 28-63  | Upsert `user_apps` rows by slug            |
| `deactivateApp()` | 65-79  | Hard-delete a single `user_apps` row       |

---

## 4. Routes — `platform-apps.routes.ts`

**File:** `src/features/platform-apps/platform-apps.routes.ts`
**Prefix in `app.ts:196`:** `prefix: '/api/v1'`

| Method | Path                    | Auth     | preHandler                   | Validation         | Description                            |
|--------|-------------------------|----------|------------------------------|--------------------|----------------------------------------|
| `GET`  | `/platform-apps`        | **No**   | —                            | —                  | List all active platform apps (public) |
| `GET`  | `/platform-apps/me`     | Yes      | `app.authenticate`           | —                  | List current user's activated apps     |
| `POST` | `/platform-apps/me`     | Yes      | `app.authenticate`           | `activateAppsSchema` (`{ apps: string[] }`, min 1) | Activate apps for current user |
| `DELETE` | `/platform-apps/me/:appId` | Yes  | `app.authenticate`           | params: `{ appId: string }` | Deactivate (hard-delete) one app       |

**No admin-guarded endpoints exist in this route file.** All mutations (`POST`, `DELETE`) are self-service only (the user's own `user_apps` rows). There is no route to create, update, or delete `platform_apps` catalog rows via API — they are seeded exclusively via `src/db/seed.ts`.

**Zod schema** (`src/features/platform-apps/platform-apps.zod.ts:1-7`):

```typescript
export const activateAppsSchema = z.object({
  apps: z.array(z.string()).min(1),
});
```

---

## 5. Admin Route Conventions

### `requireAdmin` hook

**File:** `src/hooks/admin-guard.ts:1-8`

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '../utils/errors';

export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (request.user?.role !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
}
```

- Checks `request.user.role` — value comes from the JWT payload (set at token issue time in `auth.service.ts`).
- Throws `ForbiddenError` (HTTP 403) if not `'admin'`.
- Always used **after** `app.authenticate` in the `preHandler` array (auth runs first, then role check).

### Where `requireAdmin` is used

| Route file                | Endpoint(s) with `requireAdmin`                 | Route prefix            |
|---------------------------|------------------------------------------------|-------------------------|
| `categories.routes.ts`   | `POST /`, `PATCH /:id`, `DELETE /:id`          | `/api/v1/categories`    |
| `chat.routes.ts`         | `DELETE /servers/:serverId` (delete server)     | `/api/v1/chat`          |

**Pattern:** Admin endpoints live inside the same route file as their public/self-service counterparts — **there is no separate `/admin/*` prefix**. The guard is applied per-route via `preHandler`. Example from categories:

```typescript
preHandler: [
  (request, reply) => app.authenticate(request, reply),
  requireAdmin,
],
```

There is **no admin route yet for `platform_apps`** — no way to create, update, or soft-delete catalog entries via API. The AGENTS.md note confirms: *"No admin routes exist yet for user management (list users, change roles, etc.) — future."*

---

## 6. `role` Column in `users`

**File:** `src/features/auth/auth.schema.ts:4,13`

```typescript
export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

// ...
role: userRoleEnum('role').default('user').notNull(),
```

| Property         | Value                                   |
|------------------|-----------------------------------------|
| DB type          | PostgreSQL `enum` via `pgEnum('user_role', ['user', 'admin'])` |
| Default          | `'user'`                                |
| Possible values  | `'user'` or `'admin'` (DB-level constraint) |
| Drizzle column   | `users.role` — inferred type `'user' \| 'admin'` |
| Included in JWT  | Yes — `{ sub, email, role }` at issue time |

The role is **not a string livre** — it is enforced at the database level by a PostgreSQL enum type, and at the Drizzle schema level by `pgEnum`.

---

## 7. Migration Convention

**Directory:** `drizzle/migrations/`

**Last applied migration:** `0014_misty_boomerang.sql`

```
drizzle/migrations/
  0010_short_turbo.sql
  0011_canvas_platform_apps_memory.sql
  0012_user_role_enum.sql
  0013_chat.sql
  0014_misty_boomerang.sql       ← latest
```

**Naming pattern:** `NNNN_<adjective>_<noun>.sql` — sequential 4-digit number + Drizzle's random word pair. The next migration will be `0015_*.sql`, generated automatically by `npm run db:generate`. The number is auto-incremented by Drizzle Kit from the highest existing file.

**Note:** Migrations are in `.gitignore` (per repo convention) — only the schema source is version-controlled.

---

## 8. Beta / Invite / Feature-Flag Mentions in `platform_apps` / `user_apps`

**No mentions found.** Specifically:

- **`beta`** — zero occurrences anywhere in `src/features/platform-apps/`.
- **`invite`** — zero occurrences in `platform_apps` or `user_apps`. (The word `invitedBy` exists only in `chat.schema.ts:19` for chat server member invites — unrelated.)
- **Feature flags** — `platform_apps` is **not** gated behind any `FEATURE_*` flag. The global feature flags (`src/config/features.ts`) cover: `email`, `oauth`, `emailQueue`, `codeSandbox`, `memory`. None of these control platform app availability.
- **`is_active` column** exists on `platform_apps` as a global kill-switch, but there is **no API to toggle it** — it is only settable via direct DB access or seed.

**Conclusion: The `platform_apps`/`user_apps` domain has no beta gating, invite system, or per-user feature flags. It is a flat, fully-open catalog + self-service activation model with zero admin API surface.**
