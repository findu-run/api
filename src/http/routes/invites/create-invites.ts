import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'

import { BadRequestError } from '@/http/_errors/bad-request-error'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { ensureIsAdminOrOwner } from '@/utils/permissions'

// 🔥 Criamos um schema para evitar que convites sejam criados para OWNER
const inviteRoleSchema = z.enum(['ADMIN', 'MEMBER', 'CUSTOMER', 'BILLING'])

export async function createInvite(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      '/organizations/:slug/invites',
      {
        schema: {
          tags: ['Invites'],
          summary: 'Create a new invite',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          body: z.object({
            email: z.string().email(),
            role: inviteRoleSchema,
          }),
          response: {
            201: z.object({
              inviteId: z.string().uuid(),
            }),
          },
        },
      },
      async (request, reply) => {
        const { slug } = request.params
        const userId = await request.getCurrentUserId()
        const { email, role } = request.body

        // 🔥 Buscar a organização pelo slug
        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: { id: true, domain: true, shouldAttachUsersByDomain: true },
        })

        if (!organization) {
          throw new NotFoundError('Organization not found.')
        }

        await ensureIsAdminOrOwner(userId, organization.id)

        const [, domain] = email.split('@')

        // 🔥 Se a organização está configurada para adicionar usuários automaticamente pelo domínio
        if (organization.shouldAttachUsersByDomain && domain === organization.domain) {
          throw new BadRequestError(
            `Users with '${domain}' domain will join your organization automatically on login.`,
          )
        }

        // 🔥 Se já existe um convite para o mesmo e-mail, impedir duplicação
        const existingInvite = await prisma.invite.findUnique({
          where: {
            email_organizationId: {
              email,
              organizationId: organization.id,
            },
          },
        })

        if (existingInvite) {
          throw new BadRequestError(
            'Another invite with the same e-mail already exists.',
          )
        }

        // 🔥 Se o e-mail já pertence a um membro, impedir envio do convite
        const existingMember = await prisma.member.findFirst({
          where: {
            organizationId: organization.id,
            user: {
              email,
            },
          },
        })

        if (existingMember) {
          throw new BadRequestError(
            'A member with this e-mail already belongs to your organization.',
          )
        }

        // 🔥 Criar o convite
        const invite = await prisma.invite.create({
          data: {
            organizationId: organization.id,
            email,
            role,
            authorId: userId,
          },
        })

        return reply.status(201).send({
          inviteId: invite.id,
        })
      },
    )
}
