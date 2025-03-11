import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'

import { auth } from '@/http/middlewares/auth'

import { BadRequestError } from '@/http/_errors/bad-request-error'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { roleSchema } from '../organization/get-organizations'

export async function updateMember(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .put(
      '/organizations/:slug/members/:memberId',
      {
        schema: {
          tags: ['Members'],
          summary: 'Update a member',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
            memberId: z.string().uuid(),
          }),
          body: z.object({
            role: roleSchema,
          }),
          response: {
            204: z.null(),
          },
        },
      },
      async (request, reply) => {
        const { slug, memberId } = request.params
        const { role } = request.body
        const userId = await request.getCurrentUserId()

        // 🔥 Buscar a organização pelo slug
        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true, ownerId: true },
        })

        if (!organization) {
          throw new NotFoundError('Organization not found.')
        }

        // 🔥 Buscar o membro a ser atualizado
        const memberToUpdate = await prisma.member.findUnique({
          where: { id: memberId },
          select: { id: true, role: true, userId: true, organizationId: true },
        })

        if (!memberToUpdate || memberToUpdate.organizationId !== organization.id) {
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

        // 🔥 Impedir que o usuário altere o próprio papel
        if (memberToUpdate.userId === userId) {
          throw new BadRequestError('You cannot change your own role.')
        }

        // 🔥 Impedir que um ADMIN promova alguém para ADMIN ou OWNER
        if (userMembership.role === 'ADMIN') {
          if (role === 'ADMIN' || role === 'OWNER') {
            throw new BadRequestError('Only the organization owner can assign ADMIN or OWNER roles.')
          }
        }

        // 🔥 O OWNER não pode ter seu papel alterado
        if (memberToUpdate.role === 'OWNER') {
          throw new BadRequestError('The owner role cannot be changed via this endpoint. Use the transfer ownership feature.')
        }

        // 🔥 Se passou por todas as verificações, pode atualizar
        await prisma.member.update({
          where: { id: memberToUpdate.id },
          data: { role },
        })

        return reply.status(204).send()
      },
    )
}
