import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createDocumentSchema, updateDocumentSchema, feedQuerySchema } from './documents.zod';
import {
  createDocument,
  updateDocument,
  publishDocument,
  softDeleteDocument,
  getMyDocuments,
  getPublicFeed,
  getPublicDocument,
} from './documents.service';
import { profiles } from '../profiles/profiles.schema';
import { db } from '../../db/index';
import { eq } from 'drizzle-orm';

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

export default async function documentRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: {
      summary: 'Get public document feed',
      tags: ['documents'],
      querystring: {
        type: 'object',
        properties: {
          cursor: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          type: { type: 'string' },
          author: { type: 'string' },
          q: { type: 'string', minLength: 1, maxLength: 100 },
          sort: { type: 'string', enum: ['recent', 'popular'], default: 'recent' },
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
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { cursor?: string; limit?: number; type?: string; author?: string; q?: string; sort?: string } }>, reply: FastifyReply) => {
    const parsed = feedQuerySchema.safeParse(request.query);

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

    const result = await getPublicFeed(parsed.data);

    reply.send({
      data: result,
      error: null,
      message: 'Feed retrieved',
    });
  });

  app.get('/:username/:slug', {
    schema: {
      summary: 'Get a public document by username and slug',
      tags: ['documents'],
      params: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          slug: { type: 'string' },
        },
        required: ['username', 'slug'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { username: string; slug: string } }>, reply: FastifyReply) => {
    const { username, slug } = request.params;
    const document = await getPublicDocument(username, slug);

    reply.send({
      data: document,
      error: null,
      message: 'Document retrieved',
    });
  });

  app.addHook('preHandler', async (request, reply) => {
    await app.authenticate(request, reply);
  });

  app.get('/me', {
    schema: {
      summary: 'Get my documents',
      tags: ['documents'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array' },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { limit?: number; offset?: number } }>, reply: FastifyReply) => {
    const { userId } = request.user;
    const { limit = 20, offset = 0 } = request.query;

    const profileResult = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (profileResult.length === 0) {
      return reply.code(404).send({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Profile not found' },
        message: 'Profile not found',
      });
    }

    const authorId = profileResult[0]!.id;
    const documents = await getMyDocuments(authorId, limit, offset);

    reply.send({
      data: documents,
      error: null,
      message: 'Documents retrieved',
    });
  });

  app.post('/', {
    schema: {
      summary: 'Create a new document',
      tags: ['documents'],
      body: {
        type: 'object',
        required: ['title', 'type'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          abstract: { type: 'string', maxLength: 500 },
          content: { type: 'object' },
          coverImageUrl: { type: 'string', format: 'uri' },
          type: { type: 'string' },
          slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.user;

    const profileResult = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (profileResult.length === 0) {
      return reply.code(404).send({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Profile not found' },
        message: 'Profile not found',
      });
    }

    const authorId = profileResult[0]!.id;
    const parsed = createDocumentSchema.safeParse(request.body);

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

    const document = await createDocument(authorId, parsed.data);

    reply.code(201).send({
      data: document,
      error: null,
      message: 'Document created',
    });
  });

  app.patch('/:id', {
    schema: {
      summary: 'Update a document',
      tags: ['documents'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          abstract: { type: 'string', maxLength: 500 },
          content: { type: 'object' },
          coverImageUrl: { type: 'string', format: 'uri' },
          type: { type: 'string' },
          slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
          typography: { type: 'string', enum: ['sans', 'serif', 'mono'] },
          paperStyle: { type: 'object' },
          paperTexture: { type: 'object' },
          coverSettings: { type: 'object' },
          documentHeader: { type: 'object' },
          documentFooter: { type: 'object' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'object' },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { userId } = request.user;
    const { id } = request.params;

    const profileResult = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (profileResult.length === 0) {
      return reply.code(404).send({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Profile not found' },
        message: 'Profile not found',
      });
    }

    const authorId = profileResult[0]!.id;
    const parsed = updateDocumentSchema.safeParse(request.body);

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

    const document = await updateDocument(authorId, id, parsed.data);

    reply.send({
      data: document,
      error: null,
      message: 'Document updated',
    });
  });

  app.patch('/:id/publish', {
    schema: {
      summary: 'Publish a document',
      tags: ['documents'],
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
            data: { type: 'object' },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { userId } = request.user;
    const { id } = request.params;

    const profileResult = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (profileResult.length === 0) {
      return reply.code(404).send({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Profile not found' },
        message: 'Profile not found',
      });
    }

    const authorId = profileResult[0]!.id;
    const document = await publishDocument(authorId, id);

    reply.send({
      data: document,
      error: null,
      message: 'Document published',
    });
  });

  app.delete('/:id', {
    schema: {
      summary: 'Delete a document',
      tags: ['documents'],
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
            data: { type: 'null' },
            error: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { userId } = request.user;
    const { id } = request.params;

    const profileResult = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (profileResult.length === 0) {
      return reply.code(404).send({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Profile not found' },
        message: 'Profile not found',
      });
    }

    const authorId = profileResult[0]!.id;
    await softDeleteDocument(authorId, id);

    reply.send({
      data: null,
      error: null,
      message: 'Document deleted',
    });
  });
}
