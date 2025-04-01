import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { authWithBilling } from '@/http/middlewares/auth-with-billing'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { convertToBrazilTime } from '@/utils/convert-to-brazil-time'

export async function getBillingSummary(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(authWithBilling)
    .get(
      '/organizations/:slug/billing/summary',
      {
        schema: {
          tags: ['Billing'],
          summary: 'Get billing summary including subscription and invoices',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          response: {
            200: z.object({
              subscription: z
                .object({
                  id: z.string(),
                  status: z.string(),
                  startedAt: z.string(),
                  currentPeriodEnd: z.string(),
                  plan: z.object({
                    id: z.string(),
                    name: z.string(),
                    price: z.number(),
                    type: z.enum([
                      'TRIAL',
                      'BASIC',
                      'PROFESSIONAL',
                      'BUSINESS',
                    ]),
                  }),
                })
                .nullable(),
              invoices: z.array(
                z.object({
                  id: z.string(),
                  amount: z.number(),
                  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELED']),
                  dueDate: z.string(),
                  paidAt: z.string().nullable(),
                  paymentUrl: z.string().nullable(),
                }),
              ),
            }),
          },
        },
      },
      async (request) => {
        const { slug } = request.params
        const userId = await request.getCurrentUserId()

        const org = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true },
        })

        if (!org) throw new NotFoundError('Organization not found.')

        await ensureIsAdminOrOwner(userId, org.id)

        const subscription = await prisma.subscription.findFirst({
          where: { organizationId: org.id },
          include: { plan: true },
        })

        const invoices = await prisma.invoice.findMany({
          where: { organizationId: org.id },
          orderBy: { dueDate: 'desc' },
          select: {
            id: true,
            amount: true,
            status: true,
            dueDate: true,
            paidAt: true,
            paymentUrl: true,
          },
        })

        return {
          subscription: subscription
            ? {
                id: subscription.id,
                status: subscription.status,
                startedAt: subscription.startedAt.toISOString(),
                currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
                plan: {
                  id: subscription.plan.id,
                  name: subscription.plan.name,
                  price: subscription.plan.price,
                  type: subscription.plan.type,
                },
              }
            : null,
          invoices: invoices.map((invoice) => ({
            id: invoice.id,
            amount: invoice.amount,
            status: invoice.status,
            dueDate: convertToBrazilTime(invoice.dueDate).toISOString(),
            paidAt: invoice.paidAt
              ? convertToBrazilTime(invoice.paidAt).toISOString()
              : null,
            paymentUrl: invoice.paymentUrl || null,
          })),
        }
      },
    )
}
