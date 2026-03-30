# Security Audit Report

> For detailed remediation steps see [docs/SECURITY_REMEDIATION.md](./SECURITY_REMEDIATION.md)

## Overview

- **Date of Audit**: March 29, 2026
- **Scope**: Full codebase audit of `src/` directory including auth, documents, books, highlights, follows, exercises, and all supporting utilities
- **Summary**: 6 findings total — 1 CRITICAL, 2 HIGH, 2 MEDIUM, 1 LOW

---

## Findings

### [CRITICAL] OAuth State Parameter Not Cryptographically Validated

- **Area**: Authentication / OAuth
- **File**: `src/features/auth/oauth.routes.ts`
- **Description**: OAuth callback routes validate state parameter using only string prefix check (`state?.startsWith('link:')`). This provides no protection against CSRF attacks because an attacker can craft a valid state parameter that passes this check.
- **Risk**: An attacker could link their OAuth account to a victim's session, gaining access to the victim's account. Attackers can create arbitrary state values starting with "link:" and bypass validation.
- **Recommendation**: Use cryptographic state validation:
  1. Generate a cryptographically random state with format: `${userId}:${timestamp}:${randomToken}`
  2. Store the token in a signed cookie or server-side session with expiry
  3. On callback, verify the token matches and has not expired
  4. Alternatively, use OAuth provider's built-in state parameter with proper CSRF protection
- **Priority**: Fix before MVP

### [HIGH] Insufficient Rate Limiting on Sensitive Endpoints

- **Area**: Rate Limiting
- **File**: `src/features/likes/likes.routes.ts`, `src/features/bookmarks/bookmarks.routes.ts`, `src/features/follows/follows.routes.ts`, `src/features/tutorial-exercises/tutorial-exercises.routes.ts`
- **Description**: Only authentication routes (`/register`, `/login`) have explicit rate limits (5/min and 10/min respectively). All other endpoints rely on global fallback of 100 requests/minute, which is insufficient for sensitive operations that modify state:
  - `POST /documents/:id/like` - Toggle like (idempotent but frequent)
  - `POST /documents/:id/bookmark` - Toggle bookmark
  - `POST /profiles/:username/follow` / `DELETE /profiles/:username/follow`
  - `POST /exercises/:id/submit` - Submit exercise answer (includes code execution)
- **Risk**: Attackers or automated scripts can abuse these endpoints for:
  - Like/unlike spam to manipulate engagement metrics
  - Follow/unfollow spam to disrupt platform
  - Exercise submission spam to abuse code execution sandbox
- **Recommendation**: Add explicit rate limits to sensitive mutation endpoints:
  - Like/Bookmark toggles: 30/min per user
  - Follow/Unfollow: 10/min per user
  - Exercise submit: 20/min per user
- **Priority**: Fix before MVP

### [HIGH] OAuth Login Flow Missing State Parameter

- **Area**: Authentication / OAuth
- **File**: `src/features/auth/oauth.routes.ts` (lines 35-40, 106-111)
- **Description**: The initial OAuth login flows (`/github`, `/google`) do not generate or pass any state parameter to the OAuth provider. Only the account linking flows (`/github/link`, `/google/link`) use a state parameter.
- **Risk**: Without a state parameter, the OAuth login flow is vulnerable to CSRF attacks where an attacker could:
  1. Trick a victim into initiating OAuth login
  2. Intercept the authorization code
  3. Complete login to attacker's own account instead of victim's
- **Recommendation**: Generate a cryptographically random state parameter on the initial OAuth redirect and validate it on callback (see CRITICAL finding for implementation details).
- **Priority**: Fix before MVP

### [MEDIUM] URL Validation Too Permissive for User-Provided Assets

- **Area**: Input Validation
- **File**: `src/features/profiles/profiles.routes.ts`, `src/features/documents/documents.routes.ts`
- **Description**: The Zod schemas for `avatarUrl` and `coverImageUrl` only validate using Fastify's built-in `format: 'uri'`, which accepts any URI scheme including:
  - `file://` - Local file access
  - `ftp://` - FTP protocol
  - `javascript:` - JavaScript execution (in some contexts)
  - `data:` - Data URIs
