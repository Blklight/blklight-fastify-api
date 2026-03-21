# blklight-fastify-api

REST API built with Fastify, auth-first, growing into full CRUD capabilities.

## Current Status

Session 11 complete — tags and categories implemented.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify v5 with TypeScript (CommonJS)
- **Validation**: Zod v4
- **Database**: PostgreSQL with Drizzle ORM (postgres-js driver)
- **Auth**: JWT with access + refresh tokens, httpOnly cookies
- **Password Hashing**: node:crypto (pbkdf2Sync)
- **IDs**: CUID2
- **API Docs**: @fastify/swagger + @scalar/fastify-api-reference

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
      document-style-templates.routes.ts - Style template route handlers
      document-style-templates.service.ts - Style template business logic
      document-style-templates.schema.ts - Drizzle schema: document_style_templates
      document-style-templates.zod.ts - Zod validation schemas
    tutorial-exercises/
      tutorial-exercises.routes.ts - Tutorial exercise route handlers
      tutorial-exercises.service.ts - Tutorial exercise business logic
      tutorial-exercises.schema.ts - Drizzle schema: tutorial_exercises, exercise_submissions
      tutorial-exercises.zod.ts - Zod validation schemas
    likes/
      likes.routes.ts - Like route handlers
      likes.service.ts - Like business logic
      likes.schema.ts - Drizzle schema: document_likes
    bookmarks/
      bookmarks.routes.ts - Bookmark route handlers
      bookmarks.service.ts - Bookmark business logic
      bookmarks.schema.ts - Drizzle schema: document_bookmarks
    categories/
      categories.routes.ts - Category route handlers (public + admin)
      categories.service.ts - Category business logic
      categories.schema.ts - Drizzle schema: categories, document_categories
    tags/
      tags.routes.ts - Tag route handlers (public)
      tags.service.ts - Tag business logic
      tags.schema.ts - Drizzle schema: tags, document_tags
  db/
    index.ts        - Drizzle client singleton
    migrate.ts      - Migration runner script
  utils/
    crypto.ts       - Password hashing + document signing utilities
    errors.ts       - Custom error classes
    sandbox.ts      - Code execution sandbox using node:vm
    cursor.ts       - Cursor encoding/decoding for pagination
  config/
    env.ts          - Environment variable validation with Zod
  app.ts            - Fastify instance: plugins, hooks, error handler
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
| Column | Type | Notes |
|--------|------|-------|
| id | text | CUID2, primary key |
| email | text | unique, not null |
| username | text | unique, not null |
| password_hash | text | nullable (null for OAuth) |
| salt | text | nullable |
| email_verified | boolean | default false |
| role | text | 'user' or 'admin' |
| github_id | text | unique, nullable |
| google_id | text | unique, nullable |
| deleted_at | timestamp | nullable (soft delete) |
| created_at | timestamp | default now() |
| updated_at | timestamp | default now() |

### sessions
| Column | Type | Notes |
|--------|------|-------|
| id | text | CUID2, primary key |
| user_id | text | foreign key → users.id |
| refresh_token | text | unique, not null |
| expires_at | timestamp | not null |
| created_at | timestamp | default now() |

### profiles (public — one-to-one with users)
| Column | Type | Notes |
|--------|------|-------|
| id | text | CUID2, primary key |
| user_id | text | unique, foreign key → users.id |
| username | text | unique, mirrored from users |
| display_name | text | nullable |
| bio | text | nullable |
| avatar_url | text | nullable |
| social_links | jsonb | nullable |
| deleted_at | timestamp | nullable (soft delete) |
| created_at | timestamp | default now() |
| updated_at | timestamp | default now() |

### signatures (authorship identity)
| Column | Type | Notes |
|--------|------|-------|
| id | text | CUID2, primary key |
| user_id | text | unique, foreign key → users.id |
| user_hash | text | unique, public authorship identity |
| secret_encrypted | text | AES-256-GCM encrypted per-user secret |
| tx_hash | text | nullable, reserved for blockchain migration |
| created_at | timestamp | default now() |

### document_types (seeded on migration)
| Column | Type | Notes |
|--------|------|-------|
| id | text | CUID2, primary key |
| name | text | unique (article, tutorial, contract, project, page) |
| created_at | timestamp | default now() |

### documents
| Column | Type | Notes |
|--------|------|-------|
| id | text | CUID2, primary key |
| author_id | text | foreign key → profiles.id |
| type_id | text | foreign key → document_types.id |
| status | text | 'draft' \| 'published' \| 'archived' |
| title | text | not null |
| abstract | text | nullable |
| content | jsonb | nullable (TipTap JSON) |
| cover_image_url | text | nullable |
| slug | text | unique per author (author_id + slug) |
| authorship | jsonb | set on publish, null while draft |
| published_at | timestamp | nullable |
| deleted_at | timestamp | nullable (soft delete) |
| created_at | timestamp | default now() |
| updated_at | timestamp | default now() |

