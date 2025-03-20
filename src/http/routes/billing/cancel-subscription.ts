import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'

export async function cancelSubscription(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      '/organizations/:slug/billing/cancel',
      {
        schema: {
          tags: ['Billing'],
          summary: 'Cancel subscription for an organization',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          response: {
            200: z.object({
              message: z.string(),
            }),
          },
        },
      },
      async (request, reply) => {
        const { slug } = request.params
        const userId = await request.getCurrentUserId()

        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: {
            id: true,
            subscription: {
              select: { id: true },
            },
          },
        })

        if (!organization) {
          throw new NotFoundError('Organization not found.')
        }

        await ensureIsAdminOrOwner(userId, organization.id)

        if (!organization.subscription) {
          throw new NotFoundError('No active subscription found.')
        }

        // 🔥 Cancelar a assinatura no banco
        await prisma.subscription.update({
          where: { id: organization.subscription.id },
          data: { status: 'CANCELED' },
        })

        return reply.send({ message: 'Subscription canceled successfully' })
      }
    )
}
