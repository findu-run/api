import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'

import { authWithBilling } from '@/http/middlewares/auth-with-billing'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { BadRequestError } from '@/http/_errors/bad-request-error'

dayjs.extend(utc)
dayjs.extend(timezone)

export async function generateInvoiceRoute(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(authWithBilling)
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

        if (!org || !org.subscription) {
          throw new NotFoundError('Organization or subscription not found.')
        }

        await ensureIsAdminOrOwner(userId, org.id)

        const dueDate = dayjs()
          .tz('America/Sao_Paulo')
          .add(1, 'month')
          .startOf('month')
          .toDate()

        const existing = await prisma.invoice.findFirst({
          where: {
            organizationId: org.id,
            dueDate,
          },
        })

        if (existing) {
          throw new BadRequestError(
            'Invoice already generated for this period.',
          )
        }

        // Calcula o custo total incluindo addons
        const addons = await prisma.addon.findMany({
          where: { organizationId: org.id },
          select: { price: true },
        })

        const addonTotal = addons.reduce((sum, addon) => sum + addon.price, 0)
        const totalAmount = org.subscription.plan.price + addonTotal

        const invoice = await prisma.invoice.create({
          data: {
            organizationId: org.id,
            subscriptionId: org.subscription.id,
            amount: totalAmount,
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
