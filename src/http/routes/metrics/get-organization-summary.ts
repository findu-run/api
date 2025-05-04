import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

import { prisma } from '@/lib/prisma'
import { authWithBilling } from '@/http/middlewares/auth-with-billing'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { convertToBrazilTime } from '@/utils/convert-to-brazil-time'
import { Prisma } from '@prisma/client'

export async function getOrganizationSummary(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(authWithBilling)
    .get(
      '/organizations/:slug/summary',
      {
        schema: {
          tags: ['Dashboard'],
          summary: 'Get consolidated dashboard summary',
          security: [{ bearerAuth: [] }],
          params: z.object({ slug: z.string() }),
          querystring: z.object({
            days: z.coerce.number().min(1).max(30).default(7),
          }),
          response: {
            200: z.object({
              billing: z.any(),
              metrics: z.any(),
              requestLimit: z.any(),
              meta: z.object({
                queryTimeMs: z.number(),
                totalExecutionTimeMs: z.number(),
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
        if (!organization) throw new NotFoundError()
        await ensureIsAdminOrOwner(userId, organization.id)

        const startDate = convertToBrazilTime(new Date())
          .subtract(days, 'days')
          .startOf('day')
          .toDate()

        const [
          totalRequests,
          successfulRequests,
          requestsByTypeRaw,
          dailyRequestsRaw,
        ] = await Promise.all([
          prisma.queryLog.count({
            where: {
              organizationId: organization.id,
              createdAt: { gte: startDate },
            },
          }),

          prisma.queryLog.count({
            where: {
              organizationId: organization.id,
              createdAt: { gte: startDate },
              status: 'SUCCESS',
            },
          }),

          prisma.queryLog.groupBy({
            by: ['queryType'],
            where: {
              organizationId: organization.id,
              createdAt: { gte: startDate },
            },
            _count: { _all: true },
          }),

          prisma.$queryRaw<{ date: string; count: number }[]>(
            Prisma.sql`
              SELECT DATE_TRUNC('day', "created_at")::date as date, COUNT(*)::int as count
              FROM "query_logs"
              WHERE "organizationId" = ${organization.id}
              AND "created_at" >= ${startDate}
              GROUP BY 1
              ORDER BY 1 ASC
            `,
          ),
        ])

        const failedRequests = totalRequests - successfulRequests

        const requestsByType = requestsByTypeRaw.map((r) => ({
          queryType: r.queryType ?? 'Desconhecido',
          count: r._count._all,
        }))

        const dailyRequests = dailyRequestsRaw.map((r) => ({
          date: dayjs(r.date).tz('America/Sao_Paulo').format('YYYY-MM-DD'),
          count: r.count,
        }))

        const successRate =
          totalRequests > 0
            ? Math.round((successfulRequests / totalRequests) * 100)
            : 0

        const topQueryType =
          requestsByType.sort((a, b) => b.count - a.count)[0]?.queryType || '—'

        const startOfMonth = dayjs().startOf('month').toDate()
        const requestsMade = await prisma.queryLog.count({
          where: {
            organizationId: organization.id,
            createdAt: { gte: startOfMonth },
          },
        })

        const subscription = await prisma.subscription.findUnique({
          where: { organizationId: organization.id },
          select: {
            status: true,
            plan: { select: { maxRequests: true, name: true, price: true } },
          },
        })

        const requestLimit = subscription?.plan?.maxRequests || 0
        const remainingRequests = Math.max(requestLimit - requestsMade, 0)

        const [extraIps, extraRequests, earlyIpChanges] = await Promise.all([
          prisma.addon.findFirst({
            where: { organizationId: organization.id, type: 'EXTRA_IP' },
            select: { amount: true, price: true },
          }),
          prisma.addon.findFirst({
            where: { organizationId: organization.id, type: 'EXTRA_REQUESTS' },
            select: { amount: true, price: true },
          }),
          prisma.addon.findFirst({
            where: { organizationId: organization.id, type: 'EARLY_IP_CHANGE' },
            select: { amount: true, price: true },
          }),
        ])

        const totalBilling =
          (subscription?.plan?.price || 0) +
          (extraIps?.amount || 0) * (extraIps?.price || 0) +
          (extraRequests?.amount || 0) * (extraRequests?.price || 0) +
          (earlyIpChanges?.amount || 0) * (earlyIpChanges?.price || 0)

        const totalEnd = process.hrtime(totalStart)
        const queryTimeMs = totalEnd[0] * 1000 + totalEnd[1] / 1_000_000

        return {
          billing: {
            plan: {
              type: subscription?.plan?.name || '',
              price: subscription?.plan?.price || 0,
            },
            extraIps: {
              amount: extraIps?.amount || 0,
              unit: extraIps?.price || 0,
              price: (extraIps?.amount || 0) * (extraIps?.price || 0),
            },
            extraRequests: {
              amount: extraRequests?.amount || 0,
              unit: extraRequests?.price || 0,
              price: (extraRequests?.amount || 0) * (extraRequests?.price || 0),
            },
            earlyIpChanges: {
              amount: earlyIpChanges?.amount || 0,
              unit: earlyIpChanges?.price || 0,
              price:
                (earlyIpChanges?.amount || 0) * (earlyIpChanges?.price || 0),
            },
            total: totalBilling,
          },
          metrics: {
            totalRequests,
            successfulRequests,
            failedRequests,
            requestsByType,
            dailyRequests,
            successRate,
            topQueryType,
          },
          requestLimit: {
            requestLimit,
            remainingRequests,
            reached: remainingRequests <= 0,
          },
          meta: {
            queryTimeMs,
            totalExecutionTimeMs: queryTimeMs,
            logCount: totalRequests,
          },
        }
      },
    )
}
