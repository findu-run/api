import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'

import { authWithBilling } from '@/http/middlewares/auth-with-billing'

export async function getAvailablePlans(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(authWithBilling)
    .get(
      '/plans',
      {
        schema: {
          tags: ['Billing'],
          summary: 'List all available plans and indicate current user plan',
          security: [{ bearerAuth: [] }],
          response: {
            200: z.object({
              plans: z.array(
                z.object({
                  id: z.string(),
                  name: z.string(),
                  price: z.number(),
                  type: z.enum(['TRIAL', 'BASIC', 'PROFESSIONAL', 'BUSINESS']),
                  isTrialAvailable: z.boolean(),
                  maxOrganizations: z.number(),
                  maxIps: z.number(),
                  maxRequests: z.number(),
                  ipChangeLimit: z.number(),
                  supportLevel: z.string(),
                  description: z.string(),
                  isCurrent: z.boolean(),
                }),
              ),
            }),
          },
        },
      },
      async (request) => {
        const userId = await request.getCurrentUserId()

        const organization = await prisma.organization.findFirst({
          where: { members: { some: { userId } } },
          include: { subscription: true },
        })

        const currentPlanId = organization?.subscription?.planId ?? null

        const plans = await prisma.plan.findMany({
          orderBy: { price: 'asc' },
        })

        return {
          plans: plans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            price: plan.price,
            type: plan.type,
            isTrialAvailable: plan.isTrialAvailable,
            maxOrganizations: plan.maxOrganizations,
            maxIps: plan.maxIps,
            maxRequests: plan.maxRequests,
            ipChangeLimit: plan.ipChangeLimit,
            supportLevel: plan.supportLevel,
            description: plan.description ?? '',
            isCurrent: plan.id === currentPlanId,
          })),
        }
      },
    )
}
