import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { toggleLike, getLikesCount } from './likes.service';

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

interface DocumentParams {
  id: string;
}

export default async function likesRoutes(app: FastifyInstance) {
  app.post('/documents/:id/like', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: {
      summary: 'Toggle like on a document',
      tags: ['likes'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                liked: { type: 'boolean' },
                likesCount: { type: 'number' },
              },
            },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const params = request.params as DocumentParams;
    const { userId } = request.user;
    const { id } = params;

    const result = await toggleLike(userId, id);

    reply.send({
      data: result,
      error: null,
      message: result.liked ? 'Document liked' : 'Document unliked',
    });
  });

  app.get('/documents/:id/likes', {
    schema: {
      summary: 'Get likes count for a document',
      tags: ['likes'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                likesCount: { type: 'number' },
                likedByMe: { type: ['boolean', 'null'] },
              },
            },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const params = request.params as DocumentParams;
    const { id } = params;

    let userId: string | undefined;

    try {
      await request.jwtVerify();
      userId = request.user.userId;
    } catch {
      userId = undefined;
    }

    const result = await getLikesCount(id, userId);

    reply.send({
      data: result,
      error: null,
      message: 'OK',
    });
  });
}
