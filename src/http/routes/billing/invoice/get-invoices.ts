import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'

export async function getInvoices(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/organizations/:slug/billing/invoices',
      {
        schema: {
          tags: ['Billing'],
          summary: 'List all invoices for an organization',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          response: {
            200: z.object({
              invoices: z.array(
                z.object({
                  id: z.string(),
                  amount: z.number(),
                  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELED']),
                  dueDate: z.string(),
                  paidAt: z.string().nullable(),
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

        if (!org) throw new NotFoundError()

        await ensureIsAdminOrOwner(userId, org.id)

        const invoices = await prisma.invoice.findMany({
          where: { organizationId: org.id },
          orderBy: { dueDate: 'desc' },
        })

        return {
          invoices: invoices.map((invoice) => ({
            id: invoice.id,
            amount: invoice.amount,
            status: invoice.status,
            dueDate: invoice.dueDate.toISOString(),
            paidAt: invoice.paidAt?.toISOString() || null,
          })),
        }
      },
    )
}