### document_styles
| Column | Type | Notes |
|--------|------|-------|
| id | text | CUID2, primary key |
| document_id | text | unique, foreign key → documents.id |
| typography | text | 'sans' \| 'serif' \| 'mono' |
| paper_style | jsonb | nullable |
| paper_texture | jsonb | nullable |
| cover_settings | jsonb | nullable |
| document_header | jsonb | nullable |
| document_footer | jsonb | nullable |
| document_signature | jsonb | nullable |
| updated_at | timestamp | default now() |

### document_style_templates
| Column | Type | Notes |
|--------|------|-------|
| id | text | CUID2, primary key |
| author_id | text | foreign key → profiles.id |
| name | text | not null, max 50 |
| document_type | text | nullable (null = applies to any type) |
| typography | text | 'sans' \| 'serif' \| 'mono' |
| paper_style | jsonb | nullable |
| paper_texture | jsonb | nullable |
| document_header | jsonb | nullable |
| document_footer | jsonb | nullable |
| created_at | timestamp | default now() |

### tutorial_exercises
| Column | Type | Notes |
|--------|------|-------|
| id | text | CUID2, primary key |
| document_id | text | foreign key → documents.id |
| type | text | 'code' \| 'quiz' |
| data | jsonb | exercise data (shape varies by type) |
| created_at | timestamp | default now() |
| updated_at | timestamp | default now() |

### exercise_submissions
| Column | Type | Notes |
|--------|------|-------|
| id | text | CUID2, primary key |
| user_id | text | foreign key → users.id |
| exercise_id | text | foreign key → tutorial_exercises.id |
| attempts | jsonb | array of attempt objects |
| created_at | timestamp | default now() |
| updated_at | timestamp | default now() |

Unique constraint: (user_id, exercise_id)

### document_likes
| Column | Type | Notes |
|--------|------|-------|
| id | text | CUID2, primary key |
| user_id | text | foreign key → users.id |
| document_id | text | foreign key → documents.id |
| created_at | timestamp | default now() |

Unique constraint: (user_id, document_id)

### document_bookmarks
| Column | Type | Notes |
|--------|------|-------|
| id | text | CUID2, primary key |
| user_id | text | foreign key → users.id |
| document_id | text | foreign key → documents.id |
| created_at | timestamp | default now() |

Unique constraint: (user_id, document_id)

### categories
| Column | Type | Notes |
|--------|------|-------|
| id | text | CUID2, primary key |
| name | text | not null |
| slug | text | unique, not null |
| description | text | nullable |
| parent_id | text | self-referential, nullable (hierarchy) |
| created_at | timestamp | default now() |

### tags
| Column | Type | Notes |
|--------|------|-------|
| id | text | CUID2, primary key |
| name | text | unique, not null (normalized to lowercase) |
| slug | text | unique, not null |
| created_at | timestamp | default now() |

### document_categories
| Column | Type | Notes |
|--------|------|-------|
| id | text | CUID2, primary key |
| document_id | text | foreign key → documents.id, unique |
| category_id | text | foreign key → categories.id |
| created_at | timestamp | default now() |

### document_tags
| Column | Type | Notes |
|--------|------|-------|
| id | text | CUID2, primary key |
| document_id | text | foreign key → documents.id |
| tag_id | text | foreign key → tags.id |
| created_at | timestamp | default now() |

Unique constraint: (document_id, tag_id)

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start` | Run production server from dist/ |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Run pending migrations |
| `npm run db:studio` | Open Drizzle Studio |

## How to Run Locally

> **Note:** Docker must be running before starting the server.

```bash
# 1. Copy environment file
cp .env.example .env.development

# 2. Start PostgreSQL with Docker
docker compose up -d

# 3. Install dependencies
npm install

# 4. Generate database migrations
npm run db:generate

# 5. Apply migrations
npm run db:migrate

# 6. Start development server
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
- **Deleted users/profiles/documents always excluded from public queries** — triple check on documents.deleted_at, profiles.deleted_at, users.deleted_at
- **Tutorial exercises included in full document read** — never in DocumentCard feed responses
- **sort=popular is now active** — orders by likes_count DESC, published_at DESC
- **likes_count always computed via COUNT(*)** — never stored in documents table
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

## Response Format

**Success:**
```json
{ "data": <payload>, "error": null, "message": "string" }
```

**Error:**
```json
{ "data": null, "error": { "code": "string", "message": "string" }, "message": "string" }
```

