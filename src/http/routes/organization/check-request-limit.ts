import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import dayjs from 'dayjs'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { ensureIsAdminOrOwner } from '@/utils/permissions'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { BadRequestError } from '@/http/_errors/bad-request-error'

export async function checkRequestLimit(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/organizations/:slug/request-limit',
      {
        schema: {
          tags: ['Requests'],
          summary: 'Check if organization has reached request limit',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
          }),
          response: {
            200: z.object({
              reached: z.boolean(), // 🔥 Indica se atingiu o limite ou não
              remainingRequests: z.number(), // 🔥 Número de requisições restantes
              requestLimit: z.number(), // 🔥 Máximo permitido pelo plano
            }),
          },
        },
      },
      async (request, reply) => {
        const { slug } = request.params

        // 📌 Buscar organização pelo slug
        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: {
            id: true,
            subscription: {
              select: {
                status: true,
                plan: {
                  select: { maxRequests: true },
                },
              },
            },
          },
        })

        if (!organization) {
          throw new NotFoundError('Organization not found.')
        }

        await ensureIsAdminOrOwner(await request.getCurrentUserId(), organization.id)

        if (!organization.subscription || organization.subscription.status !== 'ACTIVE') {
          throw new BadRequestError('Organization does not have an active subscription.')
        }

        // 📅 Verifica o início do mês atual
        const startOfMonth = dayjs().startOf('month').toDate()

        // 🔥 Contar quantas requisições foram feitas este mês
        const requestsMade = await prisma.queryLog.count({
          where: {
            organizationId: organization.id,
            createdAt: { gte: startOfMonth },
          },
        })

        // 🔥 Definir limite de requisições baseado no plano
        const requestLimit = organization.subscription.plan?.maxRequests || 0
        const remainingRequests = Math.max(requestLimit - requestsMade, 0)

        return {
          reached: remainingRequests <= 0, // ✅ Se chegou a zero, atingiu o limite
          remainingRequests,
          requestLimit,
        }
      }
    )
}
