import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getAdminOverview } from './admin.service';
import { requireAdmin } from '../../hooks/admin-guard';

export default async function adminRoutes(app: FastifyInstance) {
  app.get('/admin/overview', {
    preHandler: [
      (request: FastifyRequest, reply: FastifyReply) => app.authenticate(request, reply),
      requireAdmin,
    ],
    schema: {
      summary: 'Admin dashboard overview (admin only)',
      tags: ['admin'],
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const overview = await getAdminOverview();

    reply.send({
      data: overview,
      error: null,
      message: 'Overview retrieved successfully',
    });
  });
}
