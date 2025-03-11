import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { auth } from '@/http/middlewares/auth'
import { BadRequestError } from '@/http/_errors/bad-request-error'

import { prisma } from '@/lib/prisma'
import { ensureIsOwner } from '@/utils/permissions'

export async function transferOrganization(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      '/organizations/:slug/owner',
      {
        schema: {
          tags: ['Organizations'],
          summary: 'Transfer organization ownership',
          security: [{ bearerAuth: [] }],
          body: z.object({
            transferToUserId: z.string().uuid(),
          }),
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

        // 🔥 Busca a organização pelo slug e verifica se o usuário é OWNER
        const organization = await prisma.organization.findFirstOrThrow({
          where: { slug },
        })

        await ensureIsOwner(userId, organization.id)

        const { transferToUserId } = request.body

        // 🔥 Valida se o novo proprietário é um membro da organização
        const transferToMembership = await prisma.member.findUnique({
          where: {
            organizationId_userId: {
              organizationId: organization.id,
              userId: transferToUserId,
            },
          },
          select: {
            role: true,
          },
        })

        if (!transferToMembership) {
          throw new BadRequestError(
            'Target user is not a member of this organization.',
          )
        }

        // 🔥 Garante que apenas um ADMIN pode receber a transferência
        if (transferToMembership.role !== 'ADMIN' && transferToMembership.role !== 'OWNER') {
          throw new BadRequestError(
            'Ownership can only be transferred to an ADMIN user.',
          )
        }

        // 🔥 Realiza a transferência de propriedade em uma transação
        await prisma.$transaction([
          // Rebaixar o OWNER atual para ADMIN
          prisma.member.update({
            where: {
              organizationId_userId: {
                organizationId: organization.id,
                userId,
              },
            },
            data: {
              role: 'ADMIN',
            },
          }),

          // Promover o novo dono para OWNER
          prisma.member.update({
            where: {
              organizationId_userId: {
                organizationId: organization.id,
                userId: transferToUserId,
              },
            },
            data: {
              role: 'OWNER',
            },
          }),

          // Atualizar o ownerId na tabela de organizações
          prisma.organization.update({
            where: {
              id: organization.id,
            },
            data: {
              ownerId: transferToUserId,
            },
          }),
        ])

        return reply.status(204).send()
      },
    )
}
