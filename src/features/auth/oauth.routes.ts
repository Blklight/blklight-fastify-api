import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  fetchGitHubUser,
  fetchGoogleUser,
  handleOAuthLogin,
  handleOAuthLink,
  completeOnboarding,
  unlinkProvider,
} from './oauth.service';
import { env } from '../../config/env';
import { createSessionWithReply } from './auth.service';

let appInstance: FastifyInstance | null = null;

async function getApp(): Promise<FastifyInstance> {
  if (!appInstance) {
    const { buildApp } = await import('../../app');
    appInstance = await buildApp();
  }
  return appInstance;
}

const onboardingSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
});

export default async function oauthRoutes(app: FastifyInstance) {
  const githubOAuth = app.githubOAuth2;
  const googleOAuth = app.googleOAuth2;

  app.get('/github', {
    schema: { summary: 'Redirect to GitHub OAuth', tags: ['oauth'] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const redirectUrl = await githubOAuth.generateAuthorizationUri({ scope: ['user:email'] });
    return reply.redirect(redirectUrl);
  });

  app.get('/github/callback', {
    schema: { summary: 'GitHub OAuth callback', tags: ['oauth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.query as { code?: string };
    if (!code) {
      return reply.redirect(`${env.FRONTEND_URL}/login?error=missing_code`);
    }
    
    const tokenResult = await githubOAuth.getAccessTokenFromAuthorizationCodeFlow({ code });
    const githubUser = await fetchGitHubUser(tokenResult.token.access_token);

    if (!githubUser.email) {
      return reply.redirect(`${env.FRONTEND_URL}/login?error=github_email_required`);
    }

    const result = await handleOAuthLogin('github', githubUser.id, githubUser.email);

    if (!result.onboardingComplete) {
      const tokenApp = await getApp();
      const jwt = await (tokenApp.jwt.sign as Function)(
        { userId: result.userId, email: '', role: 'user' },
        { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
      );
      return reply.redirect(`${env.FRONTEND_URL}/onboarding?token=${jwt}`);
    }

    await createSessionWithReply(result.userId, reply);
    return reply.redirect(`${env.FRONTEND_URL}/dashboard`);
  });

  app.get('/github/link', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: { summary: 'Link GitHub account (start)', tags: ['oauth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const redirectUrl = await githubOAuth.generateAuthorizationUri({
      scope: ['user:email'],
      state: `link:${userId}`,
    });
    return reply.redirect(redirectUrl);
  });

  app.get('/github/link/callback', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: { summary: 'Link GitHub account (callback)', tags: ['oauth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state } = request.query as Record<string, string>;
    const userId = request.user.userId;

    if (!state?.startsWith('link:') || !code) {
      return reply.redirect(`${env.FRONTEND_URL}/settings/account?error=invalid_state`);
    }

    const tokenResult = await githubOAuth.getAccessTokenFromAuthorizationCodeFlow({ code });
    const githubUser = await fetchGitHubUser(tokenResult.token.access_token);

    if (!githubUser.email) {
      return reply.redirect(`${env.FRONTEND_URL}/settings/account?error=github_email_required`);
    }

    await handleOAuthLink(userId, 'github', githubUser.id);
    return reply.redirect(`${env.FRONTEND_URL}/settings/account?linked=github`);
  });

  app.get('/google', {
    schema: { summary: 'Redirect to Google OAuth', tags: ['oauth'] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const redirectUrl = await googleOAuth.generateAuthorizationUri({ scope: ['profile', 'email'] });
    return reply.redirect(redirectUrl);
  });

  app.get('/google/callback', {
    schema: { summary: 'Google OAuth callback', tags: ['oauth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.query as { code?: string };
    if (!code) {
      return reply.redirect(`${env.FRONTEND_URL}/login?error=missing_code`);
    }

    const tokenResult = await googleOAuth.getAccessTokenFromAuthorizationCodeFlow({ code });
    const googleUser = await fetchGoogleUser(tokenResult.token.access_token);

    if (!googleUser.email) {
      return reply.redirect(`${env.FRONTEND_URL}/login?error=google_email_required`);
    }

    const result = await handleOAuthLogin('google', googleUser.id, googleUser.email);

    if (!result.onboardingComplete) {
      const tokenApp = await getApp();
      const jwt = await (tokenApp.jwt.sign as Function)(
        { userId: result.userId, email: '', role: 'user' },
        { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
      );
      return reply.redirect(`${env.FRONTEND_URL}/onboarding?token=${jwt}`);
    }

    await createSessionWithReply(result.userId, reply);
    return reply.redirect(`${env.FRONTEND_URL}/dashboard`);
  });

  app.get('/google/link', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: { summary: 'Link Google account (start)', tags: ['oauth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const redirectUrl = await googleOAuth.generateAuthorizationUri({
      scope: ['profile', 'email'],
      state: `link:${userId}`,
    });
    return reply.redirect(redirectUrl);
  });

  app.get('/google/link/callback', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: { summary: 'Link Google account (callback)', tags: ['oauth'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { code, state } = request.query as Record<string, string>;
    const userId = request.user.userId;

    if (!state?.startsWith('link:') || !code) {
      return reply.redirect(`${env.FRONTEND_URL}/settings/account?error=invalid_state`);
    }

    const tokenResult = await googleOAuth.getAccessTokenFromAuthorizationCodeFlow({ code });
    const googleUser = await fetchGoogleUser(tokenResult.token.access_token);

    if (!googleUser.email) {
      return reply.redirect(`${env.FRONTEND_URL}/settings/account?error=google_email_required`);
    }

    await handleOAuthLink(userId, 'google', googleUser.id);
    return reply.redirect(`${env.FRONTEND_URL}/settings/account?linked=google`);
  });

  app.post('/onboarding', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: {
      summary: 'Complete OAuth onboarding',
      tags: ['oauth'],
      body: {
        type: 'object',
        required: ['username'],
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 30 },
        },
      },
      response: {
        201: { type: 'object', properties: { data: { type: 'object' }, error: { type: 'null' }, message: { type: 'string' } } },
        400: { type: 'object', properties: { data: { type: 'null' }, error: { type: 'object' }, message: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.user;
    const parsed = onboardingSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), i.message])),
        },
        message: 'Validation failed',
      });
    }

    const { accessToken } = await completeOnboarding(userId, parsed.data.username);
    await createSessionWithReply(userId, reply);

    reply.code(201).send({
      data: { accessToken },
      error: null,
      message: 'Onboarding complete',
    });
  });

  app.delete('/account/unlink/:provider', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: {
      summary: 'Unlink OAuth provider',
      tags: ['oauth'],
      params: {
        type: 'object',
        properties: { provider: { type: 'string', enum: ['github', 'google'] } },
        required: ['provider'],
      },
      response: {
        200: { type: 'object', properties: { data: { type: 'null' }, error: { type: 'null' }, message: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.user;
    const params = request.params as { provider: 'github' | 'google' };
    await unlinkProvider(userId, params.provider);

    reply.send({
      data: null,
      error: null,
      message: 'Provider unlinked successfully',
    });
  });
}
