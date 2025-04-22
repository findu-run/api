import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auth } from '@/http/middlewares/auth'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { convertToBrazilTime } from '@/utils/convert-to-brazil-time'

export async function getIpMetrics(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/organizations/:slug/metrics/by-ip',
      {
        schema: {
          tags: ['Metrics'],
          summary: 'Get request metrics grouped by IP and time',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          querystring: z.object({
            days: z.coerce.number().min(1).max(90).default(30),
            ip: z.string().optional(),
          }),
          response: {
            200: z.object({
              data: z.array(
                z.object({
                  ipAddress: z.string(),
                  date: z.string(),
                  success: z.number(),
                  failed: z.number(),
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
        const { slug } = request.params
        const { days, ip } = request.query

        const userId = await request.getCurrentUserId()

        const organization = await prisma.organization.findUnique({
          where: { slug },
        })

        if (!organization) {
          throw new NotFoundError()
        }

        await ensureIsAdminOrOwner(userId, organization.id)

        const startDate = convertToBrazilTime(new Date())
          .subtract(days, 'days')
          .startOf('day')
          .toDate()

        const isHourly = days === 1

        // Medir tempo total
        const totalStart = process.hrtime()

        // Definir o intervalo de truncamento
        const interval = isHourly ? 'hour' : 'day'

        // Query SQL para agregar os dados
        const logs = await prisma.$queryRawUnsafe<
          Array<{
            ipAddress: string
            date: string
            success: number
            failed: number
          }>
        >(
          `
        SELECT
          ip_address AS "ipAddress",
          TO_CHAR(
            DATE_TRUNC($1, created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'),
            $2
          ) AS date,
          COUNT(*) FILTER (WHERE status = 'SUCCESS')::INTEGER AS success,
          COUNT(*) FILTER (WHERE status != 'SUCCESS')::INTEGER AS failed
        FROM query_logs
        WHERE organization_id = $3::uuid -- 👈 aqui está o cast
          AND created_at >= $4
          ${ip ? 'AND ip_address = $5' : ''}
        GROUP BY ip_address, DATE_TRUNC($1, created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')
        ORDER BY date, ip_address
        `,
          interval,
          isHourly ? 'YYYY-MM-DD HH24:00' : 'YYYY-MM-DD',
          organization.id,
          startDate,
          ...(ip ? [ip] : []),
        )

        const queryEnd = process.hrtime(totalStart)

        // Calcular tempos em milissegundos
        const queryTimeMs = queryEnd[0] * 1000 + queryEnd[1] / 1_000_000
        const totalExecutionTimeMs = queryTimeMs

        // Contar o número total de logs
        const logCount = logs.reduce(
          (acc, log) => acc + log.success + log.failed,
          0,
        )

        return {
          data: logs,
          meta: {
            totalExecutionTimeMs,
            queryTimeMs,
            logCount,
          },
        }
      },
    )
}
