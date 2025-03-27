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
              billing: z
                .object({
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
                })
                .nullable(),
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
          return {
            billing: null,
          }
        }

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

        const extraIpsAmount = extraIps?.amount || 0
        const extraRequestsAmount = extraRequests?.amount || 0
        const earlyIpChangesAmount = earlyIpChanges?.amount || 0

        const extraIpsUnitPrice = extraIps?.price || 0
        const extraRequestsUnitPrice = extraRequests?.price || 0
        const earlyIpChangesUnitPrice = earlyIpChanges?.price || 0

        const extraIpsPrice = extraIpsAmount * extraIpsUnitPrice
        const extraRequestsPrice = extraRequestsAmount * extraRequestsUnitPrice
        const earlyIpChangesPrice =
          earlyIpChangesAmount * earlyIpChangesUnitPrice

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
              unit: extraIpsUnitPrice,
              price: extraIpsPrice,
            },
            extraRequests: {
              amount: extraRequestsAmount,
              unit: extraRequestsUnitPrice,
              price: extraRequestsPrice,
            },
            earlyIpChanges: {
              amount: earlyIpChangesAmount,
              unit: earlyIpChangesUnitPrice,
              price: earlyIpChangesPrice,
            },
            total,
          },
        }
      },
    )
}
