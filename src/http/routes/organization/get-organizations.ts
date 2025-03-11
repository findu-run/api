import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { auth } from '@/http/middlewares/auth'

export const roleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'CUSTOMER', 'BILLING'])

export async function getOrganizations(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/organizations',
      {
        schema: {
          tags: ['Organizations'],
          summary: 'Get organizations where user is a member',
          security: [{ bearerAuth: [] }],
          response: {
            200: z.object({
              organizations: z.array(
                z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                  slug: z.string(),
                  role: roleSchema,
                  plan: z
                    .object({
                      name: z.string(),
                      type: z.string(),
                      status: z.string(),
                    })
                    .nullable(),
                }),
              ),
            }),
          },
        },
      },
      async (request) => {
        const userId = await request.getCurrentUserId()

        const organizations = await prisma.organization.findMany({
          where: {
            members: {
              some: { userId },
            },
          },
          select: {
            id: true,
            name: true,
            slug: true,
            members: {
              select: { role: true },
              where: { userId },
            },
            subscription: {
              select: {
                plan: {
                  select: {
                    name: true,
                    type: true,
                  },
                },
                status: true,
              },
            },
          },
        })

        // 🔥 Formatar o retorno para incluir o papel do usuário dentro de cada organização
        const formattedOrganizations = organizations.map((org) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          role: org.members[0]?.role || 'MEMBER',
          plan: org.subscription
            ? {
                name: org.subscription.plan.name,
                type: org.subscription.plan.type,
                status: org.subscription.status,
              }
            : null,
        }))

        return { organizations: formattedOrganizations }
      },
    )
}
