import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'

import { auth } from '@/http/middlewares/auth'
import { ensureIsOwner } from '@/utils/permissions'
import { BadRequestError } from '@/http/_errors/bad-request-error'

export async function shutdownOrganization(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .delete(
      '/organizations/:slug',
      {
        schema: {
          tags: ['Organizations'],
          summary: 'Shutdown Organization',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          response: {
            204: z.null(),
          },
        },
      },
      async (request, reply) => {
        const { slug } = request.params
        const userId = await request.getCurrentUserId()

        // 🔥 Busca a organização e verifica se o usuário é OWNER
        const organization = await prisma.organization.findFirstOrThrow({
          where: { slug },
          include: {
            subscription: {
              select: { status: true },
            },
          },
        })

        // 🔥 Garante que apenas o OWNER possa deletar
        await ensureIsOwner(userId, organization.id)

        // 🔥 Impede a remoção se houver assinatura ativa
        if (organization.subscription && organization.subscription.status === 'ACTIVE') {
          throw new BadRequestError(
            'You cannot delete an organization with an active subscription. Please cancel the subscription first.',
          )
        }

        // 🔥 Remove a organização do banco de dados
        await prisma.organization.delete({
          where: { id: organization.id },
        })

        return reply.status(204).send()
      },
    )
}
