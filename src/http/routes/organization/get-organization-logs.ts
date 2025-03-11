import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'

export async function getOrganizationLogs(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/organizations/:slug/logs',
      {
        schema: {
          tags: ['Logs'],
          summary: 'Retrieve request logs for an organization',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          querystring: z.object({
            page: z.number().min(1).default(1),
            perPage: z.number().min(1).max(100).default(20),
          }),
          response: {
            200: z.object({
              logs: z.array(
                z.object({
                  id: z.string().uuid(),
                  cpf: z.string(),
                  response: z.string(),
                  ipAddress: z.string(),
                  userId: z.string().uuid(),
                  createdAt: z.date(),
                })
              ),
              totalRequests: z.number(),
            }),
          },
        },
      },
      async (request) => {
        const { slug } = request.params
        const { page, perPage } = request.query

        const userId = await request.getCurrentUserId()
        const organization = await prisma.organization.findUnique({
          where: {slug}
        })

        if(!organization){
          throw new NotFoundError()
        }

        await ensureIsAdminOrOwner(userId, organization.id)

        const totalRequests = await prisma.queryLog.count({
          where: { organizationId: organization.id },
        })

        const logs = await prisma.queryLog.findMany({
          where: { organizationId: organization.id },
          select: {
            id: true,
            cpf: true,
            response: true,
            ipAddress: true,
            userId: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * perPage,
          take: perPage,
        })

        return { logs, totalRequests }
      }
    )
}
