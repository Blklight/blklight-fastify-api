# blklight-fastify-api

REST API built with Fastify, auth-first, growing into full CRUD capabilities.

## Current Status

Session 3 complete — auth feature implemented.

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
      profiles.schema.ts - Drizzle schema: profiles table
  db/
    index.ts        - Drizzle client singleton
    migrate.ts      - Migration runner script
  utils/
    crypto.ts       - Password hashing utilities (pbkdf2Sync, 120k iterations)
    errors.ts       - Custom error classes
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
| POST | /api/v1/auth/login | Login with credentials | 10/min |
| POST | /api/v1/auth/refresh | Refresh access token | None |
| POST | /api/v1/auth/logout | Logout and invalidate session | None |

All auth routes return `{ data, error, message }` format. Refresh token is stored in httpOnly cookie.

## Next Steps

- Profiles CRUD routes (Session 4)
- OAuth integration (GitHub, Google)
- Email verification
- Password reset flow
