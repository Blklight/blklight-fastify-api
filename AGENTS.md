# blklight-fastify-api

REST API built with Fastify, auth-first, growing into full CRUD capabilities.

## Current Status

Session 29 complete — MVP closed.
Future: comments (post-MVP).

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify v5 with TypeScript (CommonJS)
- **Validation**: Zod v4
- **Database**: PostgreSQL with Drizzle ORM (postgres-js driver)
- **Auth**: JWT with access + refresh tokens, httpOnly cookies
- **Password Hashing**: node:crypto (pbkdf2Sync)
- **IDs**: CUID2
- **API Docs**: @fastify/swagger + @scalar/fastify-api-reference
- **Email**: Resend with persistent queue + React Email
- **Embeddings**: Google Gemini text-embedding-004 (via REST, no SDK)
- **Vector search**: pgvector extension on PostgreSQL

## Folder Structure

```
docker-compose.yml    - PostgreSQL container configuration
src/
  http/
    server.ts       - Entry point: listen + graceful shutdown
  features/
    auth/
      auth.routes.ts - Auth route handlers (register, login, refresh, logout)
      auth.service.ts - Auth business logic
      auth.schema.ts - Drizzle schema: users + sessions tables
      auth.zod.ts    - Zod validation schemas
    profiles/
      profiles.routes.ts - Profile route handlers
      profiles.service.ts - Profile business logic
      profiles.schema.ts - Drizzle schema: profiles table
      profiles.zod.ts    - Zod validation schemas
    signatures/
      signatures.schema.ts - Drizzle schema: signatures table
      signatures.service.ts - Document signing/verification service
    documents/
      documents.routes.ts - Document route handlers
      documents.service.ts - Document business logic
      documents.schema.ts - Drizzle schema: documents, document_styles, document_types
      documents.zod.ts - Zod validation schemas
    document-style-templates/
      document-style-templates.routes.ts
      document-style-templates.service.ts
      document-style-templates.schema.ts - Drizzle schema: document_style_templates
      document-style-templates.zod.ts
    tutorial-exercises/
      tutorial-exercises.routes.ts
      tutorial-exercises.service.ts
      tutorial-exercises.schema.ts - Drizzle schema: tutorial_exercises, exercise_submissions
      tutorial-exercises.zod.ts
    likes/
      likes.routes.ts
      likes.service.ts
      likes.schema.ts - Drizzle schema: document_likes
    bookmarks/
      bookmarks.routes.ts
      bookmarks.service.ts
      bookmarks.schema.ts - Drizzle schema: document_bookmarks
    categories/
      categories.routes.ts - Category route handlers (public + admin)
      categories.service.ts
      categories.schema.ts - Drizzle schema: categories, document_categories
    tags/
      tags.routes.ts - Tag route handlers (public)
      tags.service.ts
      tags.schema.ts - Drizzle schema: tags, document_tags
    books/
      books.routes.ts
      books.service.ts
      books.schema.ts - Drizzle schema: books, book_chapters, book_category, book_tags, book_progress, book_chapter_progress
      books.zod.ts
    highlights/
      highlights.routes.ts
      highlights.service.ts
      highlights.schema.ts - Drizzle schema: highlights, highlight_palette
      highlights.zod.ts
    workspace/
      workspace.routes.ts
      workspace.service.ts
      workspace.schema.ts - Drizzle schema: workspaces, workspace_members
      workspace.zod.ts
    canvas/
      canvas.routes.ts - Canvas route handlers
      canvas.service.ts - Canvas business logic
      canvas.schema.ts - Drizzle schema: canvas, canvas_positions
      canvas.zod.ts
    notes/
      notes.routes.ts
      notes.service.ts
      notes.schema.ts - Drizzle schema: notes (now references canvas_id)
      notes.zod.ts
    journals/
      journals.routes.ts
      journals.service.ts
      journals.schema.ts - Drizzle schema: journals, journal_highlights
      journals.zod.ts
    follows/
      follows.routes.ts
      follows.service.ts
      follows.schema.ts - Drizzle schema: follows
    platform-apps/
      platform-apps.routes.ts - App catalog + user app activation
      platform-apps.service.ts
      platform-apps.schema.ts - Drizzle schema: platform_apps, user_apps
      platform-apps.zod.ts
    memory/
      memory.routes.ts - Semantic search + related + digest
      memory.service.ts - Embedding generation + similarity search
      memory.schema.ts - Drizzle schema: embeddings
      memory.zod.ts
      memory.job.ts - Background indexing job (fire-and-forget)
    email/
      email.service.ts - Email queue management + send logic
      email.queue.ts - Queue processor (setInterval)
      email.schema.ts - Drizzle schema: email_verifications, password_resets, email_queue
      email.templates/
        verification.tsx
        welcome.tsx
        password-reset.tsx
        memory-digest.tsx - Weekly semantic connections digest
        index.ts - Exports compiled HTML functions
  db/
    index.ts        - Drizzle client singleton
    migrate.ts      - Migration runner script
    seed.ts         - Database seeder (categories, tags, platform_apps)
  utils/
    crypto.ts       - Password hashing + document signing utilities
    errors.ts       - Custom error classes
    sandbox.ts      - Code execution sandbox using node:vm
    cursor.ts       - Cursor encoding/decoding for pagination
    toc.ts          - Table of contents extraction from TipTap JSON
  config/
    env.ts          - Environment variable validation with Zod
    features.ts     - Feature flags configuration
    highlight-palette.ts - Default highlight color palette (5 colors)
    note-colors.ts  - Valid Tailwind color names for notes
  app.ts            - Fastify instance: plugins, hooks, error handler
tests/
  utils/           - Unit tests for utility functions
  services/        - Unit tests for service functions (mocked DB)
vitest.config.ts   - Vitest test configuration
types/
  api.types.ts     - Complete TypeScript types for frontend
  form.schemas.ts  - Zod validation schemas for frontend forms
docs/
  SECURITY.md
  SECURITY_REMEDIATION.md
  SECURITY_SESSIONS.md
```

