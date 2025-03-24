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

// Extende os plugins do dayjs
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
        const { days, ip } = request.query

        const userId = await request.getCurrentUserId()

        const organization = await prisma.organization.findUnique({
          where: { slug },
        })

        if (!organization) {
          throw new NotFoundError()
        }

        await ensureIsAdminOrOwner(userId, organization.id)

        const startDate = dayjs()
          .tz('America/Sao_Paulo')
          .subtract(days, 'days')
          .startOf('day')
          .toDate()

        const isHourly = days === 1

        const logs = await prisma.queryLog.findMany({
          where: {
            organizationId: organization.id,
            createdAt: { gte: startDate },
            ...(ip ? { ipAddress: ip } : {}),
          },
          select: {
            ipAddress: true,
            createdAt: true,
            status: true,
          },
        })

        const timeFormat = isHourly ? 'YYYY-MM-DD HH:00' : 'YYYY-MM-DD'
        const grouped = new Map<
          string,
          { ipAddress: string; date: string; success: number; failed: number }
        >()

        for (const log of logs) {
          const date = dayjs(log.createdAt)
            .tz('America/Sao_Paulo')
            .format(timeFormat)
          const key = `${log.ipAddress}-${date}`

          if (!grouped.has(key)) {
            grouped.set(key, {
              ipAddress: log.ipAddress,
              date,
              success: 0,
              failed: 0,
            })
          }

          const entry = grouped.get(key)!
          if (log.status === 'SUCCESS') {
            entry.success += 1
          } else {
            entry.failed += 1
          }
        }

        return {
          data: Array.from(grouped.values()),
        }
      },
    )
}
