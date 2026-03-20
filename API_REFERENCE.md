# API Reference — blklight-fastify-api

Base URL: `http://localhost:3000`

## Public Documents (No Auth Required)

These endpoints are publicly accessible without authentication. Any visitor can read documents, browse profiles, and explore content.

---

### GET /api/v1/documents

Get a paginated feed of published documents.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| cursor | string | - | Opaque cursor for pagination (omit for first page) |
| limit | integer | 20 | Results per page (max 50) |
| type | string | - | Filter by document type (article, tutorial, contract, project, page) |
| author | string | - | Filter by author's username |
| q | string | - | Search in title and abstract (max 100 chars) |
| sort | string | recent | Sort order: "recent" (only option currently) |

**Pagination:**

To get the first page, omit the `cursor` parameter. The response includes a `nextCursor` field. To get the next page, pass this cursor value in the `cursor` query parameter. When `nextCursor` is `null`, there are no more results.

**Example Request:**
```
GET /api/v1/documents?limit=10&type=article&sort=recent
```

**Example Response (200):**
```json
{
  "data": {
    "items": [
      {
        "id": "doc123abc...",
        "title": "Getting Started with TypeScript",
        "abstract": "A comprehensive guide to TypeScript basics",
        "coverImageUrl": "https://example.com/cover.jpg",
        "slug": "getting-started-with-typescript",
        "publishedAt": "2024-02-15T10:00:00.000Z",
        "typeName": "article",
        "author": {
          "username": "johndoe",
          "displayName": "John Doe",
          "avatarUrl": "https://example.com/avatar.jpg"
        },
        "authorship": {
          "publicIdentifier": "PLT-xxxxxxxx.xxxxxxxx"
        }
      }
    ],
    "nextCursor": "eyJwdWJsaXNoZWRBdCI6IjIwMjQtMDItMTVUMTA6MDA6MDAuMDAwWiIsImlkIjoiZG9jMTIzYWJjLi4uIn0=",
    "total": 42
  },
  "error": null,
  "message": "Feed retrieved"
}
```

**Note:** The `cursor` value is base64-encoded JSON. Pass it as-is to the next request. Tutorial exercises are not included in feed items — only in full document reads.

**Error Codes:** `VALIDATION_ERROR`

---

### GET /api/v1/documents/:username/:slug

Get the full content of a published document.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| username | string | Author's username |
| slug | string | Document's URL-friendly slug |

**Example Response (200):**
```json
{
  "data": {
    "id": "doc123abc...",
    "title": "Understanding Async/Await in JavaScript",
    "abstract": "Learn how to work with asynchronous code",
    "content": {
      "type": "doc",
      "content": [...]
    },
    "coverImageUrl": "https://example.com/cover.jpg",
    "slug": "understanding-async-await",
    "publishedAt": "2024-02-15T10:00:00.000Z",
    "typeName": "tutorial",
    "author": {
      "username": "johndoe",
      "displayName": "John Doe",
      "avatarUrl": "https://example.com/avatar.jpg"
    },
    "style": {
      "typography": "sans",
      "paperStyle": null,
      "paperTexture": null,
      "coverSettings": null,
      "documentHeader": null,
      "documentFooter": null,
      "documentSignature": null
    },
    "authorship": {
      "authorName": "John Doe",
      "username": "johndoe",
      "userHash": "abc123...",
      "documentHash": "def456...",
      "publicIdentifier": "PLT-xxxxxxxx.xxxxxxxx",
      "hmac": "hmac789...",
      "signedAt": "2024-02-15T10:00:00.000Z"
    },
    "exercises": [
      {
        "id": "exr123abc...",
        "documentId": "doc123...",
        "type": "code",
        "data": {
          "prompt": "Write a function that returns 'Hello, World!'",
          "language": "javascript",
          "initialCode": "// Start here\n"
        },
        "createdAt": "2024-02-15T10:00:00.000Z",
        "updatedAt": "2024-02-15T10:00:00.000Z"
      }
    ]
  },
  "error": null,
  "message": "Document retrieved"
}
```

**Note:** The `exercises` array is only included for documents of type "tutorial". For other types, this field is omitted.

**Error Codes:** `NOT_FOUND`

---

### GET /api/v1/profiles/:username

Get a public profile by username.

**Auth Required:** No

**Example Response (200):**
```json
{
  "data": {
    "username": "johndoe",
    "displayName": "John Doe",
    "bio": "Software developer",
    "avatarUrl": "https://example.com/avatar.jpg",
    "socialLinks": {
      "twitter": "https://twitter.com/johndoe",
      "github": "https://github.com/johndoe"
    },
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "error": null,
  "message": "Profile retrieved"
}
```