## Code Style

- All code and comments in English
- async/await only — never .then()/.catch() chains
- Early returns — avoid nested if/else
- Named functions at module level; arrow functions for callbacks/inline
- camelCase for variables/functions, PascalCase for types/interfaces
- `interface` for domain objects, `type` for unions and utilities
- Never use `any` — use `unknown` when type is uncertain
- Use `z.infer<typeof Schema>` to derive types from Zod schemas
- Always explicitly type service function return types
- Comment the WHY not the WHAT
- JSDoc on all exported service functions (@param, @returns, @throws)
- DB tables: snake_case — TypeScript variables: camelCase

## Database Schema

### users (identity — private)

| Column              | Type      | Notes                     |
| ------------------- | --------- | ------------------------- |
| id                  | text      | CUID2, primary key        |
| email               | text      | unique, not null          |
| username            | text      | unique, not null          |
| password_hash       | text      | nullable (null for OAuth) |
| salt                | text      | nullable                  |
| email_verified      | boolean   | default false             |
| role                | text      | 'user' or 'admin'         |
| github_id           | text      | unique, nullable          |
| google_id           | text      | unique, nullable          |
| onboarding_complete | boolean   | default false             |
| deleted_at          | timestamp | nullable (soft delete)    |
| created_at          | timestamp | default now()             |
| updated_at          | timestamp | default now()             |

### sessions

| Column        | Type      | Notes                  |
| ------------- | --------- | ---------------------- |
| id            | text      | CUID2, primary key     |
| user_id       | text      | foreign key → users.id |
| refresh_token | text      | unique, not null       |
| expires_at    | timestamp | not null               |
| created_at    | timestamp | default now()          |

### email_verifications

| Column     | Type      | Notes                          |
| ---------- | --------- | ------------------------------ |
| id         | text      | CUID2, primary key             |
| user_id    | text      | unique, foreign key → users.id |
| token      | text      | unique, not null               |
| expires_at | timestamp | not null                       |
| created_at | timestamp | default now()                  |

### password_resets

| Column     | Type      | Notes                  |
| ---------- | --------- | ---------------------- |
| id         | text      | CUID2, primary key     |
| user_id    | text      | foreign key → users.id |
| token      | text      | unique, not null       |
| expires_at | timestamp | not null               |
| used_at    | timestamp | nullable               |
| created_at | timestamp | default now()          |

### email_queue

| Column       | Type      | Notes                           |
| ------------ | --------- | ------------------------------- |
| id           | text      | CUID2, primary key              |
| to           | text      | not null                        |
| subject      | text      | not null                        |
| html         | text      | not null                        |
| status       | text      | 'pending' \| 'sent' \| 'failed' |
| attempts     | integer   | default 0                       |
| last_error   | text      | nullable                        |
| scheduled_at | timestamp | default now()                   |
| sent_at      | timestamp | nullable                        |
| created_at   | timestamp | default now()                   |

### profiles (public — one-to-one with users)

| Column       | Type      | Notes                          |
| ------------ | --------- | ------------------------------ |
| id           | text      | CUID2, primary key             |
| user_id      | text      | unique, foreign key → users.id |
| username     | text      | unique, mirrored from users    |
| display_name | text      | nullable                       |
| bio          | text      | nullable                       |
| bio_private  | text      | nullable                       |
| avatar_url   | text      | nullable                       |
| social_links | jsonb     | nullable                       |
| is_private   | boolean   | default false                  |
| deleted_at   | timestamp | nullable (soft delete)         |
| created_at   | timestamp | default now()                  |
| updated_at   | timestamp | default now()                  |

### signatures (authorship identity)

| Column           | Type      | Notes                                       |
| ---------------- | --------- | ------------------------------------------- |
| id               | text      | CUID2, primary key                          |
| user_id          | text      | unique, foreign key → users.id              |
| user_hash        | text      | unique, public authorship identity          |
| secret_encrypted | text      | AES-256-GCM encrypted per-user secret       |
| tx_hash          | text      | nullable, reserved for blockchain migration |
| created_at       | timestamp | default now()                               |

### platform_apps (app catalog — seeded)

| Column      | Type      | Notes                                                           |
| ----------- | --------- | --------------------------------------------------------------- |
| id          | text      | CUID2, primary key                                              |
| slug        | text      | unique, not null ('canvas', 'publisher', 'reader', 'dev-tools') |
| name        | text      | not null                                                        |
| description | text      | nullable                                                        |
| is_active   | boolean   | default true (global kill switch)                               |
| created_at  | timestamp | default now()                                                   |

### user_apps (apps activated per user)

| Column       | Type      | Notes                          |
| ------------ | --------- | ------------------------------ |
| id           | text      | CUID2, primary key             |
| user_id      | text      | foreign key → users.id         |
| app_id       | text      | foreign key → platform_apps.id |
| activated_at | timestamp | default now()                  |

