import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sendNotification } from '@/lib/notifier/send'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { auth } from '@/http/middlewares/auth'
import { NotFoundError } from '@/http/_errors/not-found-error'

export async function connectBark(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/integrations/bark/connect',
      {
        schema: {
          tags: ['Integrations'],
          summary: 'Connect Bark to user',
          security: [{ bearerAuth: [] }],
          response: {
            204: z.object({
              message: z.string(),
            }),
          },
        },
      },
      async (request, reply) => {
        const userId = await request.getCurrentUserId()

        if (!userId) {
          throw new NotFoundError('User not found')
        }

        const token = await prisma.token.findFirst({
          where: {
            userId,
            type: 'BARK_CONNECT',
          },
          orderBy: {
            createdAt: 'desc',
          },
        })

        if (!token || !token.deviceKey) {
          throw new NotFoundError('Device not connected to Bark')
        }

        await sendNotification({
          event: 'user.bark-connected',
          title: '✅ Dispositivo conectado!',
          message:
            'Agora você receberá notificações da Findu direto no seu iPhone. 📲',
          deviceKey: token.deviceKey,
          skipApprise: true,
        })

        return reply.status(204).send()
      },
    )
}
