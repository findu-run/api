import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'

dayjs.extend(utc)
dayjs.extend(timezone)

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
            }),
          },
        },
      },
      async (request) => {
        const { slug } = request.params
        let { days, ip } = request.query

        if (ip === 'all') {
          ip = undefined
        }

        const userId = await request.getCurrentUserId()

        const organization = await prisma.organization.findUnique({
          where: { slug },
        })

        if (!organization) {
          throw new NotFoundError()
        }

        await ensureIsAdminOrOwner(userId, organization.id)

        const startDate = dayjs().subtract(days, 'days').startOf('day').toDate()
        const isHourly = days === 1
        const timeFormat = isHourly ? 'YYYY-MM-DD HH24:00' : 'YYYY-MM-DD'

        // 👇 SQL construído dinamicamente e com segurança
        let query = `
          SELECT
            ip_address AS "ipAddress",
            to_char(created_at AT TIME ZONE 'America/Sao_Paulo', '${timeFormat}') AS date,
            COUNT(*) FILTER (WHERE status = 'SUCCESS') AS success,
            COUNT(*) FILTER (WHERE status != 'SUCCESS') AS failed
          FROM query_log
          WHERE organization_id = $1
            AND created_at >= $2
        `

        const params: any[] = [organization.id, startDate]

        if (ip) {
          query += ' AND ip_address = $3'
          params.push(ip)
        }

        query += ' GROUP BY ip_address, date ORDER BY date DESC'

        type AggregatedMetric = {
          ipAddress: string
          date: string
          success: number
          failed: number
        }

        const data = await prisma.$queryRawUnsafe<AggregatedMetric[]>(
          query,
          ...params,
        )

        return { data }
      },
    )
}
