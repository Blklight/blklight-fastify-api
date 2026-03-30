# Security Fix Sessions

This document maps security findings from `docs/SECURITY.md` to future sessions for fixing.

---

## Session 23 — Critical & High Fixes (Pre-MVP)

**Goal**: Fix all CRITICAL and HIGH findings before Pre-MVP release

### Findings to Address

| # | Finding | Files |
|---|---------|-------|
| 1 | OAuth state not cryptographically validated | `src/features/auth/oauth.routes.ts` |
| 2 | Missing rate limit - likes | `src/features/likes/likes.routes.ts` |
| 3 | Missing rate limit - bookmarks | `src/features/bookmarks/bookmarks.routes.ts` |
| 4 | Missing rate limit - follows | `src/features/follows/follows.routes.ts` |
| 5 | Missing rate limit - exercise submit | `src/features/tutorial-exercises/tutorial-exercises.routes.ts` |
| 6 | OAuth login flow missing state parameter | `src/features/auth/oauth.routes.ts` |

### Estimated Effort

- **Total**: Medium effort (primarily in OAuth state handling)
- **OAuth fixes**: ~2-3 hours (new state management infrastructure)
- **Rate limits**: ~30 minutes (add config to 4 route files)

### Key Tasks

1. Implement `generateOAuthState()` and `validateOAuthState()` helpers
2. Add state parameter to all OAuth login redirects
3. Add state validation to all OAuth callbacks
4. Add `rateLimit` config to:
   - `POST /documents/:id/like`
   - `POST /documents/:id/bookmark`
   - `POST /profiles/:username/follow`
   - `DELETE /profiles/:username/follow`
   - `POST /exercises/:id/submit`

---

## Session 24 — Beta Security Fixes

**Goal**: Fix MEDIUM findings before Beta release

### Findings to Address

| # | Finding | Files |
|---|---------|-------|
| 7 | URL validation too permissive | `src/features/profiles/profiles.routes.ts`, `src/features/documents/documents.routes.ts` |
| 8 | userHash exposed in Authorship | `src/features/documents/documents.service.ts` |

### Estimated Effort

- **Total**: Small effort (~1 hour)

### Key Tasks

1. Create shared `httpsUrlSchema()` helper
2. Update avatarUrl and coverImageUrl validations
3. Remove userHash from Authorship interface
4. Update publishDocument to not include userHash in response

---

## Session 25 — v1.0 Security Fixes

**Goal**: Fix LOW findings before v1.0 release

### Findings to Address

| # | Finding | Files |
|---|---------|-------|
| 9 | CORS configuration risk | `src/config/env.ts`, `src/app.ts` |

### Estimated Effort

- **Total**: Small effort (~15 minutes)

### Key Tasks

1. Add Zod refinement to reject `CORS_ORIGIN=*` in production

---

## Session Timeline Summary

| Session | Phase | Findings | Effort |
|---------|-------|----------|--------|
| Session 23 | Pre-MVP | 1 CRITICAL + 5 HIGH | Medium |
| Session 24 | Beta | 2 MEDIUM | Small |
| Session 25 | v1.0 | 1 LOW | Small |

---

## Notes

- Session numbers align with SECURITY.md "Next Steps" section
- Each session should include tests for the implemented fixes
- Run `npm test` before completing each session
- Update SECURITY_REMEDIATION.md with commit references when findings are fixed
