import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'

import { BadRequestError } from '@/http/_errors/bad-request-error'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { ensureIsAdminOrOwner } from '@/utils/permissions'

export async function removeMember(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .delete(
      '/organizations/:slug/members/:memberId',
      {
        schema: {
          tags: ['Members'],
          summary: 'Remove a member from the organization',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
            memberId: z.string().uuid(),
          }),

          response: {
            204: z.null(),
          },
        },
      },
      async (request, reply) => {
        const { slug, memberId } = request.params
        const userId = await request.getCurrentUserId()

        // 🔥 Buscar a organização pelo slug
        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true, ownerId: true },
        })

        if (!organization) {
          throw new NotFoundError('Organization not found.')
        }

        // 🔥 Buscar o membro a ser removido
        const memberToRemove = await prisma.member.findUnique({
          where: { id: memberId },
          select: { id: true, role: true, userId: true, organizationId: true },
        })

        if (!memberToRemove || memberToRemove.organizationId !== organization.id) {
          throw new NotFoundError('Member not found in this organization.')
        }

        // 🔥 Buscar a função do usuário autenticado dentro da organização
        const userMembership = await prisma.member.findUnique({
          where: {
            organizationId_userId: {
              organizationId: organization.id,
              userId,
            },
          },
          select: { role: true },
        })

        if (!userMembership) {
          throw new BadRequestError('You are not a member of this organization.')
        }

        // 🔥 Evita que um usuário remova a si mesmo
        if (memberToRemove.userId === userId) {
          throw new BadRequestError('You cannot remove yourself from the organization.')
        }

        // 🔥 Se o membro for OWNER, impedir remoção direta
        if (memberToRemove.role === 'OWNER') {
          throw new BadRequestError('You cannot remove the organization owner.')
        }

        // 🔥 Se o usuário for ADMIN, ele só pode remover MEMBERs e CUSTOMERs
        if (userMembership.role === 'ADMIN') {
          if (memberToRemove.role !== 'MEMBER' && memberToRemove.role !== 'CUSTOMER') {
            throw new BadRequestError('You can only remove members with a lower role than yours.')
          }
        }

        // 🔥 Se passou por todas as verificações, pode excluir
        await prisma.member.delete({
          where: { id: memberToRemove.id },
        })

        return reply.status(204).send()
      },
    )
}
