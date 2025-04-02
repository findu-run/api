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
              payment_code: z.string(),
              external_code: z.string(),
              payment_method: z.string(),
              payment_status: z.string(),
              payment_amount: z.number(),
              sale_amount: z.number(),
              shipping_amount: z.number(),
              installments: z.number(),
              installment_amount: z.number(),
              pix: z
                .object({
                  pix_link: z.string(),
                  pix_qrcode_text: z.string(),
                })
                .optional(),
            }),
            400: z.object({ error: z.string() }), // Adicionado para erro de fatura pendente
            502: z.object({ error: z.string() }),
          },
        },
      },
      async (request, reply) => {
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

        app.log.info({ totalAmount }, '💰 Valor total do pagamento')

        // Verificar se já existe uma fatura pendente
        const existingInvoice = await prisma.invoice.findFirst({
          where: {
            organizationId: organization.id,
            status: 'PENDING',
          },
          select: {
            id: true,
            amount: true,
            paymentUrl: true,
            paymentId: true,
          },
        })

        if (existingInvoice) {
          // Verificar se o valor da fatura existente é compatível
          if (existingInvoice.amount === totalAmount) {
            app.log.info(
              { invoiceId: existingInvoice.id },
              '🔄 Reutilizando fatura pendente existente',
            )

            // Se já tiver paymentUrl e paymentId, podemos buscar o status do pagamento no gateway
            if (existingInvoice.paymentUrl && existingInvoice.paymentId) {
              const gateway = await getGateway()
              // Aqui você poderia adicionar uma lógica para verificar o status no gateway, se disponível
              // Por enquanto, vamos assumir que a fatura existente já tem os dados necessários
              return reply.send({
                payment_code: existingInvoice.paymentId,
                external_code: existingInvoice.id,
                payment_method: paymentMethod,
                payment_status: 'pending', // Pode ser ajustado com uma chamada ao gateway
                payment_amount: totalAmount,
                sale_amount: totalAmount,
                shipping_amount: 0,
                installments: 1,
                installment_amount: totalAmount,
                pix:
                  paymentMethod === 'pix'
                    ? {
                        pix_link: existingInvoice.paymentUrl,
                        pix_qrcode_text: '',
                      }
                    : undefined,
              })
            }
          } else {
            // Se o valor não for compatível, retornar erro
            return reply.status(400).send({
              error:
                'Já existe uma fatura pendente com valor diferente. Cancele ou pague a fatura existente antes de criar uma nova.',
            })
          }
        }

        // Se não houver fatura pendente, criar uma nova
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

          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              paymentUrl: payment.pix?.pix_link,
              paymentId: payment.payment_code,
            },
          })

          app.log.info(
            `💸 Payment link generated for invoice ${invoice.id}: ${payment.pix?.pix_link || payment.payment_code}`,
          )

          return reply.send(payment)
        } catch (error) {
          app.log.error('Error generating payment link:', error)
          return reply
            .status(502)
            .send({ error: 'Failed to generate payment link.' })
        }
      },
    )
}
