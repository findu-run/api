import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { authWithBilling } from '@/http/middlewares/auth-with-billing'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'

export async function getOrganizationBilling(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(authWithBilling)
    .get(
      '/organizations/:slug/billing/complete',
      {
        schema: {
          tags: ['Billing'],
          summary: 'Get billing information for an organization',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          response: {
            200: z.object({
              billing: z.object({
                plan: z.object({
                  type: z.string(),
                  price: z.number(),
                }),
                extraIps: z.object({
                  amount: z.number(),
                  unit: z.number(),
                  price: z.number(),
                }),
                extraRequests: z.object({
                  amount: z.number(),
                  unit: z.number(),
                  price: z.number(),
                }),
                earlyIpChanges: z.object({
                  amount: z.number(),
                  unit: z.number(),
                  price: z.number(),
                }),
                total: z.number(),
              }),
            }),
          },
        },
      },
      async (request) => {
        const { slug } = request.params
        const userId = await request.getCurrentUserId()

        const organization = await prisma.organization.findUnique({
          where: { slug },
        })

        if (!organization) {
          throw new NotFoundError()
        }

        await ensureIsAdminOrOwner(userId, organization.id)

        const subscription = await prisma.subscription.findUnique({
          where: { organizationId: organization.id },
          select: {
            plan: {
              select: {
                name: true,
                price: true,
              },
            },
          },
        })

        if (!subscription) {
          throw new Error('Organization does not have an active subscription.')
        }

        const [extraIps, extraRequests, earlyIpChanges] = await Promise.all([
          prisma.addon.findFirst({
            where: { organizationId: organization.id, type: 'EXTRA_IP' },
            select: { amount: true },
          }),
          prisma.addon.findFirst({
            where: { organizationId: organization.id, type: 'EXTRA_REQUESTS' },
            select: { amount: true },
          }),
          prisma.addon.findFirst({
            where: { organizationId: organization.id, type: 'EARLY_IP_CHANGE' },
            select: { amount: true },
          }),
        ])

        const PRICES = {
          EXTRA_IP: 10,
          EXTRA_REQUESTS: 0.002,
          EARLY_IP_CHANGE: 5,
        }

        const extraIpsAmount = extraIps?.amount || 0
        const extraRequestsAmount = extraRequests?.amount || 0
        const earlyIpChangesAmount = earlyIpChanges?.amount || 0

        const extraIpsPrice = extraIpsAmount * PRICES.EXTRA_IP
        const extraRequestsPrice = extraRequestsAmount * PRICES.EXTRA_REQUESTS
        const earlyIpChangesPrice =
          earlyIpChangesAmount * PRICES.EARLY_IP_CHANGE

        const total =
          subscription.plan.price +
          extraIpsPrice +
          extraRequestsPrice +
          earlyIpChangesPrice

        return {
          billing: {
            plan: {
              type: subscription.plan.name,
              price: subscription.plan.price,
            },
            extraIps: {
              amount: extraIpsAmount,
              unit: PRICES.EXTRA_IP,
              price: extraIpsPrice,
            },
            extraRequests: {
              amount: extraRequestsAmount,
              unit: PRICES.EXTRA_REQUESTS,
              price: extraRequestsPrice,
            },
            earlyIpChanges: {
              amount: earlyIpChangesAmount,
              unit: PRICES.EARLY_IP_CHANGE,
              price: earlyIpChangesPrice,
            },
            total,
          },
        }
      },
    )
}
