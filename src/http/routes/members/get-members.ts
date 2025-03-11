import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { roleSchema } from '@/http/routes/organization/get-organizations'

import { NotFoundError } from '@/http/_errors/not-found-error'
import { ensureIsAdminOrOwner } from '@/utils/permissions'

export async function getMembers(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/organizations/:slug/members',
      {
        schema: {
          tags: ['Members'],
          summary: 'Get all organization members',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          response: {
            200: z.object({
              members: z.array(
                z.object({
                  id: z.string().uuid(),
                  userId: z.string().uuid(),
                  role: roleSchema,
                  name: z.string().nullable(),
                  email: z.string().email().nullable(), // 🔥 Agora pode ser nulo para usuários sem permissão
                  avatarUrl: z.string().url().nullable(),
                }),
              ),
            }),
          },
        },
      },
      async (request, reply) => {
        const { slug } = request.params
        const userId = await request.getCurrentUserId()

        // 🔥 Buscar a organização pelo slug
        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true },
        })

        if (!organization) {
          throw new NotFoundError('Organization not found.')
        }

        // 🔥 Garante que o usuário é OWNER ou ADMIN antes de continuar
        await ensureIsAdminOrOwner(userId, organization.id)

        // 🔥 Buscar membros da organização e ordenar por `role`
        const members = await prisma.member.findMany({
          where: {
            organizationId: organization.id,
          },
          select: {
            id: true,
            role: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            role: 'asc',
          },
        })

        // 🔥 Formatar a resposta, escondendo o e-mail se o usuário não for OWNER ou ADMIN
        const formattedMembers = members.map(({ user, ...member }) => ({
          id: member.id,
          role: member.role,
          userId: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          email:
            member.role === 'OWNER' || member.role === 'ADMIN' ? user.email : null, // 🔥 Esconder email para membros comuns
        }))

        return reply.send({ members: formattedMembers })
      },
    )
}