**Error Codes:** `NOT_FOUND`

---

### GET /api/v1/profiles/:username/documents

Get a paginated list of a specific author's published documents.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| username | string | Author's username |

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| cursor | string | - | Pagination cursor |
| limit | integer | 20 | Results per page (max 50) |
| type | string | - | Filter by document type |

**Example Response (200):**
```json
{
  "data": {
    "items": [
      {
        "id": "doc123abc...",
        "title": "Getting Started with TypeScript",
        "abstract": "A comprehensive guide to TypeScript basics",
        "coverImageUrl": "https://example.com/cover.jpg",
        "slug": "getting-started-with-typescript",
        "publishedAt": "2024-02-15T10:00:00.000Z",
        "typeName": "article",
        "author": {
          "username": "johndoe",
          "displayName": "John Doe",
          "avatarUrl": "https://example.com/avatar.jpg"
        },
        "authorship": {
          "publicIdentifier": "PLT-xxxxxxxx.xxxxxxxx"
        }
      }
    ],
    "nextCursor": null,
    "total": 5
  },
  "error": null,
  "message": "Author documents retrieved"
}
```

**Error Codes:** `NOT_FOUND`, `VALIDATION_ERROR`

---

## Authentication

Most endpoints require authentication via Bearer token. Pass the JWT access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Auth endpoints also use httpOnly cookies for refresh tokens. The refresh token is automatically set when you register or login.

## Response Format

### Success
```json
{
  "data": <payload>,
  "error": null,
  "message": "Operation description"
}
```

### Error
```json
{
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  },
  "message": "Human-readable summary"
}
```

### Validation Error
```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "fields": {
      "fieldName": "Validation error message"
    }
  },
  "message": "Validation failed"
}
```

---

## Auth

### POST /api/v1/auth/register

Register a new user account.

**Auth Required:** No

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Valid email address |
| username | string | Yes | 3-30 chars, alphanumeric + underscores |
| password | string | Yes | Min 8 chars |

**Example Request:**
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securepassword123"
}
```

**Example Response (201):**
```json
{
  "data": {
    "userId": "cls123abc...",
    "email": "user@example.com",
    "username": "johndoe"
  },
  "error": null,
  "message": "User registered"
}
```

**Error Codes:** `VALIDATION_ERROR`, `CONFLICT`

---

### POST /api/v1/auth/login

Login with email or username.

**Auth Required:** No

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| identifier | string | Yes | Email address or username |
| password | string | Yes | Account password |

**Example Request:**
```json
{
  "identifier": "user@example.com",
  "password": "securepassword123"
}
```

**Example Request (with username):**
```json
{
  "identifier": "johndoe",
  "password": "securepassword123"
}
```

**Example Response (200):**
```json
{
  "data": {
    "userId": "cls123abc...",
    "email": "user@example.com",
    "username": "johndoe"
  },
  "error": null,
  "message": "Login successful"
}
```

A `refresh_token` cookie is set automatically (httpOnly, secure in production).

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`

---

### POST /api/v1/auth/refresh

Refresh the access token using the refresh token cookie.

**Auth Required:** No (cookie only)

**Example Response (200):**
```json
{
  "data": {
    "userId": "cls123abc...",
    "email": "user@example.com",
    "username": "johndoe"
  },
  "error": null,
  "message": "Token refreshed"
}
```

**Error Codes:** `UNAUTHORIZED`

---

### POST /api/v1/auth/logout

Invalidate the current session and clear the refresh token cookie.

**Auth Required:** Yes

**Example Response (200):**
```json
{
  "data": null,
  "error": null,
  "message": "Logged out"
}
```

**Error Codes:** `UNAUTHORIZED`

---

## Profiles

### GET /api/v1/profiles/:username

Get a public profile by username.

**Auth Required:** No

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| username | string | The username to look up |

**Example Response (200):**
```json
{
  "data": {
    "id": "prf123abc...",
    "username": "johndoe",
    "displayName": "John Doe",
    "bio": "Software developer",
    "avatarUrl": "https://example.com/avatar.jpg",
    "socialLinks": {
      "twitter": "https://twitter.com/johndoe",
      "github": "https://github.com/johndoe"
    },
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "error": null,
  "message": "Profile retrieved"
}
```

**Error Codes:** `NOT_FOUND`

---

### GET /api/v1/profiles/me

Get the authenticated user's own profile.

**Auth Required:** Yes

