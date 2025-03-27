import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { convertToBrazilTime } from '@/utils/convert-to-brazil-time'

export async function getBillingDetails(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/organizations/:slug/billing',
      {
        schema: {
          tags: ['Billing'],
          summary: 'Retrieve billing details for an organization',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          response: {
            200: z.object({
              planName: z.string().nullable(),
              status: z.string().nullable(),
              nextPaymentDate: z.string().nullable(),
              totalPaidInvoices: z.number(),
            }),
          },
        },
      },
      async (request, reply) => {
        const { slug } = request.params
        const userId = await request.getCurrentUserId()

        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: {
            id: true,
            subscription: {
              select: {
                status: true,
                currentPeriodEnd: true,
                plan: {
                  select: { name: true },
                },
              },
            },
          },
        })

        if (!organization) {
          throw new NotFoundError('Organization not found.')
        }

        await ensureIsAdminOrOwner(userId, organization.id)

        // Busca total de faturas pagas
        const totalPaidInvoices = await prisma.invoice.count({
          where: {
            organizationId: organization.id,
            status: 'PAID',
          },
        })

        if (!organization.subscription) {
          return reply.send({
            planName: null,
            status: null,
            nextPaymentDate: null,
            totalPaidInvoices,
          })
        }

        const nextPaymentDate = organization.subscription.currentPeriodEnd
          ? convertToBrazilTime(
              organization.subscription.currentPeriodEnd,
            ).toISOString()
          : null

        return reply.send({
          planName: organization.subscription.plan.name,
          status: organization.subscription.status,
          nextPaymentDate,
          totalPaidInvoices,
        })
      },
    )
}