**Validation Error:**
```json
{ "data": null, "error": { "code": "VALIDATION_ERROR", "message": "string", "fields": {} }, "message": "string" }
```

## Auth Routes

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| POST | /api/v1/auth/register | Register new user | 5/min |
| POST | /api/v1/auth/login | Login with email or username | 10/min |
| POST | /api/v1/auth/refresh | Refresh access token | None |
| POST | /api/v1/auth/logout | Logout and invalidate session | None |

All auth routes return `{ data, error, message }` format. Refresh token is stored in httpOnly cookie.

## Profile Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/v1/profiles/:username | No | Get public profile |
| GET | /api/v1/profiles/me | Yes | Get own profile |
| PATCH | /api/v1/profiles/me | Yes | Update own profile |
| DELETE | /api/v1/profiles/me | Yes | Delete own account |

### Username Availability Rules
- Username is blocked for 30 days after account deletion
- When checking availability (register or update), the query excludes:
  - Active users with the same username
  - Deleted users where deleted_at > now() - interval '30 days'

## Public Routes (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/documents | Public document feed (cursor pagination) |
| GET | /api/v1/documents/:username/:slug | Full public document (includes exercises for tutorials) |
| GET | /api/v1/profiles/:username | Get public profile |
| GET | /api/v1/profiles/:username/documents | Author's published documents (cursor pagination) |
| GET | /api/v1/categories | Get all categories (hierarchical) |
| GET | /api/v1/categories/:slug | Get a category by slug |
| GET | /api/v1/tags/popular | Get popular tags sorted by usage |

## Document Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/v1/documents/me | Yes | List my documents (paginated) |
| POST | /api/v1/documents | Yes | Create document |
| PATCH | /api/v1/documents/:id | Yes | Update document |
| PATCH | /api/v1/documents/:id/publish | Yes | Publish document (requires category) |
| DELETE | /api/v1/documents/:id | Yes | Soft delete document |

Note: Create and update accept `categoryId` and `tags[]`. Feed supports `?category=slug&tag=slug` filters.

## Document Style Template Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/v1/document-style-templates | Yes | List my templates |
| POST | /api/v1/document-style-templates | Yes | Create template |
| DELETE | /api/v1/document-style-templates/:id | Yes | Delete template |

## Tutorial Exercises Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/v1/documents/:id/exercises | Yes | List exercises for a document |
| POST | /api/v1/documents/:id/exercises | Yes | Create exercise (document owner only) |
| PATCH | /api/v1/exercises/:id | Yes | Update exercise (document owner only) |
| DELETE | /api/v1/exercises/:id | Yes | Delete exercise (document owner only) |
| POST | /api/v1/exercises/:id/submit | Yes | Submit answer to exercise |

### Exercise Data JSONB Shape

**code:**
```json
{
  "prompt": "string",
  "language": "string",
  "initialCode": "string",
  "expectedOutput": "string"
}
```

**quiz:**
```json
{
  "question": "string",
  "options": ["string"],
  "correctIndex": 0
}
```

### Submission Attempt Shape
```json
{
  "isCorrect": true,
  "submittedAt": "ISO timestamp",
  "codeSubmitted": "string | null"
}
```

## Likes Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/v1/documents/:id/like | Yes | Toggle like on a document |
| GET | /api/v1/documents/:id/likes | No | Get likes count (includes liked_by_me if auth) |

## Bookmarks Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/v1/documents/:id/bookmark | Yes | Toggle bookmark on a document |
| GET | /api/v1/bookmarks/me | Yes | List my bookmarks (paginated) |

## Categories Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/v1/categories | No | Get all categories (hierarchical tree) |
| GET | /api/v1/categories/:slug | No | Get a category by slug |
| POST | /api/v1/categories | Admin | Create a category |
| PATCH | /api/v1/categories/:id | Admin | Update a category |
| DELETE | /api/v1/categories/:id | Admin | Delete a category |

## Tags Routes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/v1/tags/popular | No | Get popular tags (sorted by document count) |

## Authorship JSONB Shape

Set on publish, null while draft:
```json
{
  "authorName": "string",
  "username": "string",
  "userHash": "string",
  "documentHash": "string",
  "publicIdentifier": "PLT-xxxxxxxx.xxxxxxxx",
  "hmac": "string",
  "signedAt": "ISO timestamp"
}
```

## Next Steps

- Books feature (Session 12)
- Highlights feature (Session 13)
- Journals feature (Session 14)
- Follows feature (Session 15)
- Contract signatures integration
- Blockchain migration (populate tx_hash from Solana/Base)
- OAuth integration (GitHub, Google)
- Email verification
- Password reset flow
