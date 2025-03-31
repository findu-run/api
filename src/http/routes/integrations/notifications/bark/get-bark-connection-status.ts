import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

import { prisma } from '@/lib/prisma'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { auth } from '@/http/middlewares/auth'

export async function getBarkConnectionStatus(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/integrations/bark/status',
      {
        schema: {
          tags: ['Integrations'],
          summary: 'Verifica se o usuário está conectado ao Bark',
          security: [{ bearerAuth: [] }],
          response: {
            200: z.object({
              connected: z.boolean(),
              deviceToken: z.string().optional(),
            }),
          },
        },
      },
      async (request, reply) => {
        const userId = await request.getCurrentUserId()
        if (!userId) throw new NotFoundError('User not found')

        const existingToken = await prisma.token.findFirst({
          where: {
            userId,
            type: 'BARK_CONNECT',
          },
        })

        return reply.send({
          connected: !!existingToken,
          deviceToken: existingToken?.deviceToken ?? undefined,
        })
      },
    )
}
