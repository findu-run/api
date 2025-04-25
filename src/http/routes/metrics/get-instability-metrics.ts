import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { convertToBrazilTime } from '@/utils/convert-to-brazil-time'

export async function getInstabilityMetrics(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/organizations/:slug/metrics/instability',
      {
        schema: {
          tags: ['Metrics'],
          summary: 'Get instability metrics grouped by time',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          querystring: z.object({
            days: z.coerce.number().min(1).max(90).default(30),
            monitor: z.string().optional(),
          }),
          response: {
            200: z.object({
              data: z.array(
                z.object({
                  date: z.string(),
                  up: z.number(),
                  down: z.number(),
                  unstable: z.number(),
                }),
              ),
              meta: z.object({
                totalExecutionTimeMs: z.number(),
                queryTimeMs: z.number(),
                eventCount: z.number(),
              }),
            }),
          },
        },
      },
      async (request) => {
        const totalStart = process.hrtime()

        const { slug } = request.params
        const { days, monitor } = request.query

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
        const timeFormat = isHourly ? 'YYYY-MM-DD HH:00' : 'YYYY-MM-DD'

        const queryStart = process.hrtime()

        const events = await prisma.monitoringEvent.findMany({
          where: {
            detectedAt: { gte: startDate },
            organizationId: organization.id,
            ...(monitor ? { name: monitor } : {}),
          },
          select: {
            detectedAt: true,
            status: true,
          },
        })

        const queryEnd = process.hrtime(queryStart)
        const totalEnd = process.hrtime(totalStart)

        const queryTimeMs = queryEnd[0] * 1000 + queryEnd[1] / 1_000_000
        const totalExecutionTimeMs =
          totalEnd[0] * 1000 + totalEnd[1] / 1_000_000

        const grouped = new Map<
          string,
          { date: string; up: number; down: number; unstable: number }
        >()

        for (const event of events) {
          const date = convertToBrazilTime(event.detectedAt).format(timeFormat)

          if (!grouped.has(date)) {
            grouped.set(date, {
              date,
              up: 0,
              down: 0,
              unstable: 0,
            })
          }

          const entry = grouped.get(date)!

          if (event.status === 0) entry.down += 1
          else if (event.status === 1) entry.up += 1
          else if (event.status === 2) entry.unstable += 1
        }

        return {
          data: Array.from(grouped.values()),
          meta: {
            totalExecutionTimeMs,
            queryTimeMs,
            eventCount: events.length,
          },
        }
      },
    )
}