Unique constraint: (user_id, app_id)

### workspaces

| Column       | Type      | Notes                          |
| ------------ | --------- | ------------------------------ |
| id           | text      | CUID2, primary key             |
| owner_id     | text      | unique, foreign key → users.id |
| type         | text      | 'personal' \| 'team'           |
| name         | text      | not null                       |
| is_personal  | boolean   | default true                   |
| color_labels | jsonb     | nullable                       |
| created_at   | timestamp | default now()                  |
| updated_at   | timestamp | default now()                  |

### workspace_members

| Column       | Type      | Notes                          |
| ------------ | --------- | ------------------------------ |
| id           | text      | CUID2, primary key             |
| workspace_id | text      | foreign key → workspaces.id    |
| user_id      | text      | foreign key → users.id         |
| role         | text      | 'owner' \| 'admin' \| 'member' |
| created_at   | timestamp | default now()                  |

Unique constraint: (workspace_id, user_id)

### canvas (one-to-one with workspace)

| Column       | Type      | Notes                               |
| ------------ | --------- | ----------------------------------- |
| id           | text      | CUID2, primary key                  |
| workspace_id | text      | unique, foreign key → workspaces.id |
| created_at   | timestamp | default now()                       |
| updated_at   | timestamp | default now()                       |

### canvas_positions (spatial layout of notes on canvas)

| Column     | Type      | Notes                          |
| ---------- | --------- | ------------------------------ |
| id         | text      | CUID2, primary key             |
| canvas_id  | text      | foreign key → canvas.id        |
| note_id    | text      | unique, foreign key → notes.id |
| x          | real      | horizontal position            |
| y          | real      | vertical position              |
| w          | real      | width (default 200)            |
| h          | real      | height (default 150)           |
| z          | integer   | stack order (default 0)        |
| updated_at | timestamp | default now()                  |

Unique constraint: (canvas_id, note_id)

### notes (post-its — belong to canvas)

| Column     | Type      | Notes                                  |
| ---------- | --------- | -------------------------------------- |
| id         | text      | CUID2, primary key                     |
| canvas_id  | text      | foreign key → canvas.id                |
| title      | text      | nullable                               |
| content    | text      | markdown string                        |
| type       | text      | 'text' \| 'code' \| 'list'             |
| language   | text      | nullable (required when type = 'code') |
| color      | text      | Tailwind color name, default 'yellow'  |
| deleted_at | timestamp | nullable (soft delete)                 |
| created_at | timestamp | default now()                          |
| updated_at | timestamp | default now()                          |

Note: `canvas_id` replaces the former `workspace_id`. Canvas is the spatial
container for notes. Workspace is the owner of canvas. Notes never reference
workspace directly.

### embeddings (semantic memory — transversal)

| Column      | Type        | Notes                                                         |
| ----------- | ----------- | ------------------------------------------------------------- |
| id          | text        | CUID2, primary key                                            |
| user_id     | text        | foreign key → users.id                                        |
| source_type | text        | 'note' \| 'document' \| 'journal_highlight' \| 'book_chapter' |
| source_id   | text        | ID of the indexed entity in its own table                     |
| embedding   | vector(768) | pgvector column — requires CREATE EXTENSION vector            |
| indexed_at  | timestamp   | default now()                                                 |
| created_at  | timestamp   | default now()                                                 |

Unique constraint: (user_id, source_type, source_id)

Requires: `CREATE EXTENSION IF NOT EXISTS vector;` before running migrations.

### document_types (seeded on migration)

| Column     | Type      | Notes                                               |
| ---------- | --------- | --------------------------------------------------- |
| id         | text      | CUID2, primary key                                  |
| name       | text      | unique (article, tutorial, contract, project, page) |
| created_at | timestamp | default now()                                       |

### documents

| Column          | Type      | Notes                                |
| --------------- | --------- | ------------------------------------ |
| id              | text      | CUID2, primary key                   |
| author_id       | text      | foreign key → profiles.id            |
| type_id         | text      | foreign key → document_types.id      |
| status          | text      | 'draft' \| 'published' \| 'archived' |
| title           | text      | not null                             |
| abstract        | text      | nullable                             |
| content         | jsonb     | nullable (TipTap JSON)               |
| cover_image_url | text      | nullable                             |
| slug            | text      | unique per author (author_id + slug) |
| authorship      | jsonb     | set on publish, null while draft     |
| published_at    | timestamp | nullable                             |
| deleted_at      | timestamp | nullable (soft delete)               |
| created_at      | timestamp | default now()                        |
| updated_at      | timestamp | default now()                        |

### document_styles

| Column             | Type      | Notes                              |
| ------------------ | --------- | ---------------------------------- |
| id                 | text      | CUID2, primary key                 |
| document_id        | text      | unique, foreign key → documents.id |
| typography         | text      | 'sans' \| 'serif' \| 'mono'        |
| paper_style        | jsonb     | nullable                           |
| paper_texture      | jsonb     | nullable                           |
| cover_settings     | jsonb     | nullable                           |
| document_header    | jsonb     | nullable                           |
| document_footer    | jsonb     | nullable                           |
| document_signature | jsonb     | nullable                           |
| updated_at         | timestamp | default now()                      |

### document_style_templates

