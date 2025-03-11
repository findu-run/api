import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'

import { BadRequestError } from '@/http/_errors/bad-request-error'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { ensureIsAdminOrOwner } from '@/utils/permissions'

export async function revokeInvite(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .delete(
      '/organizations/:slug/invites/:inviteId',
      {
        schema: {
          tags: ['Invites'],
          summary: 'Revoke a pending invite',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
            inviteId: z.string().uuid(),
          }),
          response: {
            204: z.null(),
          },
        },
      },
      async (request, reply) => {
        const { slug, inviteId } = request.params
        const userId = await request.getCurrentUserId()

        // 🔥 Buscar a organização pelo slug
        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true },
        })

        if (!organization) {
          throw new NotFoundError('Organization not found.')
        }

        // 🔥 Garante que o usuário é OWNER ou ADMIN
        await ensureIsAdminOrOwner(userId, organization.id)

        // 🔥 Verifica se o convite existe antes de tentar excluir
        const invite = await prisma.invite.findUnique({
          where: {
            id: inviteId,
            organizationId: organization.id,
          },
        })

        if (!invite) {
          throw new NotFoundError('Invite not found.')
        }

        // 🔥 Revogar o convite
        await prisma.invite.delete({
          where: { id: inviteId },
        })

        return reply.status(204).send()
      },
    )
}
