import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { updateProfileSchema } from './profiles.zod';
import { getPublicProfile, getOwnProfile, updateProfile, deleteAccount } from './profiles.service';
import { env } from '../../config/env';

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

export default async function profileRoutes(app: FastifyInstance) {
  app.get('/:username', {
    schema: {
      summary: 'Get public profile by username',
      tags: ['profiles'],
      params: {
        type: 'object',
        properties: {
          username: { type: 'string' },
        },
        required: ['username'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                displayName: { type: ['string', 'null'] },
                bio: { type: ['string', 'null'] },
                avatarUrl: { type: ['string', 'null'] },
                socialLinks: { type: ['object', 'null'] },
                createdAt: { type: 'string' },
              },
            },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { username: string } }>, reply: FastifyReply) => {
    const { username } = request.params;
    const profile = await getPublicProfile(username);
    reply.send({
      data: {
        ...profile,
        createdAt: profile.createdAt.toISOString(),
      },
      error: null,
      message: 'Profile retrieved',
    });
  });

  app.get('/me', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: {
      summary: 'Get own profile',
      tags: ['profiles'],
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                displayName: { type: ['string', 'null'] },
                bio: { type: ['string', 'null'] },
                avatarUrl: { type: ['string', 'null'] },
                socialLinks: { type: ['object', 'null'] },
                createdAt: { type: 'string' },
                email: { type: 'string' },
                emailVerified: { type: 'boolean' },
                role: { type: 'string' },
              },
            },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const profile = await getOwnProfile(userId);
    reply.send({
      data: {
        ...profile,
        createdAt: profile.createdAt.toISOString(),
      },
      error: null,
      message: 'Profile retrieved',
    });
  });

  app.patch('/me', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: {
      summary: 'Update own profile',
      tags: ['profiles'],
      body: {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 30 },
          displayName: { type: ['string', 'null'] },
          bio: { type: ['string', 'null'], maxLength: 300 },
          avatarUrl: { type: ['string', 'null'] },
          socialLinks: {
            type: ['object', 'null'],
            properties: {
              twitter: { type: 'string' },
              github: { type: 'string' },
              linkedin: { type: 'string' },
              website: { type: 'string' },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                displayName: { type: ['string', 'null'] },
                bio: { type: ['string', 'null'] },
                avatarUrl: { type: ['string', 'null'] },
                socialLinks: { type: ['object', 'null'] },
                createdAt: { type: 'string' },
                email: { type: 'string' },
                emailVerified: { type: 'boolean' },
                role: { type: 'string' },
              },
            },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    const data = request.body as Record<string, unknown>;
    const profile = await updateProfile(userId, data);
    reply.send({
      data: {
        ...profile,
        createdAt: profile.createdAt.toISOString(),
      },
      error: null,
      message: 'Profile updated',
    });
  });

  app.delete('/me', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: {
      summary: 'Delete own account',
      tags: ['profiles'],
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user.userId;
    await deleteAccount(userId);
    reply.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS).send({
      data: null,
      error: null,
      message: 'Account deleted',
    });
  });
}
