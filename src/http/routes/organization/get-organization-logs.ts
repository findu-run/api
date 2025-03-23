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
            page: z.coerce.number().min(1).default(1),
            perPage: z.coerce.number().min(1).max(100).default(20),
            searchTerm: z.string().optional(),
          }),          
          response: {
            200: z.object({
              logs: z.array(
                z.object({
                  id: z.string().uuid(),
                  status: z.string(), // 🔥 Adicionamos status para análise de sucesso/falha
                  queryType: z.string(), // 🔥 Agora identifica qual tipo de consulta foi feita
                  ipAddress: z.string(),
                  createdAt: z.coerce.date(),
                })
              ),
              totalRequests: z.number(),
              totalPages: z.number(), // ✅ aqui também

            }),
          },
        },
      },
      async (request) => {
        const { slug } = request.params
        const { page, perPage, searchTerm } = request.query

        const userId = await request.getCurrentUserId()
        const organization = await prisma.organization.findUnique({
          where: { slug },
        })

        if (!organization) {
          throw new NotFoundError('Organization not found.')
        }

        await ensureIsAdminOrOwner(userId, organization.id)

        const where = {
          organizationId: organization.id,
          ...(searchTerm && {
            OR: [
              {
                ipAddress: {
                  contains: searchTerm,
                },
              },
              {
                queryType: {
                  contains: searchTerm,
                },
              },
              {
                status: {
                  contains: searchTerm,
                },
              },
            ],
          }),
        }
        
        const totalRequests = await prisma.queryLog.count({ where })
        
        const logs = await prisma.queryLog.findMany({
          where,
          select: {
            id: true,
            status: true,
            queryType: true,
            ipAddress: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * perPage,
          take: perPage,
        })

        return {
          logs,
          totalRequests,
          totalPages: Math.ceil(totalRequests / perPage),
        }
      }
    )
}
