import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { sendNotification } from '@/lib/notifier/send'
import { NotFoundError } from '@/http/_errors/not-found-error'

export async function updateUserBarkKey(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .patch(
      '/users/me/bark-key',
      {
        schema: {
          tags: ['Users'],
          summary: 'Set or update user Bark key',
          security: [{ bearerAuth: [] }],
          body: z.object({
            barkKey: z.string().min(5),
          }),
          response: {
            204: z.null(),
          },
        },
      },
      async (request, reply) => {
        const userId = await request.getCurrentUserId()
        const { barkKey } = request.body

        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        })

        if (!user) {
          throw new NotFoundError('User not found')
        }

        await prisma.user.update({
          where: { id: userId },
          data: { barkKey },
        })
        const updated = await prisma.user.update({
          where: { id: userId },
          data: { barkKey },
        })

        const token = await prisma.token.findFirst({
          where: {
            userId,
            type: 'BARK_CONNECT',
          },
          orderBy: {
            createdAt: 'desc',
          },
        })

        if (!token?.deviceKey) {
          throw new NotFoundError('Device not connected to Bark')
        }

        // 🔔 Envia notificação para o próprio usuário
        if (updated.barkKey) {
          await sendNotification({
            event: 'user.bark-connected',
            orgName: user.name,
            deviceKey: token.deviceKey,
            skipApprise: true,
          })
        }
        return reply.status(204).send()
      },
    )
}
