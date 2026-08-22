import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { listApps, getUserApps, activateApps, deactivateApp, createApp, updateApp, createInvite, listInvites } from './platform-apps.service';
import { activateAppsSchema, createAppSchema, updateAppSchema, createInviteSchema } from './platform-apps.zod';
import { resolveProfileIdFromUserId } from '../../utils/profile';
import { requireAdmin } from '../../hooks/admin-guard';

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
      security: [{ bearerAuth: [] }],
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
      security: [{ bearerAuth: [] }],
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
      security: [{ bearerAuth: [] }],
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

  app.post('/platform-apps', {
    preHandler: [
      (request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply),
      requireAdmin,
    ],
    schema: {
      summary: 'Create a new platform app (admin only)',
      tags: ['platform-apps'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          slug: { type: 'string', minLength: 1, maxLength: 50 },
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 500 },
          accessMode: { type: 'string', enum: ['open', 'beta'] },
          iconUrl: { type: 'string' },
          tagline: { type: 'string', maxLength: 200 },
          category: { type: 'string', maxLength: 100 },
        },
        required: ['slug', 'name'],
        additionalProperties: false,
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = createAppSchema.safeParse(request.body);

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

    const appCreated = await createApp(parsed.data);

    reply.code(201).send({
      data: appCreated,
      error: null,
      message: 'App created successfully',
    });
  });

  app.patch('/platform-apps/:id', {
    preHandler: [
      (request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply),
      requireAdmin,
    ],
    schema: {
      summary: 'Update a platform app (admin only)',
      tags: ['platform-apps'],
      security: [{ bearerAuth: [] }],
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
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string', maxLength: 500 },
          accessMode: { type: 'string', enum: ['open', 'beta'] },
          iconUrl: { type: 'string' },
          tagline: { type: 'string', maxLength: 200 },
          category: { type: 'string', maxLength: 100 },
          isActive: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parsed = updateAppSchema.safeParse(request.body);

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

    const appUpdated = await updateApp(id, parsed.data);

    reply.send({
      data: appUpdated,
      error: null,
      message: 'App updated successfully',
    });
  });

  app.post('/platform-apps/:appId/invites', {
    preHandler: [
      (request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply),
      requireAdmin,
    ],
    schema: {
      summary: 'Authorize a profile for a beta app (admin only)',
      tags: ['platform-apps'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          appId: { type: 'string' },
        },
        required: ['appId'],
      },
      body: {
        type: 'object',
        properties: {
          profileId: { type: 'string', minLength: 1 },
        },
        required: ['profileId'],
        additionalProperties: false,
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { appId } = request.params as { appId: string };
    const parsed = createInviteSchema.safeParse(request.body);

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

    const callerProfileId = await resolveProfileIdFromUserId(request.user.userId);
    const invite = await createInvite(appId, parsed.data.profileId, callerProfileId);

    reply.code(201).send({
      data: invite,
      error: null,
      message: 'Invite created successfully',
    });
  });

  app.get('/platform-apps/:appId/invites', {
    preHandler: [
      (request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply),
      requireAdmin,
    ],
    schema: {
      summary: 'List invites for a beta app (admin only)',
      tags: ['platform-apps'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          appId: { type: 'string' },
        },
        required: ['appId'],
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { appId } = request.params as { appId: string };
    const invites = await listInvites(appId);

    reply.send({
      data: invites,
      error: null,
      message: 'Invites retrieved successfully',
    });
  });
}