**Example Response (200):**
```json
{
  "data": {
    "id": "prf123abc...",
    "userId": "usr123abc...",
    "username": "johndoe",
    "displayName": "John Doe",
    "bio": "Software developer",
    "avatarUrl": "https://example.com/avatar.jpg",
    "socialLinks": {
      "twitter": "https://twitter.com/johndoe"
    },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-02-20T14:45:00.000Z"
  },
  "error": null,
  "message": "Profile retrieved"
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`

---

### PATCH /api/v1/profiles/me

Update the authenticated user's own profile.

**Auth Required:** Yes

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| displayName | string | No | Max 100 chars |
| bio | string | No | Max 500 chars |
| avatarUrl | string | No | Valid URL |
| socialLinks | object | No | Social media links |

**Example Request:**
```json
{
  "displayName": "John D.",
  "bio": "Full-stack developer and open source enthusiast",
  "socialLinks": {
    "twitter": "https://twitter.com/johnd",
    "github": "https://github.com/johnd"
  }
}
```

**Example Response (200):**
```json
{
  "data": {
    "id": "prf123abc...",
    "username": "johndoe",
    "displayName": "John D.",
    "bio": "Full-stack developer and open source enthusiast",
    "avatarUrl": null,
    "socialLinks": {
      "twitter": "https://twitter.com/johnd",
      "github": "https://github.com/johnd"
    },
    "updatedAt": "2024-03-01T09:00:00.000Z"
  },
  "error": null,
  "message": "Profile updated"
}
```

**Error Codes:** `UNAUTHORIZED`, `VALIDATION_ERROR`, `CONFLICT`

---

### DELETE /api/v1/profiles/me

Delete the authenticated user's account (soft delete).

**Auth Required:** Yes

**Example Response (200):**
```json
{
  "data": null,
  "error": null,
  "message": "Account deleted"
}
```

**Error Codes:** `UNAUTHORIZED`

---

## Documents

### GET /api/v1/documents/me

List the authenticated user's documents.

**Auth Required:** Yes

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | integer | 20 | Max 1-100 |
| offset | integer | 0 | Pagination offset |

**Example Response (200):**
```json
{
  "data": [
    {
      "id": "doc123abc...",
      "title": "Getting Started with TypeScript",
      "abstract": "A comprehensive guide to TypeScript basics",
      "status": "published",
      "typeName": "article",
      "slug": "getting-started-with-typescript",
      "coverImageUrl": "https://example.com/cover.jpg",
      "authorship": {
        "authorName": "John Doe",
        "username": "johndoe",
        "userHash": "abc123...",
        "documentHash": "def456...",
        "publicIdentifier": "PLT-xxxxxxxx.xxxxxxxx",
        "hmac": "hmac123...",
        "signedAt": "2024-02-15T10:00:00.000Z"
      },
      "publishedAt": "2024-02-15T10:00:00.000Z",
      "updatedAt": "2024-02-15T10:00:00.000Z",
      "createdAt": "2024-02-10T08:00:00.000Z"
    }
  ],
  "error": null,
  "message": "Documents retrieved"
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`

---

### POST /api/v1/documents

Create a new document.

**Auth Required:** Yes

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | 1-200 chars |
| type | string | Yes | Document type (article, tutorial, contract, project, page) |
| abstract | string | No | Max 500 chars |
| content | object | No | TipTap JSON content |
| coverImageUrl | string | No | Valid URL |
| slug | string | No | Custom slug (lowercase alphanumeric with hyphens) |

**Example Request:**
```json
{
  "title": "Understanding Async/Await in JavaScript",
  "type": "tutorial",
  "abstract": "Learn how to work with asynchronous code",
  "slug": "understanding-async-await"
}
```

**Example Response (201):**
```json
{
  "data": {
    "id": "doc123abc...",
    "authorId": "prf123abc...",
    "typeId": "tut123...",
    "typeName": "tutorial",
    "status": "draft",
    "title": "Understanding Async/Await in JavaScript",
    "abstract": "Learn how to work with asynchronous code",
    "content": null,
    "coverImageUrl": null,
    "slug": "understanding-async-await",
    "authorship": null,
    "publishedAt": null,
    "createdAt": "2024-03-01T10:00:00.000Z",
    "updatedAt": "2024-03-01T10:00:00.000Z",
    "style": {
      "typography": "sans",
      "paperStyle": null,
      "paperTexture": null,
      "coverSettings": null,
      "documentHeader": null,
      "documentFooter": null,
      "documentSignature": null
    }
  },
  "error": null,
  "message": "Document created"
}
```

**Error Codes:** `UNAUTHORIZED`, `VALIDATION_ERROR`

---

