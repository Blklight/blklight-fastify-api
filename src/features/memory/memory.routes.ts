import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { semanticSearch, getRelated, getDigest } from './memory.service';
import { searchQuerySchema, relatedParamsSchema } from './memory.zod';
import { requireFeature } from '../../config/features';

export default async function memoryRoutes(app: FastifyInstance) {
  app.get('/memory/search', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: {
      summary: 'Semantic search across indexed content',
      tags: ['memory'],
      querystring: searchQuerySchema,
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    requireFeature('memory');

    const parsed = searchQuerySchema.safeParse(request.query);
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

    const userId = request.user.userId;
    const results = await semanticSearch(userId, parsed.data.q, parsed.data.limit);

    reply.send({
      data: results,
      error: null,
      message: 'Search completed successfully',
    });
  });

  app.get('/memory/related/:sourceType/:sourceId', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: {
      summary: 'Get related items for a specific content piece',
      tags: ['memory'],
      params: relatedParamsSchema,
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 5 },
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    requireFeature('memory');

    const paramsParsed = relatedParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.code(400).send({
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid params',
        },
        message: 'Validation failed',
      });
    }

    const userId = request.user.userId;
    const limit = (request.query as { limit?: number }).limit ?? 5;

    const results = await getRelated(userId, paramsParsed.data.sourceType, paramsParsed.data.sourceId, limit);

    reply.send({
      data: results,
      error: null,
      message: 'Related items retrieved successfully',
    });
  });

  app.get('/memory/digest', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: {
      summary: 'Get weekly connections digest',
      tags: ['memory'],
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    requireFeature('memory');

    const userId = request.user.userId;
    const results = await getDigest(userId);

    reply.send({
      data: results,
      error: null,
      message: 'Digest retrieved successfully',
    });
  });
}