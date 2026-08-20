import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { listApps, getUserApps, activateApps, deactivateApp } from './platform-apps.service';
import { activateAppsSchema } from './platform-apps.zod';
import { resolveProfileIdFromUserId } from '../../utils/profile';

export default async function platformAppsRoutes(app: FastifyInstance) {
  app.get('/platform-apps', {
    schema: {
      summary: 'List all available platform apps',
      tags: ['platform-apps'],
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
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const apps = await listApps();

    reply.send({
      data: apps,
      error: null,
      message: 'Apps retrieved successfully',
    });
  });

  app.get('/platform-apps/me', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: {
      summary: 'List apps activated by current user',
      tags: ['platform-apps'],
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
    const profileId = await resolveProfileIdFromUserId(request.user.userId);
    const userAppsList = await getUserApps(profileId);

    reply.send({
      data: userAppsList,
      error: null,
      message: 'User apps retrieved successfully',
    });
  });

  app.post('/platform-apps/me', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: {
      summary: 'Activate apps for current user',
      tags: ['platform-apps'],
      body: {
        type: 'object',
        properties: {
          apps: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
          },
        },
        required: ['apps'],
        additionalProperties: false,
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const profileId = await resolveProfileIdFromUserId(request.user.userId);
    const parsed = activateAppsSchema.safeParse(request.body);

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

    await activateApps(profileId, parsed.data.apps);

    reply.send({
      data: null,
      error: null,
      message: 'Apps activated successfully',
    });
  });

  app.delete('/platform-apps/me/:appId', {
    preHandler: [(request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply)],
    schema: {
      summary: 'Deactivate an app',
      tags: ['platform-apps'],
      params: {
        type: 'object',
        properties: {
          appId: { type: 'string' },
        },
        required: ['appId'],
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const profileId = await resolveProfileIdFromUserId(request.user.userId);
    const { appId } = request.params as { appId: string };

    try {
      await deactivateApp(profileId, appId);
    } catch (err) {
      return reply.code(404).send({
        data: null,
        error: { code: 'NOT_FOUND', message: (err as Error).message },
        message: 'App not found',
      });
    }

    reply.send({
      data: null,
      error: null,
      message: 'App deactivated successfully',
    });
  });
}
