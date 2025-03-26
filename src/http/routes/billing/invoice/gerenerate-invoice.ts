import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'

export async function generateInvoiceRoute(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      '/organizations/:slug/billing/invoices/generate',
      {
        schema: {
          tags: ['Billing'],
          summary: 'Generate invoice manually for organization',
          security: [{ bearerAuth: [] }],
          params: z.object({ slug: z.string() }),
          response: {
            201: z.object({
              message: z.string(),
              invoiceId: z.string(),
            }),
          },
        },
      },
      async (request, reply) => {
        const { slug } = request.params
        const userId = await request.getCurrentUserId()

        const org = await prisma.organization.findUnique({
          where: { slug },
          select: {
            id: true,
            subscription: {
              select: {
                id: true,
                plan: { select: { price: true } },
              },
            },
          },
        })

        if (!org || !org.subscription) throw new NotFoundError()

        await ensureIsAdminOrOwner(userId, org.id)

        const today = new Date()
        const dueDate = new Date(today.getFullYear(), today.getMonth() + 1, 1)

        const invoice = await prisma.invoice.create({
          data: {
            organizationId: org.id,
            subscriptionId: org.subscription.id,
            amount: org.subscription.plan.price,
            status: 'PENDING',
            dueDate,
          },
        })

        return reply.code(201).send({
          message: 'Invoice generated successfully.',
          invoiceId: invoice.id,
        })
      },
    )
}
