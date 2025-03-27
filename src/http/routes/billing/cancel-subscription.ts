import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { authWithBilling } from '@/http/middlewares/auth-with-billing'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { BadRequestError } from '@/http/_errors/bad-request-error'

export async function cancelSubscription(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(authWithBilling)
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

        // Verifica se há faturas pendentes
        const pendingInvoices = await prisma.invoice.count({
          where: {
            organizationId: organization.id,
            status: 'PENDING',
          },
        })

        if (pendingInvoices > 0) {
          throw new BadRequestError(
            'Cannot cancel subscription with pending invoices.',
          )
        }

        // Cancela a assinatura no banco
        await prisma.subscription.update({
          where: { id: organization.subscription.id },
          data: { status: 'CANCELED' },
        })

        return reply.send({ message: 'Subscription canceled successfully' })
      },
    )
}
