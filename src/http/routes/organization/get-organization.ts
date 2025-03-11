import { auth } from '@/http/middlewares/auth'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { BadRequestError } from '@/http/_errors/bad-request-error'

export async function getOrganization(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/organizations/:slug',
      {
        schema: {
          tags: ['Organizations'],
          summary: 'Get details from an organization',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          response: {
            200: z.object({
              organization: z.object({
                id: z.string().uuid(),
                name: z.string(),
                slug: z.string(),
                domain: z.string().nullable(),
                shouldAttachUsersByDomain: z.boolean(),
                createdAt: z.date(),
                updatedAt: z.date(),
                ownerId: z.string().uuid(),
                plan: z
                  .object({
                    name: z.string(),
                    type: z.string(),
                    status: z.string(),
                    currentPeriodEnd: z.date().nullable(),
                  })
                  .nullable(),
                membersCount: z.number(),
              }),
            }),
          },
        },
      },
      async (request) => {
        const { slug } = request.params
        const userId = await request.getCurrentUserId()

        // 🔥 Verifica se o usuário tem acesso à organização
        const membership = await prisma.member.findFirst({
          where: {
            userId,
            organization: {
              slug,
            },
          },
        })

        if (!membership) {
          throw new BadRequestError('Access denied. You are not a member of this organization.')
        }

        // 🔥 Buscar os detalhes da organização
        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: {
            id: true,
            name: true,
            slug: true,
            domain: true,
            shouldAttachUsersByDomain: true,
            createdAt: true,
            updatedAt: true,
            ownerId: true,
            subscription: {
              select: {
                plan: {
                  select: {
                    name: true,
                    type: true,
                  },
                },
                status: true,
                currentPeriodEnd: true,
              },
            },
            members: {
              select: {
                id: true,
              },
            },
          },
        })

        if (!organization) {
          throw new BadRequestError('Organization not found.')
        }

        return {
          organization: {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            domain: organization.domain,
            shouldAttachUsersByDomain: organization.shouldAttachUsersByDomain,
            createdAt: organization.createdAt,
            updatedAt: organization.updatedAt,
            ownerId: organization.ownerId,
            plan: organization.subscription
              ? {
                  name: organization.subscription.plan.name,
                  type: organization.subscription.plan.type,
                  status: organization.subscription.status,
                  currentPeriodEnd: organization.subscription.currentPeriodEnd,
                }
              : null,
            membersCount: organization.members.length,
          },
        }
      },
    )
}
