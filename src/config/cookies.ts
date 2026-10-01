import { env } from './env';

/**
 * Name of the cookie carrying the session refresh token.
 * Single source of truth: the browser sends it back on /auth/refresh and
 * /auth/logout, and the client never sees the value because the cookie is
 * httpOnly. Only the access token is ever exposed in a response body.
 */
export const REFRESH_COOKIE_NAME = 'refreshToken';

type RefreshCookieOptions = {
  httpOnly: true;
  path: '/';
  sameSite: 'strict' | 'lax' | 'none';
  secure: boolean;
  maxAge?: number;
};

/**
 * Build the options for setting or clearing the refresh cookie.
 * Every write path (login, register, OAuth callback, onboarding) and every
 * clear path must go through this function so set and clear attributes always
 * match: browsers only drop a cookie when the clearing Set-Cookie repeats the
 * original name, path and domain.
 *
 * No domain is set on purpose, keeping the cookie host-only for the API.
 *
 * `secure` is forced on when SameSite=None because browsers reject a
 * SameSite=None cookie that is not Secure.
 * @param maxAgeSeconds - Cookie lifetime in seconds; omit when clearing
 * @returns Options for reply.setCookie / reply.clearCookie
 */
export function buildRefreshCookieOptions(maxAgeSeconds?: number): RefreshCookieOptions {
  const sameSite = env.COOKIE_SAMESITE;
  const secure = env.NODE_ENV === 'production' || sameSite === 'none';

  return {
    httpOnly: true,
    path: '/',
    sameSite,
    secure,
    ...(maxAgeSeconds === undefined ? {} : { maxAge: Math.floor(maxAgeSeconds) }),
  };
}

/**
 * Options for clearing the refresh cookie.
 * Max-Age is intentionally omitted: @fastify/cookie turns a clearCookie call
 * into an expired cookie (Max-Age=0 / past Expires) on its own.
 * @returns Options for reply.clearCookie, matching the set attributes
 */
export function buildRefreshCookieClearOptions(): RefreshCookieOptions {
  return buildRefreshCookieOptions();
}