| Column          | Type      | Notes                       |
| --------------- | --------- | --------------------------- |
| id              | text      | CUID2, primary key          |
| author_id       | text      | foreign key → profiles.id   |
| name            | text      | not null, max 50            |
| document_type   | text      | nullable                    |
| typography      | text      | 'sans' \| 'serif' \| 'mono' |
| paper_style     | jsonb     | nullable                    |
| paper_texture   | jsonb     | nullable                    |
| document_header | jsonb     | nullable                    |
| document_footer | jsonb     | nullable                    |
| created_at      | timestamp | default now()               |

### tutorial_exercises

| Column      | Type      | Notes                                |
| ----------- | --------- | ------------------------------------ |
| id          | text      | CUID2, primary key                   |
| document_id | text      | foreign key → documents.id           |
| type        | text      | 'code' \| 'quiz'                     |
| data        | jsonb     | exercise data (shape varies by type) |
| created_at  | timestamp | default now()                        |
| updated_at  | timestamp | default now()                        |

### exercise_submissions

| Column      | Type      | Notes                               |
| ----------- | --------- | ----------------------------------- |
| id          | text      | CUID2, primary key                  |
| user_id     | text      | foreign key → users.id              |
| exercise_id | text      | foreign key → tutorial_exercises.id |
| attempts    | jsonb     | array of attempt objects            |
| created_at  | timestamp | default now()                       |
| updated_at  | timestamp | default now()                       |

Unique constraint: (user_id, exercise_id)

### document_likes

| Column      | Type      | Notes                      |
| ----------- | --------- | -------------------------- |
| id          | text      | CUID2, primary key         |
| user_id     | text      | foreign key → users.id     |
| document_id | text      | foreign key → documents.id |
| created_at  | timestamp | default now()              |

Unique constraint: (user_id, document_id)

### document_bookmarks

| Column      | Type      | Notes                      |
| ----------- | --------- | -------------------------- |
| id          | text      | CUID2, primary key         |
| user_id     | text      | foreign key → users.id     |
| document_id | text      | foreign key → documents.id |
| created_at  | timestamp | default now()              |

Unique constraint: (user_id, document_id)

### categories

| Column      | Type      | Notes                      |
| ----------- | --------- | -------------------------- |
| id          | text      | CUID2, primary key         |
| name        | text      | not null                   |
| slug        | text      | unique, not null           |
| description | text      | nullable                   |
| parent_id   | text      | self-referential, nullable |
| created_at  | timestamp | default now()              |

### tags

| Column     | Type      | Notes                                      |
| ---------- | --------- | ------------------------------------------ |
| id         | text      | CUID2, primary key                         |
| name       | text      | unique, not null (normalized to lowercase) |
| slug       | text      | unique, not null                           |
| created_at | timestamp | default now()                              |

### document_categories

| Column      | Type      | Notes                              |
| ----------- | --------- | ---------------------------------- |
| id          | text      | CUID2, primary key                 |
| document_id | text      | foreign key → documents.id, unique |
| category_id | text      | foreign key → categories.id        |
| created_at  | timestamp | default now()                      |

### document_tags

| Column      | Type      | Notes                      |
| ----------- | --------- | -------------------------- |
| id          | text      | CUID2, primary key         |
| document_id | text      | foreign key → documents.id |
| tag_id      | text      | foreign key → tags.id      |
| created_at  | timestamp | default now()              |

Unique constraint: (document_id, tag_id)

### books

| Column          | Type      | Notes                                      |
| --------------- | --------- | ------------------------------------------ |
| id              | text      | CUID2, primary key                         |
| author_id       | text      | foreign key → profiles.id                  |
| status          | text      | 'draft' \| 'published'                     |
| title           | text      | not null                                   |
| description     | text      | nullable                                   |
| cover_image_url | text      | nullable                                   |
| slug            | text      | unique per author (author_id + slug)       |
| toc             | jsonb     | auto-generated but editable, null on draft |
| authorship      | jsonb     | set on publish                             |
| deleted_at      | timestamp | nullable (soft delete)                     |
| created_at      | timestamp | default now()                              |
| updated_at      | timestamp | default now()                              |

### book_chapters

| Column      | Type      | Notes                      |
| ----------- | --------- | -------------------------- |
| id          | text      | CUID2, primary key         |
| book_id     | text      | foreign key → books.id     |
| document_id | text      | foreign key → documents.id |
| position    | integer   | order within the book      |
| intro_text  | text      | nullable                   |
| outro_text  | text      | nullable                   |
| created_at  | timestamp | default now()              |
| updated_at  | timestamp | default now()              |

Unique constraint: (book_id, document_id)
Unique constraint: (book_id, position)

### book_category

| Column      | Type | Notes                               |
| ----------- | ---- | ----------------------------------- |
| book_id     | text | primary key, foreign key → books.id |
| category_id | text | foreign key → categories.id         |

### book_tags

| Column  | Type | Notes                  |
| ------- | ---- | ---------------------- |
| book_id | text | foreign key → books.id |
| tag_id  | text | foreign key → tags.id  |

Unique constraint: (book_id, tag_id)

### book_progress

| Column          | Type      | Notes                          |
| --------------- | --------- | ------------------------------ |
| id              | text      | CUID2, primary key             |
| user_id         | text      | foreign key → users.id         |
| book_id         | text      | foreign key → books.id         |
| last_chapter_id | text      | foreign key → book_chapters.id |
| created_at      | timestamp | default now()                  |
| updated_at      | timestamp | default now()                  |

