import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { ensureIsOwner } from '@/utils/permissions'
import { BadRequestError } from '@/http/_errors/bad-request-error'
import { NotFoundError } from '@/http/_errors/not-found-error'

export async function removeIpAddress(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .delete(
      '/organizations/:slug/ips/:ipId',
      {
        schema: {
          tags: ['IP Addresses'],
          summary: 'Remove an authorized IP from the organization',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
            ipId: z.string().uuid(),
          }),
          response: {
            204: z.null(),
          },
        },
      },
      async (request, reply) => {
        const { slug, ipId } = request.params
        const userId = await request.getCurrentUserId()

        // 🔥 Buscar a organização e garantir que o usuário seja OWNER
        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: {
            id: true,
            ownerId: true,
            ipAddress: {
              select: { id: true },
            },
            subscription: {
              select: {
                status: true,
                plan: {
                  select: {
                    maxIps: true, // 🔥 Número máximo de IPs permitido pelo plano
                  },
                },
              },
            },
            addons: {
              where: { type: 'EXTRA_IP' }, // 🔥 Obtém Addons de IP extra
              select: { id: true, amount: true },
            },
          },
        })

        if (!organization) {
          throw new NotFoundError('Organization not found.')
        }

        // 🔥 Verifica se o usuário é o OWNER
        await ensureIsOwner(userId, organization.id)

        // 🔥 Verifica se a organização tem um plano ativo
        if (!organization.subscription || organization.subscription.status !== 'ACTIVE') {
          throw new BadRequestError('Organization does not have an active subscription.')
        }

        // 🔥 Buscar o IP a ser removido
        const ipRecord = await prisma.ipAddress.findUnique({
          where: { id: ipId },
        })

        if (!ipRecord || ipRecord.organizationId !== organization.id) {
          throw new NotFoundError('IP address not found or does not belong to this organization.')
        }

        // 🔥 Verifica se a organização ainda terá IPs suficientes após a remoção
        const totalRegisteredIps = organization.ipAddress.length
        const maxAllowedIps = organization.subscription.plan.maxIps + (organization.addons[0]?.amount || 0)

        if (totalRegisteredIps === 1 && maxAllowedIps === 1) {
          throw new BadRequestError('This organization requires at least one registered IP.')
        }

        // 🔥 Remove o IP no banco de dados
        await prisma.ipAddress.delete({
          where: { id: ipId },
        })

        return reply.status(204).send()
      },
    )
}