- **Risk**: While direct impact is limited (the URL is stored and rendered in other users' browsers), an attacker could:
  1. Supply malicious URLs that exploit SSRF if the frontend fetches these URLs server-side
  2. Use data: URLs to inject arbitrary content
  3. Use file: URLs to probe internal network if fetched server-side
- **Recommendation**: Restrict allowed URI schemes:
  ```typescript
  avatarUrl: z.string()
    .url()
    .refine((url) => {
      const parsed = new URL(url);
      return ['https'].includes(parsed.protocol.replace(':', ''));
    }, 'Avatar URL must use HTTPS')
  ```
- **Priority**: Fix before Beta

### [MEDIUM] User Hash Exposed in Authorship Response

- **Area**: Data Exposure
- **File**: `src/features/documents/documents.service.ts` (lines 59-67)
- **Description**: The `Authorship` interface includes `userHash` which is derived from user ID + email + creation date + secret. While not the raw secret, this hash could potentially be used to:
  1. Correlate user activity across anonymous sessions if hash leaks
  2. Enable user fingerprinting if the same hash appears across documents
- **Risk**: The user hash is intended for authorship verification but exposing it in API responses could enable tracking users who prefer anonymity.
- **Recommendation**: Remove `userHash` from the Authorship response. The `publicIdentifier` (PLT-xxxxxxxx.xxxxxxxx format) already provides unique authorship identity without exposing the hash.
- **Priority**: Fix before Beta

### [LOW] CORS Configuration Risk in Production

- **Area**: HTTP / Transport
- **File**: `src/app.ts` (line 62)
- **Description**: CORS is configured with `origin: env.CORS_ORIGIN` and `credentials: true`. If `CORS_ORIGIN` is set to `*` (wildcard) in production, browsers will block the request due to conflict with `credentials: true`.
- **Risk**: If deployment misconfigures `CORS_ORIGIN=*` in production, legitimate API requests will fail, causing service disruption.
- **Recommendation**: 
  1. Add validation in `env.ts` to reject `CORS_ORIGIN=*` when `NODE_ENV=production`
  2. Document this requirement clearly
- **Priority**: Fix before Beta

---

## Findings by Priority

| Priority | Finding | Target Phase |
|----------|---------|--------------|
| CRITICAL | OAuth state parameter not cryptographically validated | Pre-MVP |
| HIGH | Insufficient rate limiting on sensitive endpoints | Pre-MVP |
| HIGH | OAuth login flow missing state parameter | Pre-MVP |
| MEDIUM | URL validation too permissive | Beta |
| MEDIUM | User hash exposed in authorship | Beta |
| LOW | CORS configuration risk | Beta |

---

## Recommended Fix Order

### Pre-MVP
1. Implement cryptographic state validation for all OAuth flows (login + link)
2. Add explicit rate limits to sensitive mutation endpoints

### Beta
3. Restrict URL validation to HTTPS-only for user-provided assets
4. Remove userHash from Authorship response
5. Add CORS origin validation for production

---

## What Is Already Secure

- **Password Hashing**: PBKDF2 with SHA-512, 120,000 iterations (OWASP 2024 recommendation)
- **Encryption**: AES-256-GCM with unique IV per encryption operation
- **HMAC Comparisons**: Uses `timingSafeEqual` to prevent timing attacks
- **JWT Secrets**: Minimum 32 characters enforced in Zod validation
- **Refresh Tokens**: Stored in httpOnly, secure, sameSite=strict cookies
- **Session Management**: Token rotation on login, max sessions per user enforced
- **Authorization**: All protected operations verify ownership via authorId checks
- **Input Validation**: Zod schemas on all routes
- **Soft Deletes**: Properly implemented, deleted content excluded from public queries
- **Private Profiles**: Content hidden from non-followers
- **Exercise Answers**: `correctIndex` and `expectedOutput` stripped from reader responses
- **Category Required**: Document publish blocked without category assignment
- **Follow Limits**: Self-follow prevented, duplicate follows handled

---

## Next Steps

- Session 23: Fix OAuth state validation and rate limiting (CRITICAL + HIGH)
- Session 24: Fix URL validation and remove userHash exposure (MEDIUM)
- Session 25: CORS validation (LOW)

See `docs/SECURITY_SESSIONS.md` for detailed mapping.

---

## Reporting Security Issues

If you discover a security vulnerability not documented here, please report it securely rather than creating a public issue.
