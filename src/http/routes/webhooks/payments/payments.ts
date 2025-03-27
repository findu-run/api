import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

export async function paymentWebhookRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/webhooks/payments',
    {
      schema: {
        tags: ['Webhooks'],
        summary: 'Recebe notificação de pagamento',
        security: [{ bearerAuth: [] }],
        querystring: z.object({
          provider: z.string(),
        }),
        body: z.object({
          invoiceId: z.string(),
          status: z.enum(['PAID', 'CANCELED']),
        }),
      },
    },
    async (request, reply) => {
      const { invoiceId, status } = request.body

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      })

      if (!invoice) {
        return reply.code(404).send({ message: 'Invoice not found.' })
      }

      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status,
          paidAt: status === 'PAID' ? new Date() : null,
        },
      })

      return reply.send({ message: 'Invoice status updated via webhook.' })
    },
  )
}
