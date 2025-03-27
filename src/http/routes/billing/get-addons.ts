import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { authWithBilling } from '@/http/middlewares/auth-with-billing'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'

export async function getAddons(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(authWithBilling)
    .get(
      '/organizations/:slug/billing/addons',
      {
        schema: {
          tags: ['Billing'],
          summary: 'List all addons for an organization',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          response: {
            200: z.object({
              addons: z.array(
                z.object({
                  id: z.string(),
                  type: z.enum([
                    'EXTRA_IP',
                    'EXTRA_REQUESTS',
                    'EARLY_IP_CHANGE',
                  ]),
                  amount: z.number(),
                  price: z.number(),
                  createdAt: z.string(),
                }),
              ),
            }),
          },
        },
      },
      async (request) => {
        const { slug } = request.params
        const userId = await request.getCurrentUserId()

        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true },
        })

        if (!organization) {
          throw new NotFoundError('Organization not found.')
        }

        await ensureIsAdminOrOwner(userId, organization.id)

        const addons = await prisma.addon.findMany({
          where: { organizationId: organization.id },
          select: {
            id: true,
            type: true,
            amount: true,
            price: true,
            createdAt: true,
          },
        })

        return {
          addons: addons.map((addon) => ({
            id: addon.id,
            type: addon.type,
            amount: addon.amount,
            price: addon.price,
            createdAt: addon.createdAt.toISOString(),
          })),
        }
      },
    )
}
