import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { toggleBookmark, getMyBookmarks } from './bookmarks.service';

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

const bookmarkQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20).optional(),
});

export default async function bookmarksRoutes(app: FastifyInstance) {
  app.post('/documents/:id/bookmark', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: {
      summary: 'Toggle bookmark on a document',
      tags: ['bookmarks'],
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
                bookmarked: { type: 'boolean' },
              },
            },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId } = request.user;

    const result = await toggleBookmark(userId, id);

    reply.send({
      data: result,
      error: null,
      message: result.bookmarked ? 'Bookmark added' : 'Bookmark removed',
    });
  });

  app.get('/bookmarks/me', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: {
      summary: 'Get my bookmarks',
      tags: ['bookmarks'],
      querystring: {
        type: 'object',
        properties: {
          cursor: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                items: { type: 'array' },
                nextCursor: { type: ['string', 'null'] },
                total: { type: 'number' },
              },
            },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            data: { type: 'null' },
            error: { type: 'object' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { userId } = request.user;
    const parsed = bookmarkQuerySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          fields: Object.fromEntries(
            parsed.error.issues.map((i) => [i.path.join('.'), i.message])
          ),
        },
        message: 'Validation failed',
      });
    }

    const result = await getMyBookmarks(userId, parsed.data);

    reply.send({
      data: result,
      error: null,
      message: 'Bookmarks retrieved',
    });
  });
}
