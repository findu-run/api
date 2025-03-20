import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'

export async function getOrganizationBilling(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
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
        await ensureIsAdminOrOwner(userId, organization.id)

        // 🔥 Buscar detalhes do plano
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

        // 🔥 Buscar addons extras comprados pela organização
        const extraIps = await prisma.addon.findFirst({
          where: { organizationId: organization.id, type: 'EXTRA_IP' },
          select: { amount: true },
        })

        const extraRequests = await prisma.addon.findFirst({
          where: { organizationId: organization.id, type: 'EXTRA_REQUESTS' },
          select: { amount: true },
        })

        const earlyIpChanges = await prisma.addon.findFirst({
          where: { organizationId: organization.id, type: 'EARLY_IP_CHANGE' },
          select: { amount: true },
        })

        // 🔥 Definir preços
        const EXTRA_IP_UNIT_PRICE = 10
        const EXTRA_REQUESTS_UNIT_PRICE = 0.002 // R$ 0,002 por requisição extra
        const EARLY_IP_CHANGE_UNIT_PRICE = 5 // Troca antecipada de IP custa R$ 5,00

        const extraIpsAmount = extraIps?.amount || 0
        const extraRequestsAmount = extraRequests?.amount || 0
        const earlyIpChangesAmount = earlyIpChanges?.amount || 0

        // 🔥 Calcular custos
        const extraIpsPrice = extraIpsAmount * EXTRA_IP_UNIT_PRICE
        const extraRequestsPrice =
          extraRequestsAmount * EXTRA_REQUESTS_UNIT_PRICE
        const earlyIpChangesPrice =
          earlyIpChangesAmount * EARLY_IP_CHANGE_UNIT_PRICE
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
              unit: EXTRA_IP_UNIT_PRICE,
              price: extraIpsPrice,
            },
            extraRequests: {
              amount: extraRequestsAmount,
              unit: EXTRA_REQUESTS_UNIT_PRICE,
              price: extraRequestsPrice,
            },
            earlyIpChanges: {
              amount: earlyIpChangesAmount,
              unit: EARLY_IP_CHANGE_UNIT_PRICE,
              price: earlyIpChangesPrice,
            },
            total,
          },
        }
      },
    )
}
