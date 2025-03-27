import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { convertToBrazilTime } from '@/utils/convert-to-brazil-time'
import { sendNotification } from '@/lib/notifier/send'

import { authWithBilling } from '@/http/middlewares/auth-with-billing'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { BadRequestError } from '@/http/_errors/bad-request-error'

export async function changePlan(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(authWithBilling)
    .put(
      '/organizations/:slug/billing/plan',
      {
        schema: {
          tags: ['Billing'],
          summary: 'Change the subscription plan for an organization',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          body: z.object({
            planId: z.string().uuid(),
          }),
          response: {
            200: z.object({
              message: z.string(),
              invoiceId: z.string().optional(),
            }),
            400: z.object({
              message: z.string(),
            }),
          },
        },
      },
      async (request, reply) => {
        const { slug } = request.params
        const { planId } = request.body
        const userId = await request.getCurrentUserId()

        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: {
            id: true,
            name: true,
            owner: { select: { id: true } },
            subscription: {
              select: {
                id: true,
                plan: { select: { price: true } },
                currentPeriodEnd: true,
                status: true,
              },
            },
          },
        })

        if (!organization) {
          throw new NotFoundError('Organization not found.')
        }

        if (
          !organization.subscription ||
          organization.subscription.status !== 'ACTIVE'
        ) {
          throw new BadRequestError('Organization has no active subscription.')
        }

        await ensureIsAdminOrOwner(userId, organization.id)

        const newPlan = await prisma.plan.findUnique({
          where: { id: planId },
          select: { id: true, price: true, name: true },
        })

        if (!newPlan) {
          throw new NotFoundError('Plan not found.')
        }

        const currentPlanPrice = organization.subscription.plan.price
        const newPlanPrice = newPlan.price

        // Calcula diferença proporcional (se upgrade) ou ignora (se downgrade)
        let invoiceAmount = 0
        let invoiceId: string | undefined
        if (newPlanPrice > currentPlanPrice) {
          const now = convertToBrazilTime(new Date())
          const periodEnd = convertToBrazilTime(
            organization.subscription.currentPeriodEnd,
          )
          const totalDays = periodEnd.diff(now, 'day')
          const daysRemaining = Math.max(totalDays, 1) // Evita divisão por zero
          const dailyRateOld = currentPlanPrice / 30 // Aproximação de 30 dias
          const dailyRateNew = newPlanPrice / 30
          invoiceAmount = Math.round(
            (dailyRateNew - dailyRateOld) * daysRemaining,
          )

          if (invoiceAmount > 0) {
            const dueDate = now.add(7, 'day').toDate()
            const invoice = await prisma.invoice.create({
              data: {
                organizationId: organization.id,
                subscriptionId: organization.subscription.id,
                amount: invoiceAmount,
                dueDate,
                status: 'PENDING',
              },
            })
            invoiceId = invoice.id
          }
        }

        // Atualiza o plano da assinatura
        await prisma.subscription.update({
          where: { id: organization.subscription.id },
          data: { planId: newPlan.id },
        })

        // Notifica o dono
        const ownerToken = await prisma.token.findFirst({
          where: {
            userId: organization.owner.id,
            type: 'BARK_CONNECT',
          },
          orderBy: { createdAt: 'desc' },
        })

        if (ownerToken?.deviceKey) {
          await sendNotification({
            event: 'plan.changed',
            orgName: organization.name,
            deviceKey: ownerToken.deviceKey,
            skipApprise: false,
          })
        }

        app.log.info(
          `📋 Plano alterado para ${newPlan.name} na org ${organization.id}${
            invoiceId ? `, fatura ${invoiceId} gerada` : ''
          }`,
        )

        return reply.send({
          message: `Plan changed to ${newPlan.name} successfully.`,
          invoiceId,
        })
      },
    )
}