Unique constraint: (user_id, book_id)

### book_chapter_progress

| Column     | Type      | Notes                          |
| ---------- | --------- | ------------------------------ |
| id         | text      | CUID2, primary key             |
| user_id    | text      | foreign key → users.id         |
| chapter_id | text      | foreign key → book_chapters.id |
| is_read    | boolean   | default false                  |
| read_at    | timestamp | nullable                       |

Unique constraint: (user_id, chapter_id)

### highlights

| Column      | Type      | Notes                                        |
| ----------- | --------- | -------------------------------------------- |
| id          | text      | CUID2, primary key                           |
| user_id     | text      | foreign key → users.id                       |
| document_id | text      | foreign key → documents.id                   |
| text        | text      | highlighted text content                     |
| color       | text      | color from user palette                      |
| position    | jsonb     | JSONB: { nodeIndex, offsetStart, offsetEnd } |
| created_at  | timestamp | default now()                                |
| updated_at  | timestamp | default now()                                |

### highlight_palette

| Column     | Type      | Notes                              |
| ---------- | --------- | ---------------------------------- |
| id         | text      | CUID2, primary key                 |
| user_id    | text      | unique, foreign key → users.id     |
| colors     | jsonb     | array of hex color strings (max 5) |
| updated_at | timestamp | default now()                      |

### journals

| Column       | Type      | Notes                                 |
| ------------ | --------- | ------------------------------------- |
| id           | text      | CUID2, primary key                    |
| workspace_id | text      | foreign key → workspaces.id           |
| title        | text      | not null, max 200                     |
| description  | text      | nullable, max 500                     |
| color        | text      | default 'indigo', must be NOTE_COLORS |
| deleted_at   | timestamp | nullable (soft delete)                |
| created_at   | timestamp | default now()                         |
| updated_at   | timestamp | default now()                         |

### journal_highlights

| Column       | Type      | Notes                       |
| ------------ | --------- | --------------------------- |
| id           | text      | CUID2, primary key          |
| journal_id   | text      | foreign key → journals.id   |
| highlight_id | text      | foreign key → highlights.id |
| position     | integer   | order within the journal    |
| created_at   | timestamp | default now()               |

Unique constraint: (journal_id, highlight_id)
Unique constraint: (journal_id, position)

### follows

| Column       | Type      | Notes                                 |
| ------------ | --------- | ------------------------------------- |
| id           | text      | CUID2, primary key                    |
| follower_id  | text      | foreign key → profiles.id             |
| following_id | text      | foreign key → profiles.id             |
| status       | text      | 'pending' \| 'accepted' \| 'rejected' |
| created_at   | timestamp | default now()                         |
| updated_at   | timestamp | default now()                         |

Unique constraint: (follower_id, following_id)

## Available Scripts

| Script                  | Description                                     |
| ----------------------- | ----------------------------------------------- |
| `npm run dev`           | Start dev server with hot reload (tsx watch)    |
| `npm run build`         | Compile TypeScript to JavaScript                |
| `npm run start`         | Run production server from dist/                |
| `npm run db:generate`   | Generate Drizzle migrations                     |
| `npm run db:migrate`    | Run pending migrations                          |
| `npm run db:seed`       | Seed database (categories, tags, platform_apps) |
| `npm run db:studio`     | Open Drizzle Studio                             |
| `npm test`              | Run all tests                                   |
| `npm run test:watch`    | Run tests in watch mode                         |
| `npm run test:coverage` | Run tests with coverage                         |

## How to Run Locally

> **Note:** Docker must be running before starting the server.