### PATCH /api/v1/documents/:id

Update a document.

**Auth Required:** Yes (must be document owner)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Document ID |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | No | 1-200 chars |
| abstract | string | No | Max 500 chars |
| content | object | No | TipTap JSON content |
| coverImageUrl | string | No | Valid URL |
| type | string | No | Document type |
| slug | string | No | Custom slug |
| typography | string | No | sans, serif, or mono |
| paperStyle | object | No | Paper style settings |
| paperTexture | object | No | Paper texture settings |
| coverSettings | object | No | Cover settings |
| documentHeader | object | No | Header configuration |
| documentFooter | object | No | Footer configuration |

**Note:** Editing content on a published document resets authorship and status to draft. You must re-publish to re-sign.

**Example Response (200):**
```json
{
  "data": {
    "id": "doc123abc...",
    "title": "Understanding Async/Await in JavaScript - Updated",
    "status": "draft",
    "authorship": null,
    ...
  },
  "error": null,
  "message": "Document updated"
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `VALIDATION_ERROR`

---

### PATCH /api/v1/documents/:id/publish

Publish a document and generate its authorship signature.

**Auth Required:** Yes (must be document owner)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Document ID |

**Example Response (200):**
```json
{
  "data": {
    "id": "doc123abc...",
    "status": "published",
    "authorship": {
      "authorName": "John Doe",
      "username": "johndoe",
      "userHash": "abc123...",
      "documentHash": "def456...",
      "publicIdentifier": "PLT-xxxxxxxx.xxxxxxxx",
      "hmac": "hmac789...",
      "signedAt": "2024-03-01T15:30:00.000Z"
    },
    "publishedAt": "2024-03-01T15:30:00.000Z",
    ...
  },
  "error": null,
  "message": "Document published"
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `VALIDATION_ERROR`

---

### DELETE /api/v1/documents/:id

Soft delete a document.

**Auth Required:** Yes (must be document owner)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Document ID |

**Example Response (200):**
```json
{
  "data": null,
  "error": null,
  "message": "Document deleted"
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`

---

## Document Style Templates

### GET /api/v1/document-style-templates

List the authenticated user's style templates.

**Auth Required:** Yes

**Example Response (200):**
```json
{
  "data": [
    {
      "id": "tpl123abc...",
      "authorId": "prf123abc...",
      "name": "Academic Paper",
      "documentType": "article",
      "typography": "serif",
      "paperStyle": {
        "margins": "1in",
        "lineHeight": 1.6
      },
      "paperTexture": null,
      "documentHeader": {
        "showTitle": true,
        "showAuthor": true
      },
      "documentFooter": {
        "showPageNumber": true
      },
      "createdAt": "2024-02-01T10:00:00.000Z"
    }
  ],
  "error": null,
  "message": "Templates retrieved"
}
```

**Error Codes:** `UNAUTHORIZED`

---

### POST /api/v1/document-style-templates

Create a new style template.

**Auth Required:** Yes

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Max 50 chars |
| documentType | string | No | null = applies to any type |
| typography | string | Yes | sans, serif, or mono |
| paperStyle | object | No | Paper styling |
| paperTexture | object | No | Texture settings |
| documentHeader | object | No | Header configuration |
| documentFooter | object | No | Footer configuration |

**Example Request:**
```json
{
  "name": "Technical Documentation",
  "documentType": null,
  "typography": "mono",
  "paperStyle": {
    "margins": "1in"
  }
}
```

**Example Response (201):**
```json
{
  "data": {
    "id": "tpl456def...",
    "authorId": "prf123abc...",
    "name": "Technical Documentation",
    "documentType": null,
    "typography": "mono",
    ...
  },
  "error": null,
  "message": "Template created"
}
```

**Error Codes:** `UNAUTHORIZED`, `VALIDATION_ERROR`

---

### DELETE /api/v1/document-style-templates/:id

Delete a style template.

**Auth Required:** Yes (must be template owner)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Template ID |

**Example Response (200):**
```json
{
  "data": null,
  "error": null,
  "message": "Template deleted"
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`

---

## Tutorial Exercises

### GET /api/v1/documents/:id/exercises

Get all exercises for a tutorial document. Answers are stripped from the response.

**Auth Required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Document ID |

**Example Response (200):**
```json
{
  "data": [
    {
      "id": "exr123abc...",
      "documentId": "doc123...",
      "type": "code",
      "data": {
        "prompt": "Write a function that returns 'Hello, World!'",
        "language": "javascript",
        "initialCode": "// Start here\n"
      },
      "createdAt": "2024-03-01T10:00:00.000Z",
      "updatedAt": "2024-03-01T10:00:00.000Z"
    },
    {
      "id": "exr456def...",
      "documentId": "doc123...",
      "type": "quiz",
      "data": {
        "question": "What does async/await simplify?",
        "options": [
          "Synchronous code",
          "Asynchronous code",
          "Type definitions",
          "Database queries"
        ]
      },
      "createdAt": "2024-03-01T10:05:00.000Z",
      "updatedAt": "2024-03-01T10:05:00.000Z"
    }
  ],
  "error": null,
  "message": "Exercises retrieved"
}
```

**Note:** `expectedOutput` and `correctIndex` are never returned to readers. TypeScript is transpiled via esbuild before execution.

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`

---

### POST /api/v1/documents/:id/exercises

Create a new exercise for a tutorial document.

**Auth Required:** Yes (must be document owner)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Document ID |

**Request Body (code exercise):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | Must be "code" |
| data.prompt | string | Yes | Exercise description |
| data.language | string | Yes | Language: "javascript" or "typescript" |
| data.initialCode | string | Yes | Starter code shown to user |
| data.expectedOutput | string | Yes | Expected output for validation |

**Request Body (quiz exercise):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | Must be "quiz" |
| data.question | string | Yes | The question |
| data.options | string[] | Yes | 2-6 answer choices |
| data.correctIndex | number | Yes | Index of correct answer (0-based) |

**Example Request (code):**
```json
{
  "type": "code",
  "data": {
    "prompt": "Write a function that returns the sum of two numbers",
    "language": "javascript",
    "initialCode": "function sum(a, b) {\n  // your code here\n}",
    "expectedOutput": "3"
  }
}
```

**Example Response (201):**
```json
{
  "data": {
    "id": "exr789ghi...",
    "documentId": "doc123...",
    "type": "code",
    "data": {
      "prompt": "Write a function that returns the sum of two numbers",
      "language": "javascript",
      "initialCode": "function sum(a, b) {\n  // your code here\n}",
      "expectedOutput": "3"
    },
    "createdAt": "2024-03-01T12:00:00.000Z",
    "updatedAt": "2024-03-01T12:00:00.000Z"
  },
  "error": null,
  "message": "Exercise created"
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `VALIDATION_ERROR`

---

### PATCH /api/v1/exercises/:id

Update an exercise.

**Auth Required:** Yes (must be document owner)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Exercise ID |

**Request Body:** Same as POST, but all fields are optional. Uses discriminated union on `type`.

**Example Request:**
```json
{
  "type": "code",
  "data": {
    "expectedOutput": "5"
  }
}
```

**Example Response (200):**
```json
{
  "data": {
    "id": "exr789ghi...",
    "type": "code",
    "data": {
      "prompt": "Write a function that returns the sum of two numbers",
      "language": "javascript",
      "initialCode": "function sum(a, b) {\n  // your code here\n}",
      "expectedOutput": "5"
    },
    "updatedAt": "2024-03-01T14:00:00.000Z"
  },
  "error": null,
  "message": "Exercise updated"
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `VALIDATION_ERROR`

---

### DELETE /api/v1/exercises/:id

Delete an exercise.

**Auth Required:** Yes (must be document owner)

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Exercise ID |

**Example Response (200):**
```json
{
  "data": null,
  "error": null,
  "message": "Exercise deleted"
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`

---

### POST /api/v1/exercises/:id/submit

Submit an answer to an exercise.

**Auth Required:** Yes

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Exercise ID |

**Request Body (code submission):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | Must be "code" |
| code | string | Yes | User's code submission |

**Request Body (quiz submission):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| type | string | Yes | Must be "quiz" |
| answerIndex | number | Yes | Index of selected answer (0-based) |

**Example Request (code):**
```json
{
  "type": "code",
  "code": "function sum(a, b) {\n  return a + b;\n}\nconsole.log(sum(1, 2));"
}
```

**Example Response (200):**
```json
{
  "data": {
    "isCorrect": true,
    "attemptsCount": 3
  },
  "error": null,
  "message": "Answer submitted"
}
```

**Example Request (quiz):**
```json
{
  "type": "quiz",
  "answerIndex": 1
}
```

**Example Response (200):**
```json
{
  "data": {
    "isCorrect": false,
    "attemptsCount": 2
  },
  "error": null,
  "message": "Answer submitted"
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `VALIDATION_ERROR`

---

## Error Codes Reference

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Request body/params failed validation |
| UNAUTHORIZED | 401 | Missing or invalid JWT token |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource already exists (e.g., duplicate email) |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Unexpected server error |
