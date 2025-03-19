import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import dayjs from 'dayjs'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'

export async function getOrganizationMetrics(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/organizations/:slug/metrics',
      {
        schema: {
          tags: ['Metrics'],
          summary: 'Retrieve request metrics for an organization',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          querystring: z.object({
            days: z.coerce.number().min(1).max(30).default(7), // 📅 Quantidade de dias para análise
          }),
          response: {
            200: z.object({
              totalRequests: z.number(), // 🔥 Total de consultas no período
              successfulRequests: z.number(), // ✅ Total de consultas bem-sucedidas
              failedRequests: z.number(), // ❌ Total de consultas malsucedidas
              requestsByType: z.array(
                z.object({
                  queryType: z.string(), // 🔍 CPF, CNPJ, Placa...
                  count: z.number(),
                })
              ),
              dailyRequests: z.array(
                z.object({
                  date: z.string(), // 📅 Data da consulta
                  count: z.number(), // 📊 Quantidade de consultas no dia
                })
              ),
            }),
          },
        },
      },
      async (request) => {
        const { slug } = request.params
        const { days } = request.query

        const userId = await request.getCurrentUserId()
        const organization = await prisma.organization.findUnique({
          where: { slug },
        })

        if (!organization) {
          throw new NotFoundError('Organization not found.')
        }

        await ensureIsAdminOrOwner(userId, organization.id)

        const startDate = dayjs().subtract(days, 'days').startOf('day').toDate()

        // 📌 Consultas totais no período
        const totalRequests = await prisma.queryLog.count({
          where: {
            organizationId: organization.id,
            createdAt: { gte: startDate },
          },
        })

        // ✅ Consultas bem-sucedidas
        const successfulRequests = await prisma.queryLog.count({
          where: {
            organizationId: organization.id,
            createdAt: { gte: startDate },
            status: 'SUCCESS',
          },
        })

        // ❌ Consultas malsucedidas
        const failedRequests = totalRequests - successfulRequests

        // 🔍 Consultas agrupadas por tipo (CPF, CNPJ, Placa...)
        const requestsByType = await prisma.queryLog.groupBy({
          by: ['queryType'],
          where: {
            organizationId: organization.id,
            createdAt: { gte: startDate },
          },
          _count: { id: true },
        })

        // 📊 Consultas diárias no período
        const dailyRequestsRaw = await prisma.queryLog.groupBy({
          by: ['createdAt'],
          where: {
            organizationId: organization.id,
            createdAt: { gte: startDate },
          },
          _count: { id: true },
        })

        // 🔥 Formatando dados diários
        const dailyRequests = dailyRequestsRaw.map(log => ({
          date: dayjs(log.createdAt).format('YYYY-MM-DD'),
          count: log._count.id,
        }))

        return {
          totalRequests,
          successfulRequests,
          failedRequests,
          requestsByType: requestsByType.map(entry => ({
            queryType: entry.queryType,
            count: entry._count.id,
          })),
          dailyRequests,
        }
      }
    )
}
