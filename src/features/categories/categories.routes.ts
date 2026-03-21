import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategories,
  getCategoryBySlug,
} from './categories.service';
import { ValidationError } from '../../utils/errors';

const createCategorySchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(200).nullable().optional(),
  parentId: z.string().cuid2().nullable().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).nullable().optional(),
  parentId: z.string().cuid2().nullable().optional(),
});

export default async function categoryRoutes(app: FastifyInstance) {
  app.get('/', {
    schema: {
      summary: 'Get all categories',
      tags: ['categories'],
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
    const categories = await getAllCategories();

    reply.send({
      data: categories,
      error: null,
      message: 'Categories retrieved',
    });
  });

  app.get('/:slug', {
    schema: {
      summary: 'Get a category by slug',
      tags: ['categories'],
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
        },
        required: ['slug'],
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
  }, async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
    const { slug } = request.params;
    const category = await getCategoryBySlug(slug);

    if (!category) {
      return reply.code(404).send({
        data: null,
        error: { code: 'NOT_FOUND', message: 'Category not found' },
        message: 'Category not found',
      });
    }

    reply.send({
      data: category,
      error: null,
      message: 'Category retrieved',
    });
  });

  app.post('/', {
    schema: {
      summary: 'Create a category (admin only)',
      tags: ['categories'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 50 },
          description: { type: 'string', maxLength: 200 },
          parentId: { type: 'string' },
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
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, role } = request.user;

    if (role !== 'admin') {
      return reply.code(403).send({
        data: null,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
        message: 'Forbidden',
      });
    }

    const parsed = createCategorySchema.safeParse(request.body);

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

    const category = await createCategory(
      parsed.data.name,
      parsed.data.description,
      parsed.data.parentId
    );

    reply.code(201).send({
      data: category,
      error: null,
      message: 'Category created',
    });
  });

  app.patch('/:id', {
    schema: {
      summary: 'Update a category (admin only)',
      tags: ['categories'],
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
          name: { type: 'string', minLength: 1, maxLength: 50 },
          description: { type: 'string', maxLength: 200 },
          parentId: { type: 'string' },
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
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { role } = request.user;

    if (role !== 'admin') {
      return reply.code(403).send({
        data: null,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
        message: 'Forbidden',
      });
    }

    const { id } = request.params;
    const parsed = updateCategorySchema.safeParse(request.body);

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

    const category = await updateCategory(id, parsed.data);

    reply.send({
      data: category,
      error: null,
      message: 'Category updated',
    });
  });

  app.delete('/:id', {
    schema: {
      summary: 'Delete a category (admin only)',
      tags: ['categories'],
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
    const { role } = request.user;

    if (role !== 'admin') {
      return reply.code(403).send({
        data: null,
        error: { code: 'FORBIDDEN', message: 'Admin access required' },
        message: 'Forbidden',
      });
    }

    const { id } = request.params;
    await deleteCategory(id);

    reply.send({
      data: null,
      error: null,
      message: 'Category deleted',
    });
  });
}
