import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { ensureIsOwner } from '@/utils/permissions'
import { BadRequestError } from '@/http/_errors/bad-request-error'

export async function addIpAddress(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      '/organizations/:slug/ips',
      {
        schema: {
          tags: ['IP Addresses'],
          summary: 'Add a new authorized IP to the organization',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          body: z.object({
            ip: z.string().regex(
              /^(?:\d{1,3}\.){3}\d{1,3}$/,
              'Invalid IPv4 format',
            ),
          }),
          response: {
            201: z.object({
              ipId: z.string().uuid(),
              ip: z.string(),
            }),
          },
        },
      },
      async (request, reply) => {
        const { slug } = request.params
        const { ip } = request.body
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
                    maxIps: true, // 🔥 Obtém o limite de IPs permitido pelo plano
                  },
                },
              },
            },
            addons: {
              where: { type: 'EXTRA_IP' }, // 🔥 Obtém Addons de IP Extra
              select: { amount: true },
            },
          },
        })

        if (!organization) {
          throw new BadRequestError('Organization not found.')
        }

        // 🔥 Verifica se o usuário é o OWNER
        await ensureIsOwner(userId, organization.id)

        // 🔥 Verifica se a organização tem um plano ativo
        if (!organization.subscription || organization.subscription.status !== 'ACTIVE') {
          throw new BadRequestError('Organization does not have an active subscription.')
        }

        // 🔥 Calcula o limite total de IPs permitidos
        const maxIpsAllowed =
          organization.subscription.plan.maxIps +
          (organization.addons.reduce((sum, addon) => sum + addon.amount, 0) || 0)

        // 🔥 Se já atingiu o limite de IPs, bloqueia a adição
        if (organization.ipAddress.length >= maxIpsAllowed) {
          throw new BadRequestError(
            `You have reached the maximum limit of ${maxIpsAllowed} IPs for your organization. Remove an existing IP or purchase an extra IP addon.`,
          )
        }

        // 🔥 Adiciona o novo IP na organização
        const newIp = await prisma.ipAddress.create({
          data: {
            organizationId: organization.id,
            ip,
          },
        })

        return reply.status(201).send({
          ipId: newIp.id,
          ip: newIp.ip,
        })
      },
    )
}
