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
import type { CreatePaymentResponse } from '@/lib/gateways/types'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

export async function generatePaymentLink(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(authWithBilling)
    .post(
      '/organizations/:slug/billing/payment',
      {
        schema: {
          tags: ['Billing'],
          summary: 'Generate payment link for PIX or Credit Card using Mangofy',
          security: [{ bearerAuth: [] }],
          params: z.object({ slug: z.string() }),
          body: z.object({
            paymentMethod: z.enum(['pix', 'credit_card']),
            document: z.string(),
            phoneNumber: z.string(),
            items: z.array(
              z.object({
                code: z.string(),
                name: z.string(),
                amount: z.number().int().min(1),
                quantity: z.number().int().min(1).default(1),
              }),
            ),
            card: z
              .object({
                number: z.string(),
                holder: z.string(),
                expiry: z.string(),
                cvv: z.string(),
                installments: z.number().int().min(1).max(12).optional(),
              })
              .optional(),
          }),
          response: {
            200: z.object({
              paymentUrl: z.string().optional(),
              paymentId: z.string(),
            }),
            502: z.object({ error: z.string() }),
          },
        },
      },
      async (request, reply) => {
        // No início da rota
        app.log.info('📥 Rota de pagamento chamada')
        const { slug } = request.params
        const { paymentMethod, document, phoneNumber, items, card } =
          request.body
        const userId = await request.getCurrentUserId()

        app.log.info({ userId }, '👤 ID do usuário autenticado')

        const ip = getClientIp(request.headers, request.socket)
        app.log.info({ ip }, '🌐 IP do cliente identificado')

        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: {
            id: true,
            name: true,
            owner: { select: { name: true, email: true } },
          },
        })

        if (!organization) {
          throw new NotFoundError('Organization not found.')
        }

        app.log.info({ organization }, '🏢 Organização localizada')

        await ensureIsAdminOrOwner(userId, organization.id)

        const totalAmount = items.reduce(
          (sum, item) => sum + item.amount * item.quantity,
          0,
        )

        // Antes de criar o invoice
        app.log.info({ totalAmount }, '💰 Valor total do pagamento')

        const dueDate = dayjs().tz('America/Sao_Paulo').add(3, 'day').toDate()

        const invoice = await prisma.invoice.create({
          data: {
            organizationId: organization.id,
            amount: totalAmount,
            status: 'PENDING',
            dueDate,
          },
        })

        const gateway = await getGateway()

        try {
          let payment: CreatePaymentResponse

          const customer = {
            name: organization.owner.name,
            email: organization.owner.email,
            document,
            phone: phoneNumber,
            ip,
          }

          // Antes de chamar o gateway
          app.log.info(
            { customer, items },
            '📦 Dados do cliente e itens prontos para o gateway',
          )

          const paymentParams = {
            amount: totalAmount,
            invoiceId: invoice.id,
            postbackUrl: `${env.HOST}/webhooks/payments?provider=mangofy`,
            customer,
            items: items.map((item) => ({
              code: item.code,
              name: item.name,
              amount: item.amount,
              quantity: item.quantity,
            })),
          }

          if (paymentMethod === 'pix') {
            payment = await gateway.createPixPayment(paymentParams)
          } else if (paymentMethod === 'credit_card') {
            if (!card) {
              throw new Error(
                'Card details are required for credit card payment.',
              )
            }
            payment = await gateway.createCardPayment({
              ...paymentParams,
              card: {
                number: card.number,
                holder: card.holder,
                expiry: card.expiry,
                cvv: card.cvv,
                installments: card.installments || 1,
              },
            })
          } else {
            throw new Error('Unsupported payment method.')
          }

          // Depois da resposta do gateway
          app.log.info({ payment }, '✅ Pagamento recebido do gateway')

          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              paymentUrl: payment.url,
              paymentId: payment.paymentId,
            },
          })

          app.log.info(
            `💸 Payment link generated for invoice ${invoice.id}: ${payment.url || payment.paymentId}`,
          )
          return reply.send({
            paymentUrl: payment.url,
            paymentId: payment.paymentId,
          })
        } catch (error) {
          app.log.error('Error generating payment link:', error)
          return reply
            .status(502)
            .send({ error: 'Failed to generate payment link.' })
        }
      },
    )
}
