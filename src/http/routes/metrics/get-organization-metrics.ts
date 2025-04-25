import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/http/middlewares/auth'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { convertToBrazilTime } from '@/utils/convert-to-brazil-time'

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
            days: z.coerce.number().min(1).max(30).default(7),
          }),
          response: {
            200: z.object({
              totalRequests: z.number(),
              successfulRequests: z.number(),
              failedRequests: z.number(),
              requestsByType: z.array(
                z.object({
                  queryType: z.string(),
                  count: z.number(),
                }),
              ),
              dailyRequests: z.array(
                z.object({
                  date: z.string(),
                  count: z.number(),
                }),
              ),
              meta: z.object({
                totalExecutionTimeMs: z.number(),
                queryTimeMs: z.number(),
                logCount: z.number(),
              }),
            }),
          },
        },
      },
      async (request) => {
        const totalStart = process.hrtime()

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

        const startDate = convertToBrazilTime(new Date())
          .subtract(days, 'days')
          .startOf('day')
          .toDate()

        const queryStart = process.hrtime()

        const results = await prisma.$queryRawUnsafe<
          Array<{
            metric: string
            value: number
            extra?: string
          }>
        >(
          `
          SELECT 'total' AS metric, COUNT(*)::int AS value FROM query_logs
          WHERE "organizationId" = $1 AND created_at >= $2
          UNION ALL
          SELECT 'success' AS metric, COUNT(*)::int FROM query_logs
          WHERE "organizationId" = $1 AND created_at >= $2 AND status = 'SUCCESS'
          UNION ALL
          SELECT 'type' AS metric, COUNT(*)::int, query_type AS extra FROM query_logs
          WHERE "organizationId" = $1 AND created_at >= $2
          GROUP BY query_type
          UNION ALL
          SELECT 'daily' AS metric, COUNT(*)::int, TO_CHAR(DATE_TRUNC('day', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'), 'YYYY-MM-DD') AS extra
          FROM query_logs
          WHERE "organizationId" = $1 AND created_at >= $2
          GROUP BY DATE_TRUNC('day', created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')
          ORDER BY metric, extra
          `,
          organization.id,
          startDate,
        )

        const queryEnd = process.hrtime(queryStart)
        const totalEnd = process.hrtime(totalStart)

        const queryTimeMs = queryEnd[0] * 1000 + queryEnd[1] / 1_000_000
        const totalExecutionTimeMs =
          totalEnd[0] * 1000 + totalEnd[1] / 1_000_000

        let total = 0
        let success = 0
        const requestsByType: { queryType: string; count: number }[] = []
        const dailyRequests: { date: string; count: number }[] = []

        for (const row of results) {
          if (row.metric === 'total') total = row.value
          else if (row.metric === 'success') success = row.value
          else if (row.metric === 'type' && row.extra)
            requestsByType.push({ queryType: row.extra, count: row.value })
          else if (row.metric === 'daily' && row.extra)
            dailyRequests.push({ date: row.extra, count: row.value })
        }

        return {
          totalRequests: total,
          successfulRequests: success,
          failedRequests: total - success,
          requestsByType,
          dailyRequests,
          meta: {
            totalExecutionTimeMs,
            queryTimeMs,
            logCount: total,
          },
        }
      },
    )
}
