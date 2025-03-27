import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { convertToBrazilTime } from '@/utils/convert-to-brazil-time'

// Lista de IPs permitidos do Mangofy (substitua pelos reais)
const MANGOFY_IPS = ['192.168.1.1', '192.168.1.2'] // Exemplo, atualize com os IPs reais

// Tipagem explícita do InvoiceStatus (ajuste conforme seu schema.prisma)
type InvoiceStatus = 'PENDING' | 'PAID' | 'CANCELED' | 'OVERDUE'

export async function paymentWebhookRoute(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/webhooks/payments',
    {
      schema: {
        tags: ['Webhooks'],
        summary: 'Recebe notificação de pagamento do Mangofy',
        querystring: z.object({
          provider: z.string(),
        }),
        body: z.object({
          payment_code: z.string(),
          external_code: z.string(),
          payment_method: z.string(),
          payment_status: z.enum([
            'pending',
            'approved',
            'canceled',
            'refunded',
          ]),
          created_at: z.string(),
          updated_at: z.string(),
          approved_at: z.string().nullable(),
          refunded_at: z.string().nullable(),
        }),
        response: {
          200: z.object({ message: z.string() }),
          400: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const clientIp = request.ip
      if (!MANGOFY_IPS.includes(clientIp)) {
        app.log.error('IP não autorizado para webhook:', { clientIp })
        return reply.code(403).send({ message: 'Unauthorized IP address.' })
      }

      const { external_code: invoiceId, payment_status } = request.body
      const { provider } = request.query

      if (provider !== 'mangofy') {
        app.log.error('Invalid webhook provider:', { provider })
        return reply.code(400).send({ message: 'Invalid webhook provider.' })
      }

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { subscription: { include: { plan: true } } },
      })

      if (!invoice) {
        app.log.error('Invoice not found for webhook:', {
          invoiceId,
          payment_status,
        })
        return reply.code(404).send({ message: 'Invoice not found.' })
      }

      // Mapeamento com tipagem explícita para InvoiceStatus
      const statusMap: Record<string, InvoiceStatus> = {
        pending: 'PENDING',
        approved: 'PAID',
        canceled: 'CANCELED',
        refunded: 'CANCELED', // Ajuste se "refunded" deve mapear para outro status
      }
      const newStatus = statusMap[payment_status] || 'PENDING'

      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: newStatus,
          paidAt: newStatus === 'PAID' ? new Date() : null,
        },
      })

      if (newStatus === 'PAID' && invoice.subscription?.status === 'TRIALING') {
        const newPlan = await prisma.plan.findFirst({
          where: { type: 'PROFESSIONAL' },
        })

        if (!newPlan) {
          app.log.error('Professional plan not found.')
          throw new Error('Professional plan not found.')
        }

        const periodEnd = convertToBrazilTime(new Date())
          .add(30, 'day')
          .toDate()
        await prisma.subscription.update({
          where: { id: invoice.subscription.id },
          data: {
            status: 'ACTIVE',
            planId: newPlan.id,
            currentPeriodEnd: periodEnd,
          },
        })
        app.log.info(
          `🔄 Trial convertido para ACTIVE (Pro) na org ${invoice.subscription.organizationId}`,
        )
      }

      app.log.info(
        `Webhook processado: Invoice ${invoiceId} atualizado para ${newStatus}`,
      )
      return reply.send({ message: 'Invoice status updated via webhook.' })
    },
  )
}
