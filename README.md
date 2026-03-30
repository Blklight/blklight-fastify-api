# blklight-fastify-api

A Fastify-based REST API with JWT authentication, PostgreSQL database, and comprehensive API documentation.

## Tech Stack

- **Fastify v5** with TypeScript
- **PostgreSQL** with Drizzle ORM
- **Zod v4** for validation
- **JWT** for authentication (access + refresh tokens)
- **Scalar** for interactive API documentation

## Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)

## Setup

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

# 6. Seed database (categories and tags)
npm run db:seed

# 7. Start development server
npm run dev
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run production server |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed database (categories, tags) |
| `npm run db:studio` | Open Drizzle Studio |

## API

### Health Check
```
GET /health
```

### Authentication Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/register | Register new user |
| POST | /api/v1/auth/login | Login with email or username |
| POST | /api/v1/auth/refresh | Refresh access token |
| POST | /api/v1/auth/logout | Logout and invalidate session |

### Profile Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/v1/profiles/:username | No | Get public profile |
| GET | /api/v1/profiles/me | Yes | Get own profile |
| PATCH | /api/v1/profiles/me | Yes | Update own profile |
| DELETE | /api/v1/profiles/me | Yes | Delete own account |

### Document Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/v1/documents/me | Yes | List my documents (paginated) |
| POST | /api/v1/documents | Yes | Create document |
| PATCH | /api/v1/documents/:id | Yes | Update document |
| PATCH | /api/v1/documents/:id/publish | Yes | Publish document |
| DELETE | /api/v1/documents/:id | Yes | Soft delete document |

### Document Style Template Endpoints
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /api/v1/document-style-templates | Yes | List my templates |
| POST | /api/v1/document-style-templates | Yes | Create template |
| DELETE | /api/v1/document-style-templates/:id | Yes | Delete template |

Full API documentation available at `GET /docs` via Scalar.

## Folder Structure

```
src/
  http/
    server.ts       - Entry point with graceful shutdown
  features/
    auth/            - Authentication (register, login, refresh, logout)
    profiles/        - User profiles CRUD
  db/
    index.ts        - Drizzle client
    migrate.ts      - Migration runner
  utils/
    crypto.ts       - Password hashing (pbkdf2Sync)
    errors.ts       - Custom error classes
  config/
    env.ts          - Environment validation
  app.ts            - Fastify app setup
```

## Environment Variables

See `.env.example` for all required variables:

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_ACCESS_SECRET` — Access token secret (min 32 chars)
- `JWT_REFRESH_SECRET` — Refresh token secret (min 32 chars)
- `JWT_ACCESS_EXPIRES_IN` — Access token expiry (default: 15m)
- `JWT_REFRESH_EXPIRES_IN` — Refresh token expiry (default: 7d)
- `PORT` — Server port (default: 3000)
- `NODE_ENV` — Environment (development/production/test)
- `LOG_LEVEL` — Logging level
- `CORS_ORIGIN` — CORS origin (default: *)
- `MAX_SESSIONS_PER_USER` — Max sessions per user (default: 5)
- `SIGNATURE_ENCRYPTION_KEY` — AES-256-GCM encryption key (64 hex chars)

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for feature release phases:

- **Pre-MVP** — Docker, PostgreSQL, migrations, seed, health check, API docs
- **MVP** — Auth, profiles, documents, categories/tags, admin category management
- **Beta** — Workspace, notes, exercises, likes/bookmarks, account management
- **v1.0** — Books, highlights/journals, follows, social feed
- **Future** — Comments, sharevault, team workspaces, email verification, and more

## Frontend Types

TypeScript types for the frontend are available in `types/api.types.ts`. This file is **self-contained** — copy it to your frontend project without any imports from `src/`.

```bash
cp types/api.types.ts /path/to/frontend/src/types/api.ts
```

All request and response types are derived from the backend Zod schemas and service return types.

## Testing

```bash
npm test           # Run all tests
npm run test:watch # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```
