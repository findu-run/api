import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { randomUUID } from 'node:crypto'

export async function createBarkSession(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .post(
      '/integrations/bark/session',
      {
        schema: {
          tags: ['Integrations'],
          summary: 'Create a temporary session to connect Bark device',
          security: [{ bearerAuth: [] }],
          response: {
            201: z.object({
              sessionToken: z.string().uuid(),
            }),
          },
        },
      },
      async (request) => {
        const userId = await request.getCurrentUserId()

        const token = randomUUID()

        await prisma.barkSession.create({
          data: {
            token,
            userId,
          },
        })

        return { sessionToken: token }
      },
    )
}