```bash
cp .env.example .env.development
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Server runs at http://localhost:3000
API docs at http://localhost:3000/docs

## Architectural Decisions

- **NEVER** import `process.env` directly — always use `src/config/env.ts`
- **NEVER** use external hashing libs — use `node:crypto` only
- **ALWAYS** validate inputs with Zod before the service layer
- **ALWAYS** use CUID2 for new IDs
- **ALWAYS** create users and profiles in the same DB transaction
- **ONLY** store refresh tokens in httpOnly cookies, never in response body
- **ALL** responses must follow `{ data, error, message }` standard
- **NEVER** store raw secrets — always encrypt with AES-256-GCM before saving
- **NEVER** expose secret_encrypted, user_hash raw, or tx_hash in API responses
- **signDocument() and verifyDocument()** are the only entry points for article signing
- **tx_hash** field is nullable and reserved for future blockchain migration
- **Signatures remain accessible after account deletion** — they are permanent proof of authorship
- **author_id in documents always references profiles.id** — never users.id
- **documents and document_styles always created in the same transaction**
- **slug is unique per author** — composite unique constraint on (author_id, slug)
- **authorship jsonb only set on publish** — null while draft
- **authorship.hmac enables cryptographic verification** via verifyDocument() from signatures.service.ts
- **publishDocument() resolves profiles.id → users.id internally** before calling signDocument()
- **Content edits on published documents reset authorship to null and status to draft** — requires re-publish
- **correct_index and expected_output are NEVER returned to readers** — stripped from exercise responses
- **Code exercises validated via node:vm with 3s timeout** — pure JavaScript and TypeScript (transpiled via esbuild)
- **SupportedLanguage: 'javascript' | 'typescript'** — extensible for future languages without refactor
- **Login identifier can be email (contains '@') or username** — detected by presence of '@' character
- **exercise_submissions uses upsert** — one row per (user_id, exercise_id)
- **attempts array appended on each submission** — never replaced
- **quiz and code exercises use discriminated union Zod schemas** — discriminated on `type` field
- **Never add language support to sandbox without adding to SupportedLanguage type first**
- **Public routes never require authentication** — response shape is identical for all visitors
- **Cursor encodes { published_at, id } as opaque base64 JSON string** — enables stable pagination
- **DocumentCard never includes content field** — summary only, no full text
- **Deleted users/profiles/documents always excluded from public queries**
- **Tutorial exercises included in full document read** — never in DocumentCard feed responses
- **sort=popular is now active** — orders by likes_count DESC, published_at DESC
- **likes_count always computed via COUNT(\*)** — never stored in documents table
- **liked_by_me is null for unauthenticated requests** — not false
- **Bookmarks are always private** — only owner can see their bookmarks
- **toggleLike and toggleBookmark are idempotent** — safe to call multiple times
- **Tags are globally shared via upsert** — same tag name = same tag record globally
- **Tag names are normalized** — trim + lowercase before storage
- **Maximum 5 tags per document** — enforced in setDocumentTags()
- **setDocumentTags always replaces** — deletes existing then inserts new
- **Category is required on publish** — ValidationError thrown if no category assigned
- **One category per document** — setDocumentCategory replaces existing assignment
- **Categories are hierarchical** — optional parent_id for nested categories
- **Deleted categories reparent children to root** — done in same transaction
- **Public feed supports category and tag filters** — ?category=slug&tag=slug query params
- **DocumentCard and DocumentFull include category and tags** — always fetched on read
- **Books always reference existing published documents** — no content duplication
- **Only the author's own published documents can be chapters** — verified on addChapter()
- **TOC auto-generated on chapter add/remove/reorder** — manually editable via updateToc()
- **Adding/removing chapters requires draft status** — published books cannot be modified
- **Category required on publish for books** — same rule as documents
- **book_progress and book_chapter_progress use upsert** — never duplicated
- **Books feed requires authentication** — unlike documents, books are not public without login
- **document_hash for books = SHA-256({ title, description, author })** — passed to signDocument()
- **Chapter documents include title, abstract, slug in BookFull** — never full content
- **Highlights are always private** — never exposed to other users
- **Color must be from user's active palette** — validated in service layer, not just Zod
- **Default palette is defined in code** — only customizations persisted in DB
- **getDocumentHighlights() returns highlights in reading order** — nodeIndex ASC, offsetStart ASC
- **getMyHighlights() groups by document** — for the highlights dashboard view
- **highlight_palette uses upsert** — one row per user
- **Highlights are independent** — journal relation added in Session 14
- **Every user has exactly one personal workspace** — is_personal = true, created atomically in register transaction
- **Workspace created atomically in register transaction** — users + profiles + signatures + workspaces (4 tables)
- **Canvas created atomically with workspace** — workspace + canvas always exist together (5 tables on register)
- **workspace_members table exists but has no routes** — reserved for future team workspaces
- **Notes belong to canvas via canvas_id** — never directly to workspace or user
- **resolveCanvasId() is the internal bridge** — userId → canvasId for all notes operations (replaces resolveWorkspaceId)
- **canvas_positions is a separate table** — spatial layout is decoupled from note content
- **canvas_positions uses upsert** — one position row per note, updated on move/resize
- **Notes without a canvas_position are valid** — position is optional (list view vs canvas view)
- **color_labels is optional jsonb in workspaces** — keys are NOTE_COLORS, values are free text labels
- **Passing null to updateColorLabels() clears all labels**
- **NOTE_COLORS imported from src/config/note-colors.ts** — never hardcoded
- **language field required when note type is 'code'** — enforced in Zod .refine()
- **Notes are soft-deleted** — deleted_at set, never hard deleted
- **Deleting a note also removes its canvas_position and embedding** — done in same transaction
- **cursor.ts now uses generic timestamp field** — works for any date column
- **Maximum 2 journals per user** — hard limit enforced in createJournal()
- **Journals belong to workspace via workspace_id** — never directly to users
- **Highlights added manually** — never auto-populated
- **Removing a highlight from journal does NOT delete the highlight itself** — only the journal reference
- **journal_highlights rows kept on journal soft delete** — preserves highlight refs if journal is restored
- **Reorder uses transaction** — positions updated atomically
- **Colors use NOTE_COLORS** — for consistency with notes
- **follows reference profiles.id** — never users.id
- **Private profiles hide everything** — only accepted followers see content
- **Follow counts always computed via COUNT(\*)** — never stored in profiles
- **Rejected follow requests are hard deleted** — not kept as 'rejected'
- **getFollowingFeed excludes documents from private profiles**
- **GET /profiles/:username accepts optional auth** — for is_following field
- **is_following = null for unauthenticated** — not false
- **follow_status shows pending state** — useful for follow button UI
- **platform_apps are seeded** — never created via API by regular users
- **user_apps uses upsert** — activating an already-active app is a no-op
- **onboarding_complete = true only after both steps are done** — username (OAuth) + app selection
- **Email-registered users skip the username step** — onboarding starts at app selection
- **FEATURE_MEMORY flag guards all memory routes and jobs** — if false, notes save normally with no side effects
- **Embedding generation is always fire-and-forget** — never blocks note/document save response
- **memory.job.ts calls Gemini text-embedding-004 via REST** — no SDK dependency
- **embeddings table requires pgvector extension** — run CREATE EXTENSION IF NOT EXISTS vector before migrations
- **Similarity search uses <=> operator** — cosine distance, lower = more similar
- **HNSW index on embeddings.embedding** — required for sub-second search at scale
- **Embedding deleted when source is deleted** — enforced in each feature's delete service function
- **source_type + source_id is the universal pointer** — no FK constraint, resolved at query time
- **Memory digest sent via existing email queue** — same pattern as other transactional emails
- **GEMINI_API_KEY added to env.ts** — required when FEATURE_MEMORY=true
- **buildAuthSession() is the single source of truth** for auth response shape — all auth flows call it
- **AuthSession is the unified response shape** for login, register, refresh, OAuth callbacks, and onboarding status
- **apps field in AuthSession contains activated app slugs** — frontend uses this to gate UI sections
- **apps is always an array** — never null, empty array when no apps activated
- **loginUser() returns only { userId, refreshToken }** — not the raw DB user object
- **Raw DB objects from db.select() are never passed to responses** — always mapped field by field
- **onboarding_complete = false is not a login blocker** — frontend handles redirect via AuthSession
- **GET /api/v1/auth/onboarding/status is read-only** — determines frontend routing step
- **Onboarding step 'username' only applies to OAuth users** pre-username selection
- **Email-registered users go directly to 'apps' step** — never 'username'
- **Explicit Drizzle column selection** used in all queries on sensitive tables — never select() with no args

## Onboarding Flow

### Email registration

1. POST /api/v1/auth/register → user + profile + signature + workspace + canvas created atomically
2. Frontend redirects to app selection screen
3. POST /api/v1/platform-apps/me → activates selected apps, sets onboarding_complete = true
4. Frontend redirects to dashboard

### OAuth registration

1. GET /api/v1/auth/github or /google → OAuth flow
2. POST /api/v1/auth/onboarding → username chosen, profile + signature + workspace + canvas created atomically
3. Frontend redirects to app selection screen
4. POST /api/v1/platform-apps/me → activates selected apps, sets onboarding_complete = true
5. Frontend redirects to dashboard

## Platform Apps

Apps available at launch (seeded in `db/seed.ts`):

| Slug      | Name      | Description                                              |
| --------- | --------- | -------------------------------------------------------- |
| canvas    | Canvas    | Post-it canvas for capturing and connecting ideas        |
| publisher | Publisher | Write and publish articles, tutorials, and books         |
| reader    | Reader    | Highlight, annotate, and organize what you read          |
| dev-tools | Dev Tools | Code notes, sandboxed exercises, and technical tutorials |

## Feature Flags

- **Feature flags centralized in src/config/features.ts**
- **Always import features from features.ts — never read FEATURE\_\* env vars directly**
- **requireFeature() throws 503 — use in route handlers only**
- **Service-level checks use if (!features.x) return — silent skip**
- **Default state: email=false, oauth=false, emailQueue=false, codeSandbox=true, memory=true**
- **memory=true by default** — safe, degrades gracefully if GEMINI_API_KEY is missing
- **Enabling oauth requires all 4 OAuth env vars to be set**
- **Enabling email requires RESEND_API_KEY and EMAIL_FROM**
- **emailQueue only works if email is also enabled**
- **memory only generates embeddings if GEMINI_API_KEY is set** — otherwise silent no-op

## Response Format

**Success:**

```json
{ "data": <payload>, "error": null, "message": "string" }
```

**Error:**

```json
{
  "data": null,
  "error": { "code": "string", "message": "string" },
  "message": "string"
}
```

**Validation Error:**

```json
{
  "data": null,
  "error": { "code": "VALIDATION_ERROR", "message": "string", "fields": {} },
  "message": "string"
}
```

## Auth Routes

| Method | Endpoint                         | Description                   | Rate Limit |
| ------ | -------------------------------- | ----------------------------- | ---------- |
| POST   | /api/v1/auth/register            | Register new user             | 5/min      |
| POST   | /api/v1/auth/login               | Login with email or username  | 10/min     |
| POST   | /api/v1/auth/refresh             | Refresh access token          | None       |
| POST   | /api/v1/auth/logout              | Logout and invalidate session | None       |
| POST   | /api/v1/auth/verify-email        | Verify email address          | None       |
| POST   | /api/v1/auth/resend-verification | Resend verification email     | 3/hour     |
| POST   | /api/v1/auth/forgot-password     | Request password reset        | 3/hour     |
| POST   | /api/v1/auth/reset-password      | Reset password                | None       |

## OAuth Routes

| Method | Endpoint                              | Auth | Description                               |
| ------ | ------------------------------------- | ---- | ----------------------------------------- |
| GET    | /api/v1/auth/github                   | No   | Redirect to GitHub OAuth                  |
| GET    | /api/v1/auth/github/callback          | No   | GitHub OAuth callback                     |
| GET    | /api/v1/auth/github/link              | Yes  | Start GitHub account linking              |
| GET    | /api/v1/auth/github/link/callback     | Yes  | GitHub linking callback                   |
| GET    | /api/v1/auth/google                   | No   | Redirect to Google OAuth                  |
| GET    | /api/v1/auth/google/callback          | No   | Google OAuth callback                     |
| GET    | /api/v1/auth/google/link              | Yes  | Start Google account linking              |
| GET    | /api/v1/auth/google/link/callback     | Yes  | Google linking callback                   |
| POST   | /api/v1/auth/onboarding               | Yes  | Complete OAuth user onboarding (username) |
| DELETE | /api/v1/auth/account/unlink/:provider | Yes  | Unlink OAuth provider                     |

## Profile Routes

| Method | Endpoint                   | Auth | Description        |
| ------ | -------------------------- | ---- | ------------------ |
| GET    | /api/v1/profiles/:username | No   | Get public profile |
| GET    | /api/v1/profiles/me        | Yes  | Get own profile    |
| PATCH  | /api/v1/profiles/me        | Yes  | Update own profile |
| DELETE | /api/v1/profiles/me        | Yes  | Delete own account |

## Platform Apps Routes

| Method | Endpoint                        | Auth | Description                           |
| ------ | ------------------------------- | ---- | ------------------------------------- |
| GET    | /api/v1/platform-apps           | No   | List all available apps               |
| GET    | /api/v1/platform-apps/me        | Yes  | List apps activated by current user   |
| POST   | /api/v1/platform-apps/me        | Yes  | Activate apps (onboarding + settings) |
| DELETE | /api/v1/platform-apps/me/:appId | Yes  | Deactivate an app                     |

## Canvas Routes

| Method | Endpoint                    | Auth | Description                                    |
| ------ | --------------------------- | ---- | ---------------------------------------------- |
| GET    | /api/v1/canvas/me           | Yes  | Get user's canvas with all notes and positions |
| PATCH  | /api/v1/canvas/me/positions | Yes  | Batch update note positions on canvas          |

## Notes Routes

| Method | Endpoint          | Auth | Description                                |
| ------ | ----------------- | ---- | ------------------------------------------ |
| POST   | /api/v1/notes     | Yes  | Create note → triggers memory indexing job |
| GET    | /api/v1/notes     | Yes  | List notes (paginated, filterable)         |
| GET    | /api/v1/notes/:id | Yes  | Get note by ID                             |
| PATCH  | /api/v1/notes/:id | Yes  | Update note → re-indexes embedding         |
| DELETE | /api/v1/notes/:id | Yes  | Soft delete → removes position + embedding |

## Memory Routes

| Method | Endpoint                                     | Auth | Description                                |
| ------ | -------------------------------------------- | ---- | ------------------------------------------ |
| GET    | /api/v1/memory/search                        | Yes  | Semantic search: ?q=string&limit=10        |
| GET    | /api/v1/memory/related/:sourceType/:sourceId | Yes  | Related items for a specific content piece |
| GET    | /api/v1/memory/digest                        | Yes  | Weekly connections digest                  |

## Workspace Routes

| Method | Endpoint                          | Auth | Description               |
| ------ | --------------------------------- | ---- | ------------------------- |
| GET    | /api/v1/workspace/me              | Yes  | Get workspace with counts |
| PATCH  | /api/v1/workspace/me/color-labels | Yes  | Update color labels       |

## Public Routes (No Auth Required)

| Method | Endpoint                             | Description                              |
| ------ | ------------------------------------ | ---------------------------------------- |
| GET    | /api/v1/documents                    | Public document feed (cursor pagination) |
| GET    | /api/v1/documents/:username/:slug    | Full public document                     |
| GET    | /api/v1/profiles/:username           | Get public profile                       |
| GET    | /api/v1/profiles/:username/documents | Author's published documents             |
| GET    | /api/v1/categories                   | Get all categories (hierarchical)        |
| GET    | /api/v1/categories/:slug             | Get a category by slug                   |
| GET    | /api/v1/tags/popular                 | Get popular tags sorted by usage         |
| GET    | /api/v1/platform-apps                | List all available apps                  |

## Document Routes

| Method | Endpoint                      | Auth | Description                   |
| ------ | ----------------------------- | ---- | ----------------------------- |
| GET    | /api/v1/documents/me          | Yes  | List my documents (paginated) |
| POST   | /api/v1/documents             | Yes  | Create document               |
| PATCH  | /api/v1/documents/:id         | Yes  | Update document               |
| PATCH  | /api/v1/documents/:id/publish | Yes  | Publish document              |
| DELETE | /api/v1/documents/:id         | Yes  | Soft delete document          |

## Security

- Security findings documented in `docs/SECURITY.md`
- Detailed remediation steps in `docs/SECURITY_REMEDIATION.md`
- Session planning in `docs/SECURITY_SESSIONS.md`
- Fix priorities aligned with ROADMAP.md phases
- Never merge a phase release without clearing its security gates

## Next Steps

MVP is complete. The following features are implemented and tested:
- Auth (email + OAuth), onboarding, platform apps
- Canvas with post-its (notes) and spatial positioning
- Semantic memory (pgvector + Gemini embeddings)
- Workspace with color labels
- Signatures (cryptographic authorship)
- Public profile routes
- Categories and tags (read-only)

Beta phase (next):
- Documents (CRUD + publish)
- Tutorial exercises with sandbox
- Likes and bookmarks
- Highlights and journals
- Document style templates
- Account management (linking, deletion)
- Memory full coverage (all source types)

Post-Beta (v1.0):
- Books and chapters
- Follows and social feed
- Memory full coverage (all source types)

Future:
- Memory map (visual cluster view)
- Comments on documents
- Sharevault
- Team workspaces
- Blockchain migration for signatures
- Notifications
- Analytics
- RSS feeds
- Monetization and plans
