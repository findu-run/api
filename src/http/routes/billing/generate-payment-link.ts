import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { authWithBilling } from '@/http/middlewares/auth-with-billing'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { getGateway } from '@/lib/gateways/factory'
import { env } from '@/env'
import { getClientIp } from '@/utils/get-client-ip'

export async function generatePaymentLink(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(authWithBilling)
    .post(
      '/organizations/:slug/billing/payment',
      {
        schema: {
          tags: ['Billing'],
          summary: 'Generate PIX payment link using Mangofy',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          body: z.object({
            document: z.string(),
            phoneNumber: z.string(),
          }),
          response: {
            200: z.object({
              paymentUrl: z.string(),
            }),
          },
        },
      },
      async (request, reply) => {
        const { slug } = request.params
        const { document, phoneNumber } = request.body
        const userId = await request.getCurrentUserId()
        const ip = getClientIp(request.headers, request.socket)

        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: {
            id: true,
            name: true,
            owner: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        })

        if (!organization) {
          throw new NotFoundError('Organization not found.')
        }

        await ensureIsAdminOrOwner(userId, organization.id)

        const invoice = await prisma.invoice.findFirst({
          where: {
            organizationId: organization.id,
            status: 'PENDING',
          },
          orderBy: { dueDate: 'asc' },
        })

        if (!invoice) {
          throw new NotFoundError('No pending invoice found.')
        }

        const gateway = await getGateway()

        const payment = await gateway.createPixPayment({
          amount: invoice.amount,
          invoiceId: invoice.id,
          postbackUrl: `${env.HOST}/webhooks/payments?provider=mangofy`,
          customer: {
            name: organization.owner.name,
            email: organization.owner.email,
            document,
            phone: phoneNumber,
            ip,
          },
        })

        return reply.send({ paymentUrl: payment.url || '' })
      },
    )
}
