import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { convertToBrazilTime } from '@/utils/convert-to-brazil-time'
import { prisma } from '@/lib/prisma'
import { auth } from '@/http/middlewares/auth'
import { BadRequestError } from '@/http/_errors/bad-request-error'
import { createSlug } from '@/utils/create-slug'
import { PlanTier } from '@prisma/client'

export async function testTrialFlow(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      '/admin/test-trial',
      {
        schema: {
          tags: ['Admin'],
          summary: 'Test the trial flow including payment and job behavior',
          security: [{ bearerAuth: [] }],
          body: z.object({
            name: z.string().default('TestOrg'),
            simulatePayment: z.boolean().default(false),
            daysOffset: z.number().int().default(0),
          }),
          response: {
            200: z.object({
              organizationId: z.string(),
              subscriptionId: z.string(),
              status: z.string(),
              trialEndsAt: z.string().nullable(),
              currentPeriodEnd: z.string(),
              invoiceId: z.string().nullable(),
            }),
          },
        },
      },
      async (request, reply) => {
        const userId = await request.getCurrentUserId()
        const { name, simulatePayment, daysOffset } = request.body

        const slug = `${createSlug(name)}-${Date.now()}`

        const plan = await prisma.plan.findFirst({
          where: { type: PlanTier.TRIAL },
          select: { id: true, isTrialAvailable: true },
        })

        if (!plan) {
          throw new BadRequestError('Trial plan not found.')
        }

        const now = convertToBrazilTime(new Date()).add(daysOffset, 'day')
        const trialEndsAt = plan.isTrialAvailable
          ? now.add(7, 'day').toDate()
          : null
        const currentPeriodEnd = trialEndsAt ?? now.add(30, 'day').toDate()

        const organization = await prisma.organization.create({
          data: {
            name,
            slug,
            ownerId: userId,
            members: { create: { userId, role: 'OWNER' } },
          },
        })

        const subscription = await prisma.subscription.create({
          data: {
            organizationId: organization.id,
            planId: plan.id,
            status: plan.isTrialAvailable ? 'TRIALING' : 'ACTIVE',
            currentPeriodEnd,
          },
        })

        let invoiceId: string | null = null
        if (simulatePayment) {
          const paidPlan = await prisma.plan.findFirst({
            where: { type: PlanTier.BASIC }, // Seu plano "Pro"
          })
          if (!paidPlan) {
            throw new BadRequestError('Paid plan not found.')
          }

          const invoice = await prisma.invoice.create({
            data: {
              organizationId: organization.id,
              subscriptionId: subscription.id,
              amount: paidPlan.price,
              dueDate: now.add(7, 'day').toDate(),
              status: 'PAID',
              paidAt: now.toDate(),
            },
          })
          invoiceId = invoice.id

          // Atualiza a assinatura pra ACTIVE com o plano pago
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              status: 'ACTIVE',
              planId: paidPlan.id,
              currentPeriodEnd: now.add(30, 'day').toDate(),
            },
          })
        }

        return reply.send({
          organizationId: organization.id,
          subscriptionId: subscription.id,
          status: simulatePayment ? 'ACTIVE' : subscription.status,
          trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
          currentPeriodEnd: (simulatePayment
            ? now.add(30, 'day')
            : now.add(7, 'day')
          ).toISOString(),
          invoiceId,
        })
      },
    )
}
