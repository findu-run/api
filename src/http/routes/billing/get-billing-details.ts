import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'

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
              planName: z.string(),
              status: z.string(),
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

        // Buscar quantos pagamentos já foram feitos
        const totalPaidInvoices = await prisma.queryLog.count({
          where: { organizationId: organization.id },
        })

        return reply.send({
          planName: organization.subscription?.plan.name || 'No Plan',
          status: organization.subscription?.status || 'INACTIVE',
          nextPaymentDate: organization.subscription?.currentPeriodEnd?.toISOString() || null,
          totalPaidInvoices,
        })
      }
    )
}
